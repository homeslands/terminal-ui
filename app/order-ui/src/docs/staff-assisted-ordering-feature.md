# Mô tả chi tiết: Hệ thống đặt hàng nhân viên (Staff Ordering)

## 1. Tổng quan

Hệ thống đặt hàng nhân viên là một POS (Point of Sale) đơn giản được nhúng vào landing page nhà hàng THE TERMINAL. Nhân viên truy cập qua route `/staff`. Toàn bộ trạng thái được lưu vào **localStorage** — không cần backend, không có authentication riêng cho nhân viên.

**Luồng chính:**

```
Floor Plan (/staff)
  → Chọn bàn → Table Order (/staff/table/:id)
      → Đặt món → Gọi thanh toán → Payment (/staff/table/:id/payment)
          → Xác nhận → Floor Plan (đóng phiên)
          → Xuất hoá đơn VAT → Invoice (/staff/table/:id/invoice) → Floor Plan
```

---

## 2. Kiến trúc dữ liệu

### 2.1 Types cốt lõi (`src/types/session.ts`, `src/types/invoice.ts`)

```typescript
// Một món trong giỏ hàng (pending hoặc đã đặt)
interface OrderItem {
  menuItemId: string
  name: string
  priceNum: number      // Số nguyên, đơn vị đồng
  price: string         // Chuỗi hiển thị, vd: "185.000đ"
  quantity: number
  note: string          // Ghi chú bếp (vd: "không cay")
}

// Một lần nhấn "ĐẶT MÓN" tạo ra một SubmittedOrder
interface SubmittedOrder {
  id: string            // "order-<timestamp>"
  items: OrderItem[]
  submittedAt: string   // ISO datetime
}

// Phiên làm việc của một bàn
interface TableSession {
  tableId: string
  status: 'empty' | 'serving' | 'waiting_payment' | 'done'
  pendingItems: OrderItem[]        // Đang chọn, chưa gửi bếp
  submittedOrders: SubmittedOrder[]// Đã gửi bếp
  openedAt: string                 // ISO datetime, lúc mở bàn
  invoiceRequest?: InvoiceRequest  // Thông tin xuất VAT, nếu có
}

// Thông tin mua hàng cho hoá đơn VAT
interface InvoiceRequest {
  buyerName: string
  buyerTaxCode: string
  buyerAddress: string
  buyerEmail: string
  paymentMethod: 'cash' | 'transfer'
}

// Hoá đơn VAT hoàn chỉnh
interface InvoiceData {
  number: string        // "0000001" (auto-increment từ localStorage)
  symbol: string        // vd: "AA/25E"
  issuedAt: string
  seller: SellerInfo
  buyer: InvoiceRequest
  items: InvoiceLineItem[]
  subtotal: number      // Trước VAT
  vatRate: number       // vd: 0.1 (10%)
  vatAmount: number
  total: number         // Sau VAT (= giá menu đã bao gồm VAT)
  totalInWords: string  // "Một triệu hai trăm nghìn đồng"
}
```

### 2.2 Vòng đời phiên bàn (TableSession.status)

```
[không có session]
    ↓ openSession()
  'serving'
    ↓ requestPayment()
  'waiting_payment'
    ↓ closeSession()
  [session bị xoá]
```

- Khi bàn **empty** (không có session hoặc session.status = 'empty'/'done'): nhấn vào bàn sẽ gọi `openSession()` rồi chuyển đến trang đặt món.
- Khi **serving**: nhấn vào bàn → trang đặt món.
- Khi **waiting_payment**: nhấn vào bàn → trang thanh toán.
- `closeSession()` xoá hoàn toàn record khỏi localStorage.

---

## 3. State Management — `useTableSessions`

**File:** `src/hooks/useTableSessions.ts`  
**localStorage key:** `terminal_staff_sessions`  
**Kiểu dữ liệu lưu:** `Record<string, TableSession>` — map từ tableId → TableSession

### Các hàm cung cấp

