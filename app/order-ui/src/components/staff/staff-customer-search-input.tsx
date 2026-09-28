import { useEffect, useRef, useState } from 'react'
import { CircleX, Loader2, UserPlus } from 'lucide-react'

import { Input, Button } from '@/components/ui'
import { ScanRFIDCustomerDialog } from '@/components/app/dialog'
import CreateCustomerDialog from '@/components/app/dialog/create-customer-dialog'
import { useDebouncedInput, usePagination, useUsers } from '@/hooks'
import { Role } from '@/constants'
import { useTableSessionsStore } from '@/stores'
import type { IUserInfo } from '@/types'
import type { TableCustomer } from '@/types/session'

interface Props {
  customer: TableCustomer | null
  onSelect: (customer: TableCustomer) => void
  onClear: () => void
  disabled?: boolean
}

function toTableCustomer(user: IUserInfo): TableCustomer {
  return {
    slug: user.slug,
    firstName: user.firstName,
    lastName: user.lastName,
    phonenumber: user.phonenumber,
  }
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName ?? '').trim()[0] ?? ''
  const l = (lastName ?? '').trim()[0] ?? ''
  return (l + f).toUpperCase() || '?'
}

export function StaffCustomerSearchInput({
  customer,
  onSelect,
  onClear,
  disabled,
}: Props) {
  const { inputValue, setInputValue, debouncedInputValue } = useDebouncedInput()
  const [showList, setShowList] = useState(false)
  const [users, setUsers] = useState<IUserInfo[]>([])
  const [isRFIDDialogOpen, setIsRFIDDialogOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [scannedIdentityCode, setScannedIdentityCode] = useState<string>('')
  const { pagination, setPagination } = usePagination()
  const userListRef = useRef<HTMLDivElement>(null)
  const isOwnerSyncing = useTableSessionsStore((s) => s.pendingOwnerSync !== null)

  const { data: userByIdentityCode, isFetching: isFetchingIdentityCode } =
    useUsers(
      scannedIdentityCode
        ? {
            order: 'DESC',
            page: 1,
            size: 10,
            slug: scannedIdentityCode,
            role: Role.CUSTOMER,
            hasPaging: false,
          }
        : null,
      !!scannedIdentityCode,
    )

  const { data: userByPhone, isFetching: isFetchingByPhone } = useUsers(
    debouncedInputValue
      ? {
          order: 'DESC',
          page: pagination.pageIndex,
          size: pagination.pageSize,
          phonenumber: debouncedInputValue,
          role: Role.CUSTOMER,
          hasPaging: true,
        }
      : null,
    !!debouncedInputValue && !disabled,
  )

  // Effect 1: Reset pagination + clear users mỗi khi query đổi
  useEffect(() => {
    setUsers([])
    setPagination((prev) =>
      prev.pageIndex === 1 ? prev : { ...prev, pageIndex: 1 },
    )
  }, [debouncedInputValue, setPagination])

  // Effect 2: Sync users từ API response
  useEffect(() => {
    if (debouncedInputValue === '') return
    if (!userByPhone?.result?.items) return
    if (pagination.pageIndex === 1) {
      setUsers(userByPhone.result.items)
    } else {
      setUsers((prev) => [...prev, ...userByPhone.result.items])
    }
  }, [debouncedInputValue, userByPhone, pagination.pageIndex])

  const handleScroll = () => {
    if (userListRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = userListRef.current
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        setPagination((prev) => ({ ...prev, pageIndex: prev.pageIndex + 1 }))
      }
    }
  }

  const handleSelectRef = useRef<(u: IUserInfo) => void>(() => {})
  handleSelectRef.current = (u: IUserInfo) => {
    onSelect(toTableCustomer(u))
    setInputValue('')
    setShowList(false)
  }

  useEffect(() => {
    if (!scannedIdentityCode) return
    if (isFetchingIdentityCode) return
    const items = userByIdentityCode?.result?.items
    if (!items) return
    if (items.length === 1 && items[0].isActive) {
      handleSelectRef.current(items[0])
      setIsRFIDDialogOpen(false)
    }
    setScannedIdentityCode('')
  }, [userByIdentityCode, scannedIdentityCode, isFetchingIdentityCode])

  const showLoading = !!debouncedInputValue && isFetchingByPhone
  const showEmpty =
    !!debouncedInputValue &&
    !isFetchingByPhone &&
    users.length === 0 &&
    userByPhone?.result?.items?.length === 0

  return (
    <>
      <div className="flex flex-col gap-2">
        {!customer && (
          <div className="relative">
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    setShowList(true)
                  }}
                  onFocus={() => setShowList(true)}
                  onBlur={() => setTimeout(() => setShowList(false), 150)}
                  disabled={disabled}
                  placeholder="Tìm khách theo số điện thoại..."
                  className="h-10 flex-1 border-pos-border bg-pos-card text-sm placeholder:text-pos-faint"
                />
                {isOwnerSyncing && (
                  <div
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    title="Đang đồng bộ khách hàng…"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
            {showList && (showLoading || users.length > 0 || showEmpty) && (
              <div
                ref={userListRef}
                onScroll={handleScroll}
                role="listbox"
                className="absolute z-10 mt-1.5 max-h-72 w-full overflow-y-auto rounded-md border border-pos-border bg-pos-card shadow-lg"
              >
                {showLoading && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-pos-faint">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tìm…
                  </div>
                )}
                {!showLoading &&
                  users.length > 0 &&
                  users.map((u, idx) => (
                    <button
                      key={u.slug}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!u.isActive) return
                        onSelect(toTableCustomer(u))
                        setInputValue('')
                        setShowList(false)
                      }}
                      className={`relative flex w-full items-center gap-3 px-3 py-3.5 pr-20 text-left transition ${
                        idx < users.length - 1
                          ? 'border-b border-pos-border/50'
                          : ''
                      } ${
                        u.isActive
                          ? 'cursor-pointer hover:bg-pos-hover'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span
                        className={`absolute right-2 top-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                          u.isActive ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      >
                        {u.isActive ? 'Hoạt động' : 'Khoá'}
                      </span>
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          u.isActive
                            ? 'bg-pos-gold/15 text-pos-gold'
                            : 'bg-pos-border/30 text-pos-faint'
                        }`}
                      >
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-pos-text">
                          {u.lastName} {u.firstName}
                        </div>
                        <div className="truncate text-xs text-pos-faint">
                          {u.phonenumber}
                        </div>
                      </div>
                    </button>
                  ))}
                {showEmpty && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsCreateOpen(true)}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-pos-hover"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pos-gold/15">
                      <UserPlus className="h-4 w-4 text-pos-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-pos-text">
                        Tạo khách mới
                      </div>
                      <div className="truncate text-xs text-pos-faint">
                        với SĐT {debouncedInputValue}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {customer && (
          <div className="flex h-full items-center gap-2.5 rounded-md bg-pos-card px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pos-gold/15 text-xs font-bold text-pos-gold">
              {getInitials(customer.firstName, customer.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-pos-text">
                {customer.lastName} {customer.firstName}
              </div>
              <div className="truncate text-xs text-pos-faint">
                {customer.phonenumber}
              </div>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Bỏ chọn khách"
                onClick={onClear}
                className="h-9 w-9 border-none text-destructive/80 hover:bg-destructive/10 hover:text-destructive data-[state=open]:bg-destructive/10"
              >
                <CircleX size={16} />
              </Button>
            )}
          </div>
        )}
      </div>

      <ScanRFIDCustomerDialog
        isOpen={isRFIDDialogOpen}
        onOpenChange={setIsRFIDDialogOpen}
        onUserSelect={(user) => {
          if (!user.isActive) return
          onSelect(toTableCustomer(user))
          setIsRFIDDialogOpen(false)
        }}
        onQrTokenScanned={(token) => setScannedIdentityCode(token)}
        defaultTab="rfid"
      />

      <CreateCustomerDialog
        hideTrigger
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultPhoneNumber={debouncedInputValue}
        onCreated={(user) => {
          onSelect(toTableCustomer(user))
          setInputValue('')
          setShowList(false)
          setIsCreateOpen(false)
        }}
      />
    </>
  )
}
