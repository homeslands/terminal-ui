# Staff Shift Dashboard — Design Spec

## Goal

Trang dashboard riêng cho nhân viên POS, hiển thị các thông số cá nhân trong ca làm việc: doanh thu, số đơn, số món bán được, và top món. Nằm trong khu vực POS (`/staff`), dark theme nhất quán với các trang POS hiện có.

## Architecture

### Route & Entry Point

- Route: `/staff/my-shift`
- Page file: `src/app/staff/my-shift.tsx`
- Lazy-loaded qua `src/router/loadable.tsx` (theo pattern hiện có)
- Entry point: nút **"Ca của tôi"** thêm vào header của `StaffFloorPlanPage` (`src/app/staff/floor-plan.tsx`)
- Back button → `/staff` (sơ đồ bàn)

### Data Flow

```
useStaffShift(date, shiftKey)
       ↓
my-shift.tsx (page)
       ├── ShiftSelector       (chọn ca + ngày)
       ├── ShiftStatCards      (3 stat cards)
       └── ShiftTopItems       (top 5 món bar chart)
```

## Shift Definition

3 ca cố định theo giờ:

| Ca | Key | Giờ |
|----|-----|-----|
| Ca sáng | `morning` | 06:00 – 14:00 |
| Ca chiều | `afternoon` | 14:00 – 22:00 |
| Ca tối | `evening` | 22:00 – 06:00 |

Ca hiện tại được tự động detect dựa trên giờ thực khi load trang. Người dùng có thể chọn lại ca khác hoặc chuyển sang ngày khác để xem lịch sử.

## Components

### Mới tạo

| File | Trách nhiệm |
|------|-------------|
| `src/app/staff/my-shift.tsx` | Page component — compose layout, giữ state ca/ngày đang chọn |
| `src/components/staff/shift-selector.tsx` | 3 nút ca (toggle group) + date picker (prev/next) |
| `src/components/staff/shift-stat-cards.tsx` | 3 card: Doanh thu (pos-gold accent), Số đơn, Số món |
| `src/components/staff/shift-top-items.tsx` | Top 5 món — horizontal CSS bars, không dùng ECharts |
| `src/hooks/useStaffShift.ts` | Data hook — mock data bây giờ, swap API sau |
| `src/types/shift.ts` | Type definitions |
| `src/utils/shift.ts` | `getCurrentShift()`, `getShiftConfig()`, `SHIFTS` config |

### Sửa

| File | Thay đổi |
|------|---------|
| `src/app/staff/floor-plan.tsx` | Thêm nút link "Ca của tôi" vào header |
| `src/router/loadable.tsx` | Thêm lazy import cho `StaffMyShiftPage` |
| `src/constants/route.ts` | Thêm `STAFF_MY_SHIFT = '/staff/my-shift'` |

## Types (`src/types/shift.ts`)

```ts
export type ShiftKey = 'morning' | 'afternoon' | 'evening'

export interface ShiftStats {
  revenue: number
  orderCount: number
  itemCount: number
  topItems: { name: string; quantity: number }[]
}

export interface ShiftConfig {
  key: ShiftKey
  label: string       // "Ca sáng"
  hours: string       // "06:00 – 14:00"
  startHour: number
  endHour: number
}
```

## Hook (`src/hooks/useStaffShift.ts`)

```ts
function useStaffShift(
  date: string,     // "YYYY-MM-DD"
  shift: ShiftKey,
): { data: ShiftStats | undefined; isLoading: boolean }
```

**Mock implementation:** Tạo data tĩnh có biến động nhỏ dựa trên seed từ `date + shift` (để các ca/ngày khác nhau trông khác nhau). Trả `isLoading: false` ngay lập tức.

**Upgrade path:** Khi BE có API, chỉ thay body hook bằng `useQuery` gọi `GET /staff/my-shift?staffSlug=...&date=...&shift=...` — interface không đổi, components không cần sửa.

## Shift Utils (`src/utils/shift.ts`)

```ts
export const SHIFTS: ShiftConfig[]

export function getCurrentShift(): ShiftKey
// Dựa vào new Date().getHours():
// 6–13 → 'morning', 14–21 → 'afternoon', else → 'evening'

export function getShiftConfig(key: ShiftKey): ShiftConfig
```

## UI Design

- **Theme:** Dark POS (`pos-bg`, `pos-surface`, `pos-gold`, `pos-border`, `pos-muted`, `pos-text`)
- **Stat cards:** Grid 3 cột, card Doanh thu dùng `bg-pos-gold text-black` làm accent
- **Top items:** CSS bars thuần — `bg-pos-gold` với opacity giảm dần theo rank, không cần ECharts
- **Shift selector:** Toggle group 3 nút, ca đang chọn highlight `bg-pos-gold text-black`
- **Date picker:** `‹ DD/MM/YYYY ›` — next arrow disabled khi là hôm nay

## Testing

**`src/utils/__tests__/shift.test.ts`**
- `getCurrentShift()` trả đúng key theo giờ (mock `Date`)
- Boundary: 06:00 → morning, 13:59 → morning, 14:00 → afternoon, 21:59 → afternoon, 22:00 → evening

**`src/hooks/__tests__/useStaffShift.test.ts`**
- Trả đúng shape `ShiftStats`
- `isLoading` là `false` sau khi resolve
- Data khác nhau giữa các ca (morning ≠ afternoon)

**`src/tests/components/staff/shift-selector.test.tsx`**
- Render đủ 3 nút ca
- Ca hiện tại được highlight
- Click đổi ca gọi `onChange` đúng
- Date prev/next hoạt động, next disabled khi là hôm nay

## Out of Scope

- So sánh với ca trước / trung bình (có thể thêm sau)
- Export PDF/Excel
- Real-time update trong ca
- Quản lý ca (bắt đầu/kết thúc thủ công)