| Hàm | Tham số | Mô tả |
|-----|---------|-------|
| `openSession(tableId)` | tableId: string | Tạo session mới, status='serving', pendingItems=[], submittedOrders=[] |
| `addItem(tableId, item)` | tableId, item: OrderItem | Thêm vào pendingItems; nếu đã tồn tại thì cộng quantity |
| `updateItem(tableId, menuItemId, patch)` | patch: { quantity?, note? } | Cập nhật quantity hoặc note của pending item |
| `removeItem(tableId, menuItemId)` | — | Xoá item khỏi pendingItems |
| `submitOrder(tableId)` | — | Chuyển tất cả pendingItems → SubmittedOrder mới, pendingItems reset về [] |
| `requestPayment(tableId)` | — | Đổi status: 'serving' → 'waiting_payment' |
| `closeSession(tableId)` | — | Xoá toàn bộ session[tableId] khỏi storage |
| `setInvoiceRequest(tableId, request)` | request: InvoiceRequest | Lưu thông tin VAT vào session |

**Lưu ý thiết kế:**  
Hàm `update(fn)` là updater nội bộ — nó cập nhật React state và đồng thời ghi vào localStorage trong cùng một thao tác, đảm bảo không bị mất dữ liệu khi refresh.

---

## 4. Các trang (Pages)

### 4.1 Floor Plan — `/staff`

**File:** `src/pages/staff-floor-plan.tsx`

**Mục đích:** Màn hình chính nhân viên, hiển thị toàn bộ bàn và trạng thái.

**Logic:**
- Đồng hồ thời gian thực: `setInterval` 1 giây cập nhật `Date`, hiển thị ngày giờ Việt Nam.
- `handleTableClick(tableId)`:
  - Nếu chưa có session hoặc status là 'empty'/'done': gọi `openSession()` → navigate `/staff/table/{id}`.
  - Nếu status là 'serving': navigate `/staff/table/{id}`.
  - Nếu status là 'waiting_payment': navigate `/staff/table/{id}/payment`.

**Giao diện:**
- **Header** (cố định, dark): Logo "THE TERMINAL", đồng hồ DD/MM/YYYY HH:MM:SS, nút "QUẢN LÝ" → `/admin`, badge "NHÂN VIÊN".
- **Stats bar**: 4 thẻ số liệu — Tổng bàn / Đang phục vụ (vàng) / Chờ thanh toán (cam) / Trống (xám).
- **Grid bàn**: Lưới responsive (2 cột mobile, 3 sm, 4 lg) — mỗi ô là `TableCard`.

---

### 4.2 Table Order — `/staff/table/:id`

**File:** `src/pages/staff-table-order.tsx`

**Mục đích:** Màn hình đặt món cho một bàn cụ thể.

**State:**
- `mobilePane: 'menu' | 'order'` — trên mobile chỉ hiện 1 trong 2 panel; tablet/desktop hiện song song.
- `showDraftReceipt: boolean` — hiện dialog hoá đơn tạm.

**Logic:**
- Nếu không tìm được `table` hoặc `session` → hiện thông báo lỗi.
- `handlePay()`: gọi `requestPayment(id)` → navigate `/staff/table/{id}/payment`.
- `pendingCount`: tổng số lượng món đang trong pending (dùng để enable/disable nút "ĐẶT MÓN").

**Giao diện:**
- **Topbar**: Nút ← Sơ đồ, tên bàn (vd: "Bàn 05"), badge trạng thái ("ĐANG PHỤC VỤ"), nút "THANH TOÁN" (nếu đã có order đã submit).
- **Mobile tab bar** (ẩn trên lg+): Hai tab "MENU" và "ORDER" với số lượng pending.
- **Layout 2 cột** (trên lg): cột trái là MenuPanel, cột phải là OrderSummary.
- **ReceiptDialog**: Modal hoá đơn tạm, mở khi nhấn "HĐ tạm" trong OrderSummary.

---

### 4.3 Payment — `/staff/table/:id/payment`

**File:** `src/pages/staff-payment.tsx`

**Mục đích:** Thu tiền, xuất hoá đơn.

