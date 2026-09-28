import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tên nhân viên đang đăng nhập (vd "Phan Thắng") để show trong message */
  staffName: string
  /** Callback khi user confirm */
  onConfirm: () => void
}

export default function ConfirmClearCustomerDialog({
  open,
  onOpenChange,
  staffName,
  onConfirm,
}: Props) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>Xoá khách hàng khỏi đơn?</DialogTitle>
          <DialogDescription>
            Đơn này sẽ chuyển thành đơn khách lẻ.
            <br />
            Người phụ trách:{' '}
            <strong className="text-foreground">{staffName}</strong>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-w-24"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleConfirm}
            className="min-w-24 bg-pos-gold text-white hover:bg-pos-gold/80"
          >
            Xoá khách hàng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
