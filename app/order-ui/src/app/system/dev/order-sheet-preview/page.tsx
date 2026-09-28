import { useState } from 'react'
import { Helmet } from 'react-helmet'
import { Eye } from 'lucide-react'

import { Button } from '@/components/ui'

import { demoOrder } from './mock'
import {
  OrderDetailSheetV1,
  OrderDetailSheetV2,
  OrderDetailSheetV3,
} from './variants'

const VARIANTS = [
  {
    id: 'v1' as const,
    title: 'V1 — Refined Classic',
    summary:
      'Giữ cấu trúc card hiện tại, làm clean lại: border mỏng hơn, status badge gom 1 chỗ, sticky footer, hero block "Tổng đơn".',
    pros: ['Familiar — gần với UI cũ', 'Đỡ retrain user', 'Migration rủi ro thấp'],
    cons: ['Vẫn nhiều borders', 'Card hierarchy chưa thật mạnh'],
  },
  {
    id: 'v2' as const,
    title: 'V2 — Minimal Receipt',
    summary:
      'Phong cách bill nhà hàng cao cấp. Bỏ hết card borders, dùng separator dashed. Hero amount 5xl. All-caps mini section headers.',
    pros: ['Dense, scannable', 'Hero amount nổi bật', 'Cảm giác POS chuyên nghiệp'],
    cons: ['Trông giống receipt giấy — có thể quá tối giản với bạn'],
  },
  {
    id: 'v3' as const,
    title: 'V3 — Modern Card',
    summary:
      'Soft shadows, gradient hero, status pills nhẹ. Card 2xl rounded. Tận dụng background gradient từ primary token.',
    pros: ['Hiện đại, hợp coffee shop brand', 'Visual depth qua shadow'],
    cons: ['Shadow + gradient nặng hơn 1 chút', 'Khác cảm giác POS hardcore'],
  },
]

export default function OrderSheetPreviewPage() {
  const [active, setActive] = useState<(typeof VARIANTS)[number]['id'] | null>(null)

  return (
    <div className="p-6">
      <Helmet>
        <title>[DEV] Order Sheet Preview</title>
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Order Detail Sheet — UI Preview</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Demo 3 hướng UI cho <code>OrderHistoryDetailSheet</code>. Click "Xem" để mở sheet
          với mock data. So sánh trên cả light + dark mode bằng nút theme switcher trên header.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VARIANTS.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Variant {v.id.toUpperCase()}
              </div>
              <h2 className="text-lg font-semibold mt-1">{v.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">{v.summary}</p>

              <div className="mt-3 space-y-1.5">
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  ƯU ĐIỂM
                </div>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  {v.pros.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 pt-1">
                  CÂN NHẮC
                </div>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  {v.cons.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>

              <Button className="mt-4 w-full" onClick={() => setActive(v.id)}>
                <Eye className="w-4 h-4 mr-2" />
                Xem {v.id.toUpperCase()}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-8 text-xs text-muted-foreground space-y-1">
          <div>
            <strong>Mock data:</strong> 1 đơn dine-in, 1 món (Cà phê sữa), 1 voucher giảm 500đ,
            đã thanh toán tiền mặt. Edit <code>mock.ts</code> để test case khác.
          </div>
          <div>
            <strong>Sau khi chọn:</strong> tôi sẽ refactor <code>order-history-detail-sheet.tsx</code>{' '}
            theo variant đó, giữ nguyên props API (controlled, IOrder).
          </div>
        </div>
      </div>

      <OrderDetailSheetV1
        order={demoOrder}
        isOpen={active === 'v1'}
        onClose={() => setActive(null)}
      />
      <OrderDetailSheetV2
        order={demoOrder}
        isOpen={active === 'v2'}
        onClose={() => setActive(null)}
      />
      <OrderDetailSheetV3
        order={demoOrder}
        isOpen={active === 'v3'}
        onClose={() => setActive(null)}
      />
    </div>
  )
}