**State:**
- `showInvoiceForm: boolean` — hiện form nhập thông tin VAT.
- `receiptType: 'draft' | 'final' | null` — loại hoá đơn đang xem.

**Logic:**
- `total`: tính từ toàn bộ `submittedOrders` — tổng `priceNum × quantity`.
- `handleConfirm()`: toast "Thanh toán thành công", `closeSession()`, navigate `/staff`.
- `handleInvoiceSubmit(request)`: `setInvoiceRequest()`, navigate `/staff/table/{id}/invoice`.
- `handleReceiptDone()`: tương tự `handleConfirm()` (dùng khi xác nhận từ dialog hoá đơn chính thức).

**Giao diện:**
- **Topbar**: Nút ← Quay lại bàn, badge "CHỜ THANH TOÁN".
- **Cột trái — Chi tiết hoá đơn**: Liệt kê từng lần đặt (`SubmittedOrder`) với thời gian, danh sách món, thành tiền từng món. Cuối cùng là tổng cộng in đậm.
- **Cột phải — PaymentPanel**: Panel thu tiền.
- **3 nút hành động** (dưới PaymentPanel): "In tạm" (draft receipt), "In hoá đơn" (final receipt), "Xuất hoá đơn VAT".
- **Modal InvoiceForm**: Hiện khi nhấn "Xuất hoá đơn VAT".
- **Modal ReceiptDialog**: Hiện khi nhấn "In tạm" hoặc "In hoá đơn".

---

### 4.4 Invoice — `/staff/table/:id/invoice`

**File:** `src/pages/staff-invoice.tsx`

**Mục đích:** Xem và in hoá đơn VAT (hoá đơn đỏ, đúng chuẩn thuế Việt Nam).

**Logic:**
- `buildInvoice(session, request, sellerInfo, vatRate)` được gọi khi render để tạo `InvoiceData`.
- Giá menu đã **bao gồm VAT** → ngược chiết VAT ra: `unitPrice = priceNum / (1 + vatRate)`.
- Số hoá đơn tự động tăng dần, lưu ở `terminal_invoice_counter` trong localStorage.
- `handleDone()`: `closeSession()` → navigate `/staff`.

**Giao diện:**
- **Topbar** (print:hidden): Nút ← Thanh toán, "IN HOÁ ĐƠN" (`window.print()`), "HOÀN TẤT" (đóng phiên).
- **InvoicePreview**: Trang A4, CSS `print` tối ưu.
- **Watermark "BẢN MẪU"** (ẩn khi in).

---

### 4.5 Receipt — `/staff/table/:id/receipt?draft=true|false`

**File:** `src/pages/staff-receipt.tsx`

**Mục đích:** Trang receipt dạng thermal printer, có thể mở trong tab mới để in.

**Query params:** `draft=true` → hoá đơn tạm (chưa thanh toán); `draft=false` → hoá đơn chính thức.

**Logic:**
- `issuedAt` được ghi lại ngay khi mount (một lần duy nhất) để thời gian không thay đổi khi tab được render lại.
- `handleDone()` (chỉ cho final receipt): `closeSession()` → navigate `/staff`.

**Giao diện:**
- **Topbar** (print:hidden): Nút quay lại khác nhau tuỳ draft/final; nút in (`window.print()`); nút "HOÀN TẤT" (chỉ final).
- **ReceiptPreview**: Định dạng thermal, max-w-sm.

---

## 5. Các component

### 5.1 FloorPlan (`src/components/staff/floor-plan.tsx`)

**Props:** `tables`, `sessions`, `onTableClick`

- Tính toán số bàn theo từng trạng thái để hiển thị stats.
- Render lưới `TableCard`.

---

### 5.2 TableCard (`src/components/staff/table-card.tsx`)

**Props:** `table`, `session`, `onClick`

**Hiển thị:**
- **Trống**: Tên bàn + số chỗ ngồi. Viền xám nhạt.
- **Serving**: Tên bàn + số món + tổng tiền. Viền vàng + dot vàng nhấp nháy.
- **Waiting Payment**: Tên bàn + số món + tổng tiền. Viền cam + dot cam nhấp nháy.

