import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

import { UpdateProductForm } from '@/components/app/form'
import { IProduct } from '@/types'

interface UpdateProductDialogProps {
  product: IProduct
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function UpdateProductDialog({
  product,
  isOpen,
  onOpenChange,
}: UpdateProductDialogProps) {
  const { t } = useTranslation(['product'])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90%] rounded-md px-6 sm:max-w-[36%]">
        <DialogHeader>
          <DialogTitle>{t('product.update')}</DialogTitle>
          <DialogDescription>
            {t('product.updateProductDescription')}
          </DialogDescription>
        </DialogHeader>
        <UpdateProductForm product={product} onSubmit={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}
