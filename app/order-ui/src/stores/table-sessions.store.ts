import { create } from 'zustand'
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from 'zustand/middleware'

import type {
  OrderItem,
  SubmittedOrder,
  TableCustomer,
  TableSession,
} from '@/types/session'
import type { InvoiceRequest } from '@/types/invoice'
import type { IVoucher } from '@/types/voucher.type'
import { STORAGE_KEYS } from '@/data/staff-data'
import {
  applySubmittedQuantity,
  transferSession as transferSessionHelper,
} from '@/lib/staff-orders'
import { showErrorToastMessage } from '@/utils'

type Sessions = Record<string, TableSession>

// Pre-Zustand releases stored sessions as a bare `Sessions` object at the same
// key. Wrap that shape into Zustand's `{state, version}` envelope on read so
// in-flight staff sessions survive the migration.
const legacyMigratingStorage: StateStorage = {
  getItem: (name) => {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as unknown
      if (
        parsed &&
        typeof parsed === 'object' &&
        'state' in (parsed as Record<string, unknown>)
      ) {
        return raw
      }
      return JSON.stringify({ state: { sessions: parsed }, version: 1 })
    } catch {
      return null
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}

export interface ITableSessionsStore {
  sessions: Sessions
  /** Promise of in-flight owner-sync PATCH. Voucher sheets await this in
   *  handleToggle so apply doesn't race the BE owner update. Memory-only —
   *  excluded from persist via `partialize`. */
  pendingOwnerSync: Promise<void> | null
  openSession: (tableId: string, tableName: string) => void
  addItem: (tableId: string, item: OrderItem) => boolean
  updateItem: (
    tableId: string,
    itemId: string,
    patch: {
      quantity?: number
      note?: string
      priceNum?: number
      price?: string
    },
  ) => void
  removeItem: (tableId: string, itemId: string) => void
  submitOrder: (tableId: string) => void
  requestPayment: (tableId: string) => void
  cancelPaymentIntent: (tableId: string) => void
  setOrderSlug: (tableId: string, orderSlug: string) => void
  closeSession: (tableId: string) => void
  cancelSession: (tableId: string) => void
  clearPendingItems: (tableId: string) => void
  setInvoiceRequest: (tableId: string, request: InvoiceRequest) => void
  setSubmittedQuantity: (
    tableId: string,
    menuItemId: string,
    note: string,
    newQty: number,
  ) => void
  transferSession: (
    fromTableId: string,
    toTableId: string,
    newTableName: string,
  ) => void
  setPendingItemOrderItemSlug: (
    tableId: string,
    variantSlug: string,
    orderItemSlug: string,
  ) => void
  addSubmittedOrderItem: (tableId: string, newItem: OrderItem) => void
  replaceSubmittedOrders: (tableId: string, orders: SubmittedOrder[]) => void
  setOrderDescription: (tableId: string, description: string) => void
  setOrderCustomer: (tableId: string, customer: TableCustomer | null) => void
  setOrderVoucher: (tableId: string, voucher: IVoucher | null) => void
  updateSubmittedItemNote: (
    tableId: string,
    menuItemId: string,
    oldNote: string,
    newNote: string,
  ) => void
  setPendingOwnerSync: (p: Promise<void> | null) => void
}

function patchSession(
  state: { sessions: Sessions },
  tableId: string,
  update: (session: TableSession) => TableSession | null,
): { sessions: Sessions } {
  const session = state.sessions[tableId]
  if (!session) return state
  const next = update(session)
  if (!next || next === session) return state
  return { sessions: { ...state.sessions, [tableId]: next } }
}

export const useTableSessionsStore = create<ITableSessionsStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      pendingOwnerSync: null,
      setPendingOwnerSync: (p) => set({ pendingOwnerSync: p }),

      openSession: (tableId, tableName) =>
        set((state) => {
          if (state.sessions[tableId]) return state
          const newSession: TableSession = {
            tableId,
            tableName,
            status: 'serving',
            pendingItems: [],
            submittedOrders: [],
            openedAt: new Date().toISOString(),
          }
          return { sessions: { ...state.sessions, [tableId]: newSession } }
        }),

      addItem: (tableId, item) => {
        const session = get().sessions[tableId]
        if (!session) return false

        // Pool of items that count for the no-mix invariant:
        // pending (not yet sent) + already-submitted (mirrors BE state).
        const existingItems = [
          ...session.pendingItems,
          ...session.submittedOrders.flatMap((o) => o.items),
        ]

        // Guard 1: no-mix custom-price + regular trong cùng đơn.
        if (existingItems.length > 0) {
          const incomingIsCustom = !!item.isCustomPrice
          const existingHasCustom = existingItems.some((i) => i.isCustomPrice)
          if (incomingIsCustom !== existingHasCustom) {
            showErrorToastMessage('toast.cannotMixCustomPriceItems')
            return false
          }
        }

        // Guard 2: mỗi sản phẩm custom-price chỉ được 1 trong giỏ.
        if (item.isCustomPrice) {
          const productKey = item.productSlug ?? item.menuItemId
          const duplicate = existingItems.some(
            (i) =>
              i.isCustomPrice && (i.productSlug ?? i.menuItemId) === productKey,
          )
          if (duplicate) {
            showErrorToastMessage('toast.customPriceItemAlreadyInCart')
            return false
          }
        }

        // Always push a new pending row. Quantity changes happen exclusively via
        // updateItem (driven by the cart +/- buttons). Each row gets a unique
        // rowId so React can distinguish duplicate menuItemIds and so update/
        // remove can target a single row. Custom-price rows already carry a
        // customPriceId; rowId is added regardless for a single uniform identifier.
        const pushed: OrderItem = { ...item, rowId: crypto.randomUUID() }
        set((state) =>
          patchSession(state, tableId, (s) => ({
            ...s,
            pendingItems: [...s.pendingItems, pushed],
          })),
        )
        return true
      },

      updateItem: (tableId, itemId, patch) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            pendingItems: session.pendingItems.map((p) =>
              (p.rowId ?? p.customPriceId ?? p.menuItemId) === itemId
                ? { ...p, ...patch }
                : p,
            ),
          })),
        ),

      removeItem: (tableId, itemId) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            pendingItems: session.pendingItems.filter(
              (p) => (p.rowId ?? p.customPriceId ?? p.menuItemId) !== itemId,
            ),
          })),
        ),

      submitOrder: (tableId) =>
        set((state) =>
          patchSession(state, tableId, (session) => {
            if (session.pendingItems.length === 0) return session
            const newOrder: SubmittedOrder = {
              id: `order-${crypto.randomUUID()}`,
              items: session.pendingItems,
              submittedAt: new Date().toISOString(),
            }
            return {
              ...session,
              pendingItems: [],
              submittedOrders: [...session.submittedOrders, newOrder],
            }
          }),
        ),

      requestPayment: (tableId) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            status: 'waiting_payment',
          })),
        ),

      /** Reverse of requestPayment — used when user backs out of payment screen
       *  without completing payment. Only reverts if currently 'waiting_payment'. */
      cancelPaymentIntent: (tableId) =>
        set((state) =>
          patchSession(state, tableId, (session) => {
            if (session.status !== 'waiting_payment') return session
            return { ...session, status: 'serving' }
          }),
        ),

      setOrderSlug: (tableId, orderSlug) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            orderSlug,
          })),
        ),

      clearPendingItems: (tableId) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            pendingItems: [],
          })),
        ),

      closeSession: (tableId) =>
        set((state) => {
          if (!state.sessions[tableId]) return state
          const next = { ...state.sessions }
          delete next[tableId]
          return { sessions: next }
        }),

      cancelSession: (tableId) =>
        set((state) => {
          if (!state.sessions[tableId]) return state
          const next = { ...state.sessions }
          delete next[tableId]
          return { sessions: next }
        }),

      setInvoiceRequest: (tableId, request) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            invoiceRequest: request,
          })),
        ),

      setSubmittedQuantity: (tableId, menuItemId, note, newQty) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            submittedOrders: applySubmittedQuantity(
              session.submittedOrders,
              menuItemId,
              note,
              newQty,
            ),
          })),
        ),

      transferSession: (fromTableId, toTableId, newTableName) =>
        set((state) => ({
          sessions: transferSessionHelper(
            state.sessions,
            fromTableId,
            toTableId,
            newTableName,
          ),
        })),

      setPendingItemOrderItemSlug: (tableId, variantSlug, orderItemSlug) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            pendingItems: session.pendingItems.map((item) =>
              item.variantSlug === variantSlug
                ? { ...item, orderItemSlug }
                : item,
            ),
          })),
        ),

      addSubmittedOrderItem: (tableId, newItem) =>
        set((state) =>
          patchSession(state, tableId, (session) => {
            const syntheticOrder: SubmittedOrder = {
              id: `order-inc-${Date.now()}`,
              submittedAt: new Date().toISOString(),
              items: [newItem],
            }
            return {
              ...session,
              submittedOrders: [...session.submittedOrders, syntheticOrder],
            }
          }),
        ),

      replaceSubmittedOrders: (tableId, orders) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            submittedOrders: orders,
          })),
        ),

      setOrderDescription: (tableId, description) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            description,
          })),
        ),

      setOrderCustomer: (tableId, customer) =>
        set((state) =>
          patchSession(state, tableId, (session) => {
            if (customer === null) {
              if (!session.customer) return session
              const { customer: _c, ...rest } = session
              void _c
              return rest as TableSession
            }
            return { ...session, customer }
          }),
        ),

      setOrderVoucher: (tableId, voucher) =>
        set((state) =>
          patchSession(state, tableId, (session) => {
            if (voucher === null) {
              if (!session.voucher) return session
              const { voucher: _v, ...rest } = session
              void _v
              return rest as TableSession
            }
            return { ...session, voucher }
          }),
        ),

      updateSubmittedItemNote: (tableId, menuItemId, oldNote, newNote) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({
            ...session,
            submittedOrders: session.submittedOrders.map((order) => ({
              ...order,
              items: order.items.map((it) =>
                it.menuItemId === menuItemId && it.note === oldNote
                  ? { ...it, note: newNote }
                  : it,
              ),
            })),
          })),
        ),
    }),
    {
      name: STORAGE_KEYS.sessions,
      version: 1,
      storage: createJSONStorage(() => legacyMigratingStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    },
  ),
)