**Tính toán tiền trong card:**
- `submittedTotal`: Tổng các món đã đặt (đã gửi bếp).
- `pendingTotal`: Tổng các món đang chọn.
- `total = submittedTotal + pendingTotal`.
- Hiển thị `total` nếu > 0.

---

### 5.3 MenuPanel (`src/components/staff/menu-panel.tsx`)

**Props:** `pendingItems`, `onAdd`

**State:** `active` — ID danh mục đang chọn (mặc định là danh mục đầu tiên).

**Layout 2 cột:**
- **Cột trái** (w-20 sm:w-28): Danh sách danh mục dạng nút dọc. Danh mục active có nền vàng.
- **Cột phải**: Lưới 2 cột các món trong danh mục đang chọn.

**Mỗi item card:**
- Ảnh món (nếu có).
- Tên + giá.
- Nút **+** (gold): gọi `onAdd(item)` — toast hiện tên món.
- Badge số lượng (gold, góc trên phải): hiện khi `quantity > 0` trong pending.

**Hàm `parsePrice(price)`**: Tách ký tự số từ chuỗi giá (vd: "185.000đ" → 185000).

---

### 5.4 OrderSummary (`src/components/staff/order-summary.tsx`)

**Props:** `pendingItems`, `submittedOrders`, callbacks: `onUpdateItem`, `onRemoveItem`, `onSubmitOrder`, `onPay`, `onDraftReceipt`

**State:** `showConfirm: boolean` — dialog xác nhận đặt món.

**Layout:**
- **Header**: "Đang chọn" + tổng số món đang pending.
- **Phần submitted orders** (nếu có): Từng lần đặt được hiển thị dạng collapsed — giờ đặt + tổng tiền lần đó.
- **Phần pending items**: Từng món có:
  - Tên + giá.
  - Nút − / + để giảm/tăng quantity (giảm về 0 = xoá).
  - Nút × xoá trực tiếp.
  - Input ghi chú (placeholder "Ghi chú...").
- **Footer**: Tổng pending / Tổng đã đặt / Grand total, + 3 nút:
  - **ĐẶT MÓN** (xanh lá): Disabled nếu `pendingItems.length === 0`. Mở `showConfirm`.
  - **HĐ tạm** (xám): Disabled nếu `submittedOrders.length === 0`. Gọi `onDraftReceipt`.
  - **THANH TOÁN** (vàng): Disabled nếu `submittedOrders.length === 0`. Gọi `onPay`.

**Dialog xác nhận đặt món:**
- Liệt kê từng món, số lượng, thành tiền.
- Tổng cộng.
- 2 nút: HỦY / XÁC NHẬN.
- Khi xác nhận: gọi `onSubmitOrder()`, đóng dialog.

---

### 5.5 PaymentPanel (`src/components/staff/payment-panel.tsx`)

**Props:** `total`, `onConfirm`

**State:**
- `tab: 'cash' | 'transfer'`
- `received: number | ''` — số tiền khách đưa (tab tiền mặt).

**Hàm `generatePresets(total)`** (`src/data/tables.ts`): Tạo 4 mệnh giá tròn thích hợp để chọn nhanh. Ví dụ: total = 340.000đ → [340.000, 350.000, 400.000, 500.000].

**Tab TIỀN MẶT:**
- Dòng "Cần thu: X đồng" (vàng, nổi bật).
- 4 nút preset amount (vd: "350k", "1M") — chọn để điền vào ô nhập.
- Input nhập số tiền nhận thủ công.
- Dòng "Tiền thừa: X đồng" — xanh lá nếu có thừa, xám nếu chưa nhập.
- Nút "XÁC NHẬN THANH TOÁN".

**Tab CHUYỂN KHOẢN:**
- Ô QR code (SVG dummy, placeholder).
- Thông tin tài khoản: "1234 5678 90 — ACB — The Terminal".
- Số tiền cần chuyển.
- Nút "XÁC NHẬN ĐÃ NHẬN TIỀN".

---

### 5.6 InvoiceForm (`src/components/admin/invoice-form.tsx` trong staff)

