import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Loader2, PlayCircle, Wallet } from 'lucide-react'

import { Button, Card, CardContent, Input } from '@/components/ui'
import { WORK_SHIFT_ERROR_CODE } from '@/constants'
import { useOpenWorkShift } from '@/hooks'
import { getApiErrorCode } from '@/lib/api-error'
import { useUserStore } from '@/stores'
import type { IWorkShift } from '@/types'
import {
  formatCurrencyWithSymbol,
  showErrorToast,
  showErrorToastMessage,
  showToast,
} from '@/utils'

interface Props {
  onOpened?: (shift: IWorkShift) => void
}

/** Màn hình mở ca cho CASHIER. openingCash bắt buộc, >= 0. */
export function OpenShiftScreen({ onOpened }: Props) {
  const { t } = useTranslation('workShift')
  const [cash, setCash] = useState<string>('')
  const { mutate: openShift, isPending } = useOpenWorkShift()
  const userInfo = useUserStore((s) => s.getUserInfo())
  const fullName =
    `${userInfo?.firstName ?? ''} ${userInfo?.lastName ?? ''}`.trim()

  const handleSubmit = () => {
    // openingCash bắt buộc — chuỗi rỗng không hợp lệ (khác model staff-shift cũ).
    if (cash.trim() === '') {
      showErrorToastMessage(t('validation.openingCashInvalid'))
      return
    }
    const openingCash = Number(cash)
    if (!Number.isInteger(openingCash) || openingCash < 0) {
      showErrorToastMessage(t('validation.openingCashInvalid'))
      return
    }

    openShift(
      { openingCash },
      {
        onSuccess: (response) => {
          const shift = response.result
          showToast(t('openSuccess'))
          if (shift.preShiftOrdersLinked > 0) {
            showToast(
              t('preShiftLinked', { count: shift.preShiftOrdersLinked }),
            )
          }
          onOpened?.(shift)
        },
        onError: (error: unknown) => {
          const code = getApiErrorCode(error)
          if (code === WORK_SHIFT_ERROR_CODE.BRANCH_HAS_ACTIVE) {
            showErrorToast(code)
            return
          }
          showErrorToastMessage('toast.requestFailed')
        },
      },
    )
  }

  return (
    <div className="flex h-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardContent className="space-y-5 p-6">
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pos-gold/10">
                <Clock className="h-6 w-6 text-pos-gold" />
              </div>
            </div>
            <h2 className="text-2xl font-bold leading-tight">
              {t('openShiftTitle')}
            </h2>
            {fullName && (
              <p className="mt-1 text-sm text-muted-foreground">{fullName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="opening-cash"
              className="mb-2 block text-sm font-medium"
            >
              {t('openingCash')}
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="opening-cash"
                type="text"
                inputMode="numeric"
                value={cash ? formatCurrencyWithSymbol(Number(cash), false) : ''}
                onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                disabled={isPending}
                className="pl-9 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                đ
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('openingCashHint')}
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isPending}
            size="lg"
            className="w-full text-base font-semibold"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-5 w-5" />
            )}
            {isPending ? t('opening') : t('openShiftCta')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
