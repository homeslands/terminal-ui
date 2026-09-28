import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui'

interface Props {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ReinitConfirmDialog({ open, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Đơn vừa được cập nhật ở thiết bị khác</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tải lại để xem dữ liệu mới nhất từ server. Mọi thay đổi đang chỉnh sửa (chưa lưu) sẽ bị bỏ.
        </p>
        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel}>
            Tiếp tục chỉnh
          </Button>
          <Button onClick={onConfirm}>Tải lại</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
