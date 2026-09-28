# Tài liệu FE & Tester: Quản Lý Ca Làm (Work Shift)

> Dành cho: Frontend Developer + QA Tester  
> Base URL: `/api/v1` (hoặc theo config môi trường)  
> Auth: Bearer JWT token — tất cả endpoint đều yêu cầu header `Authorization: Bearer <token>`

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Format response chuẩn](#2-format-response-chuẩn)
3. [Phân quyền theo role](#3-phân-quyền-theo-role)
4. [Luồng nghiệp vụ](#4-luồng-nghiệp-vụ)
5. [Chi tiết API Endpoints](#5-chi-tiết-api-endpoints)
6. [Error Codes](#6-error-codes)
7. [Test Cases](#7-test-cases)

---

## 1. Tổng quan

Tính năng **Ca Làm (Work Shift)** cho phép **Thu Ngân (Cashier)** mở/đóng ca làm việc, quản lý doanh thu trong ca, và theo dõi các đơn hàng của nhân viên.

**Quy tắc cốt lõi:**
- Mỗi chi nhánh chỉ có tối đa **1 ca ACTIVE** tại một thời điểm
- Chỉ **Cashier** mới được mở/đóng ca — Manager/Admin không tạo ca sẵn
- **Staff không được tạo payment** — phải qua Cashier hoặc Manager
- Thanh toán chỉ được phép khi chi nhánh có ca **ACTIVE**
- Order có thể tạo khi không có ca (tạm lưu), sẽ được gán tự động khi cashier mở ca

---

## 2. Format Response Chuẩn

Mọi API đều trả về cấu trúc:

```json
{
  "message": "Human-readable message",
  "statusCode": 200,
  "timestamp": "2026-06-29T14:35:00.000Z",
  "result": { ... }
}
```

**Lỗi:**
```json
{
  "message": "Error description",
  "statusCode": 400,
  "timestamp": "2026-06-29T14:35:00.000Z",
  "result": null
}
```

**Paginated list:**
```json
{
  "result": {
    "data": [ ... ],
    "total": 100,
    "page": 1,
    "size": 10
  }
}
```

---

## 3. Phân quyền theo role

| Action | STAFF | CASHIER | MANAGER | ADMIN | SUPER_ADMIN |
|--------|:-----:|:-------:|:-------:|:-----:|:-----------:|
| Mở ca (`POST /open`) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Đóng ca (`PATCH /close`) | ❌ | ✅ (ca mình) | ❌ | ❌ | ❌ |
| Xem ca ACTIVE của mình (`GET /current`) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Xem danh sách ca ACTIVE (`GET /active`) | ❌ | ❌ | ✅ (branch) | ✅ | ✅ |
| Force-close ca (`PATCH /:slug/force-close`) | ❌ | ❌ | ✅ (branch) | ✅ | ✅ |
| Xem lịch sử ca (`GET /`) | ❌ | ✅ (của mình) | ✅ (branch) | ✅ | ✅ |
| Xem chi tiết / orders / invoices / staff | ❌ | ✅ (ca mình) | ✅ (branch) | ✅ | ✅ |
| Tạo order | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo payment | ❌ | ✅ | ✅ | ✅ | ✅ |

> **Lưu ý MANAGER**: Tự động lọc theo branch của mình, không cần truyền `branchSlug`.

---

## 4. Luồng nghiệp vụ

### Luồng A — Cashier đến trước Staff (thông thường)

```
1. Cashier đến → POST /work-shifts/open { openingCash: 500000 }
   → Ca ACTIVE được tạo

2. Staff tạo order → order.workShift = ca đang mở

3. Customer muốn thanh toán:
   Cashier/Manager gọi POST /payments/initiate
   → Validate có WorkShift ACTIVE → OK
   → Invoice được tạo với invoice.workShift = ca đang mở

4. Cuối ca: Cashier gọi PATCH /work-shifts/close { closingCash: 1200000 }
   → Ca CLOSED, thống kê được trả về
```

### Luồng B — Staff đến trước Cashier (Pre-shift Orders)

```
1. Cashier chưa mở ca
2. Staff tạo order → order.workShift = null (lưu tạm)
3. Cashier đến → POST /work-shifts/open { openingCash: 500000 }
   → Hệ thống tự tìm các order chưa có ca (workShift = null)
     có createdAt >= cutoffTime (xem bên dưới) thuộc cùng branch
   → Tự gán order.workShift = ca mới vừa mở
   → Response trả về preShiftOrdersLinked: <số order đã gán>
```

**Cutoff time cho pre-shift orders:**
- Nếu hôm nay đã có ca CLOSED → cutoff = `actualEndTime` của ca CLOSED gần nhất hôm nay
- Nếu hôm nay chưa có ca nào → cutoff = `00:00:00` ngày hôm nay

### Luồng C — Order Xuyên Ca (Cross-shift)

```
Ca A: [08:00 → 16:00]
Ca B: [16:00 → 00:00]

- 15:30: Staff tạo order → order.workShift = Ca A
- 16:00: Ca A đóng → khách chưa thanh toán
- 16:00: Ca B mở
- 16:20: Khách thanh toán (trong Ca B):
    → invoice.workShift = Ca B  (doanh thu tính vào Ca B ✅)
    → order.workShift = Ca A    (order vẫn thuộc Ca A)
    → Order này HIỂN THỊ trong Ca B (trong vòng 2h kể từ khi Ca A đóng) ✅
```

**Quy tắc hiển thị đơn xuyên ca khi GET orders của Ca B:**
1. **Đơn trực tiếp**: `order.workShift = Ca B`
2. **Đơn xuyên ca đã trả tiền**: tạo ở Ca A, có invoice với `workShift = Ca B`, invoice.createdAt trong vòng 2h kể từ khi Ca A đóng
3. **Đơn xuyên ca chưa trả tiền**: `order.workShift = Ca A`, status = PENDING — để Cashier Ca B xử lý

---

## 5. Chi tiết API Endpoints

### 5.1 Mở Ca

**`POST /work-shifts/open`**  
Role: `CASHIER`

**Request Body:**
```json
{
  "openingCash": 500000
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `openingCash` | number | ✅ | Tiền mặt đầu ca (>= 0) |

**Response `201`:**
```json
{
  "message": "Work shift opened successfully",
  "statusCode": 201,
  "timestamp": "2026-06-29T08:00:00.000Z",
  "result": {
    "slug": "ws-uuid-here",
    "cashier": {
      "slug": "user-uuid",
      "firstName": "Nguyen",
      "lastName": "Van A",
      "phonenumber": "0901234567"
    },
    "branch": {
      "slug": "branch-uuid",
      "name": "Chi nhánh Q1"
    },
    "actualStartTime": "2026-06-29T08:00:00.000Z",
    "actualEndTime": null,
    "status": "ACTIVE",
    "openingCash": 500000,
    "closingCash": null,
    "note": null,
    "createdAt": "2026-06-29T08:00:00.000Z",
    "totalOrders": 0,
    "totalInvoicesPaid": 0,
    "totalRevenue": 0,
    "preShiftOrdersLinked": 3
  }
}
```

> `preShiftOrdersLinked`: Số order đã được gán tự động vào ca (tạo trước khi ca mở).

**Lỗi phổ biến:**
- `400 BRANCH_HAS_ACTIVE_SHIFT` — Chi nhánh đã có ca đang ACTIVE

---

### 5.2 Đóng Ca

**`PATCH /work-shifts/close`**  
Role: `CASHIER` (đóng ca của chính mình)

**Request Body:**
```json
{
  "closingCash": 1200000,
  "note": "Ca buổi sáng bình thường"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `closingCash` | number | ❌ | Tiền mặt cuối ca (>= 0) |
| `note` | string | ❌ | Ghi chú khi đóng ca |

**Response `200`:**
```json
{
  "message": "Work shift closed successfully",
  "statusCode": 200,
  "timestamp": "2026-06-29T16:00:00.000Z",
  "result": {
    "workShift": {
      "slug": "ws-uuid-here",
      "cashier": { "slug": "...", "firstName": "Nguyen", "lastName": "Van A", "phonenumber": "..." },
      "branch": { "slug": "...", "name": "Chi nhánh Q1" },
      "actualStartTime": "2026-06-29T08:00:00.000Z",
      "actualEndTime": "2026-06-29T16:00:00.000Z",
      "status": "CLOSED",
      "openingCash": 500000,
      "closingCash": 1200000,
      "note": "Ca buổi sáng bình thường",
      "createdAt": "2026-06-29T08:00:00.000Z"
    },
    "openingCash": 500000,
    "closingCash": 1200000,
    "cashRevenue": 650000,
    "cashDifference": 50000,
    "paymentSummary": [
      {
        "paymentMethod": "cash",
        "displayName": "Tiền mặt",
        "totalAmount": 650000,
        "invoiceCount": 8
      },
      {
        "paymentMethod": "bank-transfer",
        "displayName": "Chuyển khoản",
        "totalAmount": 320000,
        "invoiceCount": 3
      }
    ],
    "totalRevenue": 970000,
    "totalOrders": 14,
    "totalInvoicesPaid": 11,
    "crossShiftOrdersCount": 2,
    "staffSummary": [
      {
        "staff": { "slug": "...", "firstName": "Tran", "lastName": "Thi B", "phonenumber": "..." },
        "totalOrdersCreated": 9,
        "totalOrdersRevenue": 580000
      }
    ],
    "totalStaffWorked": 2
  }
}
```

**Giải thích `cashDifference`:**
```
cashDifference = closingCash - openingCash - cashRevenue
               = 1,200,000 - 500,000 - 650,000 = 50,000 (thừa 50k)
```
- `> 0`: Thu ngân giữ thừa tiền mặt
- `< 0`: Thu ngân thiếu tiền mặt
- `= 0`: Khớp chính xác

**Lỗi phổ biến:**
- `400 NO_ACTIVE_SHIFT` — Cashier không có ca nào đang ACTIVE

---

### 5.3 Xem Ca ACTIVE Hiện Tại (Cashier)

**`GET /work-shifts/current`**  
Role: `CASHIER`

**Response `200`:**
```json
{
  "result": {
    "slug": "ws-uuid-here",
    "cashier": { ... },
    "branch": { ... },
    "actualStartTime": "2026-06-29T08:00:00.000Z",
    "actualEndTime": null,
    "status": "ACTIVE",
    "openingCash": 500000,
    "closingCash": null,
    "note": null,
    "createdAt": "2026-06-29T08:00:00.000Z",
    "totalOrders": 7,
    "totalInvoicesPaid": 5,
    "totalRevenue": 420000,
    "preShiftOrdersLinked": 0
  }
}
```

**Lỗi phổ biến:**
- `404 NO_ACTIVE_SHIFT` — Cashier không có ca nào đang mở

---

### 5.4 Xem Orders Trong Ca Hiện Tại

**`GET /work-shifts/current/orders`**  
Role: `CASHIER`

Trả về tất cả orders thuộc ca hiện tại, **bao gồm cross-shift orders** (2h rule).

**Response `200`:**
```json
{
  "result": [
    {
      "slug": "order-uuid",
      "referenceNumber": 1001,
      "status": "pending",
      "subtotal": 150000,
      "owner": { "slug": "...", "firstName": "Tran", "lastName": "Thi B" },
      "workShift": { "slug": "ws-uuid", "status": "ACTIVE" },
      "createdAt": "2026-06-29T09:30:00.000Z"
    }
  ]
}
```

---

### 5.5 Xem Invoices Trong Ca Hiện Tại

**`GET /work-shifts/current/invoices`**  
Role: `CASHIER`

Trả về tất cả invoice đã thanh toán trong ca (theo `invoice.workShift`).

**Response `200`:**
```json
{
  "result": [
    {
      "slug": "invoice-uuid",
      "referenceNumber": 5001,
      "paymentMethod": "cash",
      "amount": 150000,
      "status": "paid",
      "cashier": "Nguyen Van A",
      "createdAt": "2026-06-29T10:15:00.000Z"
    }
  ]
}
```

---

### 5.6 Xem Danh Sách Staff Trong Ca Hiện Tại

**`GET /work-shifts/current/staff`**  
Role: `CASHIER`

**Response `200`:**
```json
{
  "result": [
    {
      "staff": {
        "slug": "user-uuid",
        "firstName": "Tran",
        "lastName": "Thi B",
        "phonenumber": "0912345678"
      },
      "totalOrdersCreated": 9,
      "totalOrdersRevenue": 580000
    }
  ]
}
```

---

### 5.7 Xem Tổng Kết Ca Hiện Tại

**`GET /work-shifts/current/summary`**  
Role: `CASHIER`

Trả về `WorkShiftSummaryResponseDto` — xem [5.2](#52-đóng-ca) để biết cấu trúc đầy đủ.  
Với ca ACTIVE: `cashDifference = null` (chưa có closingCash).

---

### 5.8 Danh Sách Ca ACTIVE (Manager/Admin)

**`GET /work-shifts/active`**  
Role: `MANAGER`, `ADMIN`, `SUPER_ADMIN`

**Query params (ADMIN/SUPER_ADMIN):**
| Param | Type | Mô tả |
|-------|------|-------|
| `branchSlug` | string | Lọc theo chi nhánh |

> MANAGER: tự động lọc theo branch của mình — không cần truyền `branchSlug`.

**Response `200`:**
```json
{
  "result": [
    {
      "slug": "ws-uuid",
      "cashier": { "slug": "...", "firstName": "Nguyen", "lastName": "Van A", "phonenumber": "..." },
      "branch": { "slug": "...", "name": "Chi nhánh Q1" },
      "actualStartTime": "2026-06-29T08:00:00.000Z",
      "actualEndTime": null,
      "status": "ACTIVE",
      "openingCash": 500000,
      "closingCash": null,
      "note": null,
      "totalOrders": 12,
      "totalInvoicesPaid": 9,
      "totalRevenue": 870000,
      "preShiftOrdersLinked": 0
    }
  ]
}
```

---

### 5.9 Lịch Sử Ca Làm

**`GET /work-shifts`**  
Role: `CASHIER` (của mình), `MANAGER` (branch), `ADMIN`, `SUPER_ADMIN`

**Query params:**
| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang (default: 1) |
| `size` | number | Số item mỗi trang (default: 10) |
| `cashierSlug` | string | Lọc theo cashier (MANAGER+) |
| `branchSlug` | string | Lọc theo branch (ADMIN+) |
| `startDate` | string (ISO) | Từ ngày (ví dụ: `2026-06-01`) |
| `endDate` | string (ISO) | Đến ngày (ví dụ: `2026-06-30`) |
| `status` | `ACTIVE` \| `CLOSED` | Lọc theo trạng thái |

**Response `200`:**
```json
{
  "result": {
    "data": [
      {
        "slug": "ws-uuid",
        "cashier": { ... },
        "branch": { ... },
        "actualStartTime": "2026-06-29T08:00:00.000Z",
        "actualEndTime": "2026-06-29T16:00:00.000Z",
        "status": "CLOSED",
        "openingCash": 500000,
        "closingCash": 1200000,
        "note": "Ca sáng",
        "totalOrders": 14,
        "totalInvoicesPaid": 11,
        "totalRevenue": 970000,
        "preShiftOrdersLinked": 0
      }
    ],
    "total": 25,
    "page": 1,
    "size": 10
  }
}
```

---

### 5.10 Chi Tiết Một Ca

**`GET /work-shifts/:slug`**  
Role: `CASHIER` (ca của mình), `MANAGER` (branch), `ADMIN`, `SUPER_ADMIN`

**Response `200`:** Trả về `WorkShiftResponseDto` — cấu trúc như phần tử trong list ở [5.9](#59-lịch-sử-ca-làm).

**Lỗi phổ biến:**
- `404 WORK_SHIFT_NOT_FOUND`
- `403 WORK_SHIFT_FORBIDDEN` — Cashier xem ca của người khác

---

### 5.11 Orders Của Một Ca Cụ Thể

**`GET /work-shifts/:slug/orders`**  
Role: `CASHIER` (ca của mình), `MANAGER` (branch), `ADMIN`, `SUPER_ADMIN`

Bao gồm cross-shift orders (2h rule). Cấu trúc response giống [5.4](#54-xem-orders-trong-ca-hiện-tại).

---

### 5.12 Invoices Của Một Ca Cụ Thể

**`GET /work-shifts/:slug/invoices`**  
Role: `CASHIER` (ca của mình), `MANAGER` (branch), `ADMIN`, `SUPER_ADMIN`

---

### 5.13 Staff Của Một Ca Cụ Thể

**`GET /work-shifts/:slug/staff`**  
Role: `CASHIER` (ca của mình), `MANAGER` (branch), `ADMIN`, `SUPER_ADMIN`

---

### 5.14 Tổng Kết Một Ca Cụ Thể

**`GET /work-shifts/:slug/summary`**  
Role: `CASHIER` (ca của mình), `MANAGER` (branch), `ADMIN`, `SUPER_ADMIN`

Cấu trúc response giống `closeShift` ở [5.2](#52-đóng-ca).

---

### 5.15 Force-Close Ca (Manager/Admin)

**`PATCH /work-shifts/:slug/force-close`**  
Role: `MANAGER` (branch), `ADMIN`, `SUPER_ADMIN`

Dùng khi cashier quên đóng ca hoặc ca bị treo.

**Request Body:**
```json
{
  "note": "Force close do thu ngan quen dong ca"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `note` | string | ✅ | Lý do force-close (bắt buộc) |

**Response `200`:** Trả về `WorkShiftSummaryResponseDto` — cấu trúc như [5.2](#52-đóng-ca).

**Lỗi phổ biến:**
- `400 WORK_SHIFT_NOT_ACTIVE` — Ca đã CLOSED rồi
- `404 WORK_SHIFT_NOT_FOUND`
- `403 WORK_SHIFT_FORBIDDEN` — MANAGER cố force-close ca của branch khác

---

## 6. Error Codes

| Code | HTTP | Constant | Message |
|------|------|----------|---------|
| 161000 | 404 | `WORK_SHIFT_NOT_FOUND` | Không tìm thấy ca làm việc |
| 161001 | 400 | `WORK_SHIFT_BRANCH_HAS_ACTIVE` | Chi nhánh đã có ca làm việc đang hoạt động |
| 161002 | 400 | `WORK_SHIFT_NO_ACTIVE` | Không tìm thấy ca làm việc đang hoạt động cho thu ngân này |
| 161003 | 400 | `WORK_SHIFT_BRANCH_NO_ACTIVE` | Không có ca làm việc đang mở. Vui lòng liên hệ thu ngân để mở ca trước khi thanh toán |
| 161004 | 403 | `WORK_SHIFT_FORBIDDEN` | Không có quyền truy cập ca làm việc này |
| 161005 | 400 | `WORK_SHIFT_NOT_ACTIVE` | Ca làm việc này không đang ACTIVE |
| 161006 | 403 | `WORK_SHIFT_PAYMENT_FORBIDDEN_FOR_STAFF` | Nhân viên không có quyền tạo thanh toán. Vui lòng liên hệ thu ngân |

**Lỗi chung (không phải work-shift):**
| HTTP | Trường hợp |
|------|-----------|
| `401 Unauthorized` | Token hết hạn hoặc không có |
| `403 Forbidden` | Role không có quyền gọi endpoint này |
| `422 Unprocessable Entity` | Validation lỗi (sai kiểu dữ liệu, thiếu field bắt buộc) |

---

## 7. Test Cases

### TC-001: Cashier mở ca thành công

**Precondition:** User có role `CASHIER`, chi nhánh chưa có ca ACTIVE.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `POST /work-shifts/open` với `openingCash: 500000` | `201`, result có `status: "ACTIVE"`, `actualEndTime: null` |
| 2 | `GET /work-shifts/current` | `200`, trả về ca vừa tạo |

---

### TC-002: Không cho mở 2 ca cùng lúc

**Precondition:** Chi nhánh đã có 1 ca ACTIVE.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `POST /work-shifts/open` một lần nữa (cùng cashier hoặc cashier khác cùng branch) | `400`, error code `161001 BRANCH_HAS_ACTIVE_SHIFT` |

---

### TC-003: Cashier đóng ca thành công

**Precondition:** Cashier đang có ca ACTIVE.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `PATCH /work-shifts/close` với `closingCash: 1200000` | `200`, `status: "CLOSED"`, `actualEndTime` được set |
| 2 | `GET /work-shifts/current` | `404 NO_ACTIVE_SHIFT` |

---

### TC-004: Pre-shift orders được gán khi mở ca

**Precondition:** Không có ca ACTIVE; đã có order với `workShift = null` tạo sau 00:00 hôm nay.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `POST /work-shifts/open` | `preShiftOrdersLinked > 0` trong response |
| 2 | `GET /work-shifts/current/orders` | Các pre-shift orders xuất hiện trong danh sách |

---

### TC-005: Thanh toán bị chặn khi không có ca ACTIVE

**Precondition:** Chi nhánh không có ca nào ACTIVE.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Gọi `POST /payments/initiate` (Cashier hoặc Manager) | `400`, error code `161003 WORK_SHIFT_BRANCH_NO_ACTIVE` |

---

### TC-006: Staff không được tạo payment

**Precondition:** User có role `STAFF`, chi nhánh có ca ACTIVE.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `POST /payments/initiate` với token của Staff | `403`, error code `161006 PAYMENT_FORBIDDEN_FOR_STAFF` |

---

### TC-007: Cross-shift order hiển thị trong ca kế tiếp (2h rule)

**Precondition:** Ca A đã đóng lúc 16:00, Ca B đang ACTIVE mở lúc 16:00.  
Order X tạo trong Ca A lúc 15:30, chưa thanh toán.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Cashier Ca B gọi `GET /work-shifts/current/orders` ngay sau khi mở ca | Order X **xuất hiện** (chưa thanh toán, trong 2h window) |
| 2 | Thanh toán Order X lúc 16:20 | Invoice tạo với `workShift = Ca B` |
| 3 | `GET /work-shifts/current/invoices` | Invoice của Order X xuất hiện trong Ca B |
| 4 | `GET /work-shifts/:slugCaA/summary` | `cashRevenue` của Ca A **không** bao gồm invoice này |
| 5 | `GET /work-shifts/current/summary` | `totalRevenue` của Ca B **bao gồm** invoice này |

---

### TC-008: Cross-shift order sau 2h không hiển thị

**Precondition:** Ca A đóng lúc 08:00 sáng, Ca B mở lúc 09:00 sáng.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Có order tạo trong Ca A lúc 07:00 (chưa trả tiền) | |
| 2 | Thanh toán order này lúc 10:30 (> 2h sau khi Ca A đóng) | Invoice `workShift = Ca B` |
| 3 | `GET /work-shifts/current/orders` (Ca B) | Order này **không** xuất hiện trong danh sách orders của Ca B (quá 2h) |
| 4 | `GET /work-shifts/current/invoices` | Invoice vẫn xuất hiện (doanh thu vẫn tính vào Ca B) |

---

### TC-009: Manager xem ca theo branch

**Precondition:** User có role `MANAGER`.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `GET /work-shifts` (không truyền `branchSlug`) | Chỉ trả về ca của branch mình |
| 2 | `GET /work-shifts?cashierSlug=<slug>` | Lọc thêm theo cashier trong branch |
| 3 | `GET /work-shifts/active` | Chỉ ca ACTIVE của branch mình |

---

### TC-010: Force-close ca bị treo

**Precondition:** User có role `MANAGER` hoặc `ADMIN`; có 1 ca ACTIVE.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `PATCH /work-shifts/:slug/force-close` **không** có `note` | `422 Unprocessable Entity` (note bắt buộc) |
| 2 | `PATCH /work-shifts/:slug/force-close` với `note: "Force close"` | `200`, `status: "CLOSED"` |
| 3 | `PATCH /work-shifts/:slug/force-close` lần nữa (cùng slug) | `400 WORK_SHIFT_NOT_ACTIVE` |

---

### TC-011: Cashier không xem ca của người khác

**Precondition:** Cashier A và Cashier B đều có ca.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Cashier A gọi `GET /work-shifts/:slugCaB` (slug ca của B) | `403 WORK_SHIFT_FORBIDDEN` |
| 2 | Cashier A gọi `GET /work-shifts/current` | Trả về ca của chính Cashier A |

---

### TC-012: Admin xem tất cả ca

**Precondition:** User có role `ADMIN` hoặc `SUPER_ADMIN`.

| Step | Action | Expected |
|------|--------|----------|
| 1 | `GET /work-shifts` (không filter) | Trả về tất cả ca mọi branch, phân trang |
| 2 | `GET /work-shifts?branchSlug=<slug>` | Lọc theo branch cụ thể |
| 3 | `GET /work-shifts?cashierSlug=<slug>` | Lọc theo cashier cụ thể |
| 4 | `GET /work-shifts?startDate=2026-06-01&endDate=2026-06-30` | Lọc theo khoảng ngày |
| 5 | `GET /work-shifts?status=ACTIVE` | Chỉ ca đang mở |

---

### TC-013: Validation openingCash

| Step | Action | Expected |
|------|--------|----------|
| 1 | `POST /work-shifts/open` với `openingCash: -1000` | `422` validation error |
| 2 | `POST /work-shifts/open` không có `openingCash` | `422` validation error |
| 3 | `POST /work-shifts/open` với `openingCash: "abc"` | `422` validation error |
| 4 | `POST /work-shifts/open` với `openingCash: 0` | `201` — hợp lệ (0 là giá trị cho phép) |

---

## Phụ lục: Data Models Nhanh

### WorkShiftBasicDto
```typescript
{
  slug: string
  cashier: { slug, firstName, lastName, phonenumber }
  branch: { slug, name }
  actualStartTime: string (ISO)
  actualEndTime: string | null
  status: "ACTIVE" | "CLOSED"
  openingCash: number
  closingCash: number | null
  note: string | null
  createdAt: string (ISO)
}
```

### WorkShiftResponseDto (extends Basic)
```typescript
{
  ...WorkShiftBasicDto,
  totalOrders: number           // Đơn trực tiếp (order.workShift = this)
  totalInvoicesPaid: number     // Số invoice đã thanh toán
  totalRevenue: number          // Tổng doanh thu (từ invoice)
  preShiftOrdersLinked: number  // Pre-shift orders đã gán (chỉ khi mở ca)
}
```

### WorkShiftSummaryResponseDto
```typescript
{
  workShift: WorkShiftBasicDto
  openingCash: number
  closingCash: number | null
  cashRevenue: number                    // Tiền mặt thực thu
  cashDifference: number | null          // null khi ca còn ACTIVE
  paymentSummary: [
    { paymentMethod, displayName, totalAmount, invoiceCount }
  ]
  totalRevenue: number
  totalOrders: number
  totalInvoicesPaid: number
  crossShiftOrdersCount: number
  staffSummary: [
    { staff: UserBasicDto, totalOrdersCreated, totalOrdersRevenue }
  ]
  totalStaffWorked: number
}
```

### Payment Methods
| paymentMethod | displayName |
|---------------|-------------|
| `cash` | Tiền mặt |
| `bank-transfer` | Chuyển khoản |
| `credit-card` | Thẻ tín dụng |
| `point` | Xu |
