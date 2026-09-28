import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  Button,
} from '@/components/ui'
import { useChangeOrderTable } from '@/hooks'
import { showErrorToastMessage } from '@/utils'
import type { Table } from '@/data/staff-data'
import type { TableSession } from '@/types/session'

type Step = 'warning' | 'selector' | null

interface Props {
  /** Server-side order slug. When absent, transfer is local-only (no API call). */
  orderSlug?: string | null
  currentTableId: string
  currentTableName: string
  tables: Table[]
  sessions: Record<string, TableSession>
  /** When true, show warning step before selector. */
  requiresConfirm?: boolean
  /** Called after successful transfer (API or local-only). Parent does invalidate/transferSession/navigate. */
  onTransferred: (newTable: { id: string; label: string }) => void
}

export function TransferTableDialog({
  orderSlug,
  currentTableId,
  currentTableName,
  tables,
  sessions,
  requiresConfirm,
  onTransferred,
}: Props) {
  const [step, setStep] = useState<Step>(null)
  const [selected, setSelected] = useState<Table | null>(null)
  const { mutate: changeOrderTable, isPending } = useChangeOrderTable()

  const isOpen = step !== null

  const otherTables = tables.filter((t) => t.id !== currentTableId)
  const hasAvailable = otherTables.some((t) => !sessions[t.id])

  const close = () => {
    setStep(null)
    setSelected(null)
  }

  const handleTriggerClick = () => {
    setSelected(null)
    setStep(requiresConfirm ? 'warning' : 'selector')
  }

  const handleWarningConfirm = () => {
    setStep('selector')
  }

  const handleConfirm = () => {
    if (!selected) return
    const target = selected

    // Pending-only mode: no server-side order — short-circuit, parent handles
    // session move + navigate.
    if (!orderSlug) {
      onTransferred({ id: target.id, label: target.label })
      close()
      return
    }

    changeOrderTable(
      { orderSlug, newTable: target.id },
      {
        onSuccess: () => {
          onTransferred({ id: target.id, label: target.label })
          close()
        },
        onError: () => {
          showErrorToastMessage('Không thể chuyển bàn. Vui lòng thử lại.')
        },
      },
    )
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (isPending) return
        if (!v) close()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleTriggerClick}>
          Đổi bàn
        </Button>
      </DialogTrigger>

      {step === 'warning' && (
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Cảnh báo đổi bàn có đơn</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Đơn hiện tại đang ghi nhận ở <strong>{currentTableName}</strong> trên server. Khi đổi sang bàn mới:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-pos-muted">
              <li>Đơn sẽ được cập nhật ở server sang bàn mới</li>
              <li>Bếp đã in ticket với tên <strong>{currentTableName}</strong> — cần báo bếp về việc chuyển bàn</li>
              <li>Bill in tiếp theo sẽ ghi tên bàn mới</li>
            </ul>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={close} disabled={isPending}>
              Quay lại
            </Button>
            <Button
              onClick={handleWarningConfirm}
              disabled={isPending}
              className="bg-pos-gold text-white hover:bg-pos-gold/80"
            >
              Tôi hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {step === 'selector' && (
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Chọn bàn mới</DialogTitle>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto -mx-6 px-6">
            {!hasAvailable ? (
              <p className="py-2 text-sm text-pos-muted">Không có bàn trống.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 pb-1">
                {otherTables.map((t) => {
                  const occupied = !!sessions[t.id]
                  const isSelected = selected?.id === t.id
                  return (
                    <Button
                      key={t.id}
                      variant="outline"
                      disabled={occupied}
                      onClick={() => setSelected(isSelected ? null : t)}
                      className={`flex h-16 flex-col items-center justify-center gap-0.5 bg-pos-card text-pos-text disabled:opacity-40 ${
                        isSelected
                          ? 'border-pos-gold bg-pos-gold/10'
                          : 'border-pos-border hover:border-pos-gold hover:bg-pos-elevated'
                      }`}
                    >
                      <span className="text-sm font-semibold">{t.label}</span>
                      <span className="text-[10px] text-pos-muted">
                        {occupied ? 'Đang có khách' : `${t.seats} chỗ`}
                      </span>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-pos-muted">
              {selected
                ? <>{currentTableName} <span className="text-pos-text font-medium">→</span> {selected.label}</>
                : 'Chọn bàn để chuyển'
              }
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={close}
                disabled={isPending}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                disabled={!selected || isPending}
                onClick={handleConfirm}
                className="bg-pos-gold text-white hover:bg-pos-gold/80 disabled:opacity-40"
              >
                {isPending ? 'ĐANG CHUYỂN…' : 'Xác nhận'}
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