**Props:** `onSubmit`, `onCancel`

**State:** `buyerName`, `buyerTaxCode`, `buyerAddress`, `buyerEmail`, `paymentMethod`

**Validation:** `canSubmit` = tất cả 4 trường đều có giá trị (sau trim).

**Giao diện:**
- Overlay toàn màn hình (fixed).
- Card trắng, trung tâm.
- 4 input (Tên đơn vị, Mã số thuế, Địa chỉ, Email).
- Tab chọn hình thức thanh toán: TIỀN MẶT | CHUYỂN KHOẢN.
- Nút HỦY / XUẤT HOÁ ĐƠN (disabled nếu !canSubmit).

---

### 5.7 InvoicePreview (`src/components/staff/invoice-preview.tsx`)

Render hoá đơn VAT theo đúng mẫu của Bộ Tài chính Việt Nam:

1. **Header**: Quốc huy Việt Nam, "HOÁ ĐƠN GIÁ TRỊ GIA TĂNG", ký hiệu AA/25E số 0000001.
2. **Thông tin người bán**: Tên, địa chỉ, mã số thuế, điện thoại.
3. **Thông tin người mua**: Tên đơn vị, địa chỉ, MST, email, hình thức thanh toán.
4. **Bảng hàng hoá**: STT / Tên hàng / ĐVT / Số lượng / Đơn giá (trước VAT) / Thành tiền.
5. **Tổng cộng**: Cộng tiền hàng (chưa VAT) / Thuế suất VAT X% / Tiền thuế / Tổng tiền thanh toán.
6. **Số tiền bằng chữ**.
7. **Ký tên**: Người mua hàng / Người bán hàng.
8. **Watermark "BẢN MẪU"** (`print:hidden`).

**CSS print**: Ẩn topbar, không có padding/shadow, in ra A4.

---

### 5.8 ReceiptDialog (`src/components/staff/receipt-dialog.tsx`)

**Props:** `tableId`, `tableLabel`, `orders`, `isDraft`, `onClose`, `onDone?`

Wrap `ReceiptPreview` trong modal overlay:
- Mobile: Full width, bottom-aligned (như bottom sheet).
- SM+: Căn giữa, max-w-sm.
- Nút in: mở `/staff/table/{id}/receipt?draft={isDraft}` trong tab mới (`window.open`).
- Nút "HOÀN TẤT" (chỉ hiện nếu `onDone` được truyền): gọi callback.
- Click outside → `onClose`.

---

### 5.9 ReceiptPreview (`src/components/staff/receipt-preview.tsx`)

Render phiếu thu/biên lai dạng **thermal printer** (khổ hẹp, tối giản):

1. **Header**: Tên nhà hàng (settings.restaurantName), địa chỉ, điện thoại.
2. **Tiêu đề**: "HOÁ ĐƠN TẠM" (nếu draft) hoặc "HOÁ ĐƠN".
3. **Meta**: Bàn, ngày, giờ.
4. **Đường kẻ phân cách**.
5. **Bảng món**: Tên / Số lượng × Đơn giá / Thành tiền.
   - `mergeOrderItems(orders)` — gộp cùng món từ nhiều lần đặt.
6. **Đường kẻ phân cách**.
7. **Tổng cộng** (in đậm).
8. **Ghi chú VAT**: "Giá đã bao gồm VAT 10%".
9. **Footer**: "Cảm ơn quý khách!".
10. **Watermark "BẢN TẠM"** nếu isDraft (`print:hidden`).

---

## 6. Business Logic

### 6.1 Tính tổng tiền

Toàn bộ giá menu là **giá đã bao gồm VAT**. Khi xuất hoá đơn VAT, hệ thống ngược chiết:

```
unitPrice (trước VAT) = priceNum / (1 + vatRate)
subtotal = total / (1 + vatRate)
vatAmount = total - subtotal
```

Làm tròn số nguyên (`Math.round`).

### 6.2 Gộp món (`mergeOrderItems`)

**File:** `src/lib/orders.ts`

Khi in hoá đơn/receipt, các món giống nhau từ nhiều lần đặt được gộp lại:

