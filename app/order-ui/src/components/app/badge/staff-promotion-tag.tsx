import { useTranslation } from 'react-i18next'

import PromotionTagImage from '@/assets/images/promotion-tag.svg'
import { IPromotion } from '@/types'

export default function StaffPromotionTag({ promotion }: { promotion: IPromotion }) {
    const { t } = useTranslation('product')
    return (
        promotion && promotion.value > 0 ? (
            <div className="absolute -top-1 -left-[0.3rem] z-10 w-[4.5rem] sm:w-[5rem]">
                <img src={PromotionTagImage} alt="promotion-tag" className="w-full" />
                <span className="absolute left-2 w-full text-[0.55rem] font-medium text-white sm:left-2 sm:text-[0.65rem] top-1.5 sm:top-1.5">
                    {t(`product.discount`)} {promotion.value}%
                </span>
            </div>
        ) : null
    )
}