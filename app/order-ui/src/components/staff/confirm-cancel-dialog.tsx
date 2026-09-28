import { Button } from '@/components/ui'

interface Props {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

export function ConfirmCancelDialog({ open, onConfirm, onCancel, isPending }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-72 rounded-lg border border-pos-border bg-pos-card p-5 text-pos-text">
        <p className="mb-1 text-sm font-semibold">Huỷ đơn?</p>
        <p className="mb-4 text-xs text-pos-muted">
          Toàn bộ đơn đã đặt sẽ bị xoá. Không thể hoàn tác.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Quay lại
          </Button>
          <Button
            className="bg-red-700 text-white hover:bg-red-600"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Đang huỷ…' : 'Xác nhận huỷ'}
          </Button>
        </div>
      </div>
    </div>
  )
}