```typescript
mergeOrderItems(orders: SubmittedOrder[]): MergedItem[]
```

Duyệt qua từng order → từng item → nếu cùng `menuItemId` thì cộng dồn `quantity`.

### 6.3 Số tiền bằng chữ (`numberToWords`)

**File:** `src/lib/invoice.ts`

Chuyển số nguyên (đồng) sang chữ tiếng Việt:
- Xử lý theo nhóm: tỷ / triệu / nghìn / trăm.
- Quy tắc đặc biệt: "mốt" (21, 31...), "lăm" (5 sau chục), "linh" (đơn vị không có chục).
- Output: `"Một triệu hai trăm nghìn đồng"` (viết hoa chữ cái đầu).

### 6.4 Số hoá đơn

**localStorage key:** `terminal_invoice_counter`

Mỗi lần `buildInvoice()` được gọi (khi navigate đến `/invoice`), counter tăng 1 và lưu lại. Số hoá đơn: `counter.toString().padStart(7, '0')` → "0000001", "0000002"...

---

## 7. Dữ liệu localStorage

| Key | Nội dung | Mặc định |
|-----|----------|----------|
| `terminal_staff_sessions` | `Record<tableId, TableSession>` | `{}` |
| `terminal_menu_items` | `MenuItem[]` | 45 món mặc định |
| `terminal_categories` | `Category[]` | 10 danh mục |
| `terminal_tables` | `Table[]` | 12 bàn |
| `terminal_settings` | `AdminSettings` | pin=1234, vatRate=0.1 |
| `terminal_invoice_counter` | number | 0 |

**Tất cả dữ liệu đều tồn tại qua refresh và đóng tab.** Chỉ mất khi xoá localStorage hoặc xoá Session là xoá session đó.

---

## 8. Navigation Map

```
/staff                           ← Floor Plan (entry point nhân viên)
  ↓ click bàn trống
/staff/table/:id                 ← Đặt món
  ↓ THANH TOÁN (requestPayment)
/staff/table/:id/payment         ← Thu tiền
  ↓ XÁC NHẬN (cash/transfer)
/staff                           ← Floor Plan (session đóng)
  ↓ XUẤT VAT → điền form
/staff/table/:id/invoice         ← Hoá đơn VAT
  ↓ HOÀN TẤT
/staff                           ← Floor Plan (session đóng)

/staff/table/:id/receipt?draft=true   ← Hoá đơn tạm (mở tab mới khi in)
/staff/table/:id/receipt?draft=false  ← Biên lai chính thức (mở tab mới khi in)
```

---

## 9. UI / Giao diện

### Màu sắc

| Ngữ nghĩa | Class Tailwind |
|-----------|---------------|
| Nền tổng | `bg-brand-darker` (#0e0e0e) |
| Thẻ/card | `bg-[#111]`, `bg-[#1a1a1a]` |
| Viền mặc định | `border-[#2a2a2a]` |
| Text chính | `text-[#f5f0e8]` |
| Text mờ | `text-[#555]`, `text-[#888]` |
| Vàng brand | `text-gold` / `bg-gold` (`#C9A84C`) |
| Cam (chờ TT) | `text-orange-400`, `border-orange-500` |
| Xanh (đặt món) | `bg-emerald-800`, `text-emerald-300` |
| Đỏ (xoá) | `text-red-400` |

### Responsive

- **Mobile**: MenuPanel và OrderSummary hiển thị theo tab (chuyển đổi bằng tab bar).
- **lg+**: Hai panel song song — MenuPanel chiếm `~60%`, OrderSummary `~40%`.
- TableCard grid: 2 cột (mobile) → 3 (sm) → 4 (lg).
- ReceiptDialog: bottom sheet (mobile) → centered modal (sm+).

### Print

- Topbar và nút hành động ẩn khi in (`print:hidden`).
- Watermark "BẢN MẪU" / "BẢN TẠM" ẩn khi in.
- InvoicePreview: A4, reset padding/shadow.
- ReceiptPreview: thermal narrow format.
