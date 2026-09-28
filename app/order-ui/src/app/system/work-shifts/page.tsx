import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { SquareMenu } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { Role } from '@/constants'
import { useUserStore } from '@/stores'

import { ActiveTab } from './components/active-tab'
import { HistoryTab } from './components/history-tab'
import { MyShiftTab } from './components/my-shift-tab'

/**
 * Một route duy nhất cho cả hai vai trò, một mục sidebar duy nhất.
 *
 * CASHIER  → ca của chính mình + lịch sử ca (của mình — BE tự lọc theo
 *   cashierSlug của người gọi, spec §3 "Xem lịch sử ca (của mình)").
 * MANAGER+ → giám sát: danh sách ca ACTIVE + lịch sử ca.
 *
 * Không gộp thành 3 tab cho cashier: theo spec §3, CASHIER không có quyền
 * gọi GET /work-shifts/active — tab đó sẽ luôn 403.
 *
 * Tab được lưu ở query `?tab=` để khi vào chi tiết ca rồi back lại vẫn giữ
 * đúng tab (nhất là "Lịch sử ca") thay vì reset về tab mặc định.
 */
export default function SystemWorkShiftsPage() {
  const { t } = useTranslation('workShift')
  const { t: tHelmet } = useTranslation('helmet')
  const role = useUserStore((s) => s.getUserInfo())?.role?.name
  const [searchParams, setSearchParams] = useSearchParams()

  const isCashier = role === Role.CASHIER
  const ownTab = isCashier ? 'current' : 'active'
  const validTabs = [ownTab, 'history']

  // Nguồn tab: URL `?tab=` (thắng khi browser-back khôi phục URL) → sessionStorage
  // (giữ khi rời trang rồi quay lại bằng điều hướng mới, ví dụ "Tiếp tục đơn"
  // → menu → back) → tab mặc định theo vai trò.
  const pick = (v: string | null) =>
    v && validTabs.includes(v) ? v : undefined
  const tab =
    pick(searchParams.get('tab')) ??
    pick(sessionStorage.getItem('systemWorkShiftTab')) ??
    ownTab

  const handleTabChange = (value: string) => {
    sessionStorage.setItem('systemWorkShiftTab', value)
    setSearchParams(
      (prev) => {
        prev.set('tab', value)
        return prev
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-4 py-2">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.workShift.title')}</title>
        <meta
          name="description"
          content={tHelmet('helmet.workShift.description')}
        />
      </Helmet>
      <span className="flex items-center gap-1 text-lg">
        <SquareMenu />
        {t('title')}
      </span>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList variant="line" className="mt-2 w-full justify-start border-b">
          <TabsTrigger value={ownTab}>
            {isCashier ? t('currentShift') : t('tabActive')}
          </TabsTrigger>
          <TabsTrigger value="history">{t('tabHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value={ownTab} className="mt-3">
          {isCashier ? <MyShiftTab /> : <ActiveTab />}
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
