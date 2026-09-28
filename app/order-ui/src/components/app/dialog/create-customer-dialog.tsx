import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'

import { CreateCustomerForm } from '@/components/app/form'
import type { IUserInfo } from '@/types'

interface Props {
  /** Controlled mode — pass both open + onOpenChange to control externally. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Pre-fill phone number in the form. */
  defaultPhoneNumber?: string
  /** Called with newly-created user on success. */
  onCreated?: (user: IUserInfo) => void
  /** Hide the default trigger button (useful when caller opens dialog programmatically). */
  hideTrigger?: boolean
}

export default function CreateCustomerDialog({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  defaultPhoneNumber,
  onCreated,
  hideTrigger,
}: Props = {}) {
  const { t } = useTranslation(['customer'])
  const [internalOpen, setInternalOpen] = useState(false)

  // Controlled if BOTH open + onOpenChange are passed; else uncontrolled.
  const isControlled = openProp !== undefined && onOpenChangeProp !== undefined
  const isOpen = isControlled ? openProp : internalOpen
  const setIsOpen = isControlled ? onOpenChangeProp : setInternalOpen

  const handleSubmit = (open: boolean) => {
    setIsOpen(open)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button className="w-full gap-1" onClick={() => setIsOpen(true)}>
            {t('customer.create')}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-[90%] rounded-md p-0 sm:max-w-[50%]">
        <DialogHeader className="p-4">
          <DialogTitle>{t('customer.create')}</DialogTitle>
          <DialogDescription>
            {t('customer.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <CreateCustomerForm
          onSubmit={handleSubmit}
          defaultPhoneNumber={defaultPhoneNumber}
          onCreated={onCreated}
        />

        <DialogFooter className="flex justify-end p-4 border-t">
          <Button type="submit" form="create-customer-form">
            {t('customer.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
