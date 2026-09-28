# Tài liệu tính năng: Yêu cầu xuất hóa đơn VAT

> Dành cho: **Frontend Developer** & **Tester**

---

## Tổng quan nghiệp vụ

Sau khi một đơn hàng được thanh toán, hệ thống cho phép khách hàng điền thông tin để yêu cầu xuất hóa đơn VAT. Luồng hoạt động:

1. Nhân viên hoặc khách bấm **"Lấy link VAT"** trên màn hình chi tiết order → hệ thống trả về 1 đường link dạng `/vat-request/{invoiceSlug}`
2. Khách mở link đó → thấy form điền thông tin
3. Khách submit → hệ thống lưu yêu cầu và gửi email xác nhận
4. Kế toán xem danh sách yêu cầu và cập nhật trạng thái xử lý

---

## Điều kiện tiên quyết

- Order phải ở trạng thái **`paid`**, **`completed`**, hoặc **`shipping`** mới lấy được link VAT.
- Mỗi invoice chỉ được submit **đúng 1 lần**. Submit lần 2 sẽ trả về lỗi `409 Conflict`.

---

## Luồng cho Frontend

### Bước 1 — Lấy link VAT (màn hình chi tiết order)

```
POST /orders/:orderSlug/vat-link
Authorization: Bearer {token}
```

**Response thành công:**
```json
{
  "statusCode": 200,
  "message": "VAT link retrieved successfully",
  "result": {
    "url": "/vat-request/INV-2026-001"
  }
}
```

> FE dùng `result.url` để hiển thị link hoặc tạo QR code cho khách quét.

**Các lỗi có thể gặp:**

| HTTP | Nguyên nhân |
|---|---|
| 404 | Order không tồn tại |
| 400 | Order chưa thanh toán |

---

### Bước 2 — Kiểm tra trạng thái trước khi render form (trang public)

Khi khách mở link `/vat-request/{invoiceSlug}`, FE cần gọi API này trước để biết hiển thị form hay thông báo "đã gửi".

```
GET /vat-request/public/:invoiceSlug
```

**Response — chưa có yêu cầu (hiển thị form):**
```json
{
  "statusCode": 200,
  "result": {
    "invoiceSlug": "INV-2026-001",
    "status": "AVAILABLE"
  }
}
```

**Response — đã submit rồi (hiển thị thông báo):**
```json
{
  "statusCode": 200,
  "result": {
    "invoiceSlug": "INV-2026-001",
    "status": "SUBMITTED"
  }
}
```

> Nếu `status = "SUBMITTED"` → hiển thị thông báo "Yêu cầu của bạn đã được ghi nhận, vui lòng kiểm tra email."

---

### Bước 3 — Submit form VAT (trang public)

```
POST /vat-request/public/:invoiceSlug
Content-Type: application/json
```

**Request body:**
```json
{
  "customerName": "Công ty TNHH ABC",
  "taxCode": "0123456789",
  "address": "123 Nguyễn Huệ, Quận 1, TP.HCM",
  "email": "ketoan@abc.com",
  "companyName": "Công ty TNHH ABC",
  "note": "Ghi chú thêm nếu có"
}
```

**Validation các trường:**

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `customerName` | Có | Chuỗi ký tự |
| `taxCode` | Có | Đúng 10 hoặc 13 chữ số |
| `address` | Có | Chuỗi ký tự |
| `email` | Có | Đúng định dạng email |
| `companyName` | Không | Chuỗi ký tự |
| `note` | Không | Chuỗi ký tự |

**Response thành công (`201`):**
```json
{
  "statusCode": 201,
  "message": "VAT request submitted successfully",
  "result": {
    "slug": "VAT-xxxxxx",
    "status": "PENDING",
    "customerName": "Công ty TNHH ABC",
    "taxCode": "0123456789",
    "address": "123 Nguyễn Huệ, Quận 1, TP.HCM",
    "email": "ketoan@abc.com",
    "createdAt": "2026-06-19T10:00:00.000Z"
  }
}
```

**Các lỗi có thể gặp:**

| HTTP | Nguyên nhân |
|---|---|
| 400 | Validation thất bại (sai taxCode, thiếu trường bắt buộc...) |
| 404 | Invoice không tồn tại |
| 409 | Đã có yêu cầu VAT cho invoice này rồi |

> Sau khi submit thành công, khách nhận email xác nhận tại địa chỉ email đã điền.

---

### Bước 4 — Quản lý chỉnh sửa thông tin (khi khách điền nhầm)

```
PATCH /vat-request/:slug
Authorization: Bearer {token}  (Role: Manager / Admin / SuperAdmin)
Content-Type: application/json
```

Tất cả các trường đều **tùy chọn** — chỉ gửi trường cần sửa.

**Request body:**
```json
{
  "customerName": "Công ty XYZ",
  "taxCode": "9876543210",
  "address": "456 Lê Lợi, Q.1, TP.HCM",
  "email": "new@xyz.com",
  "companyName": "Công ty TNHH XYZ",
  "note": "Ghi chú mới"
}
```

**Validation:**

| Trường | Quy tắc (nếu gửi) |
|---|---|
| `taxCode` | Đúng 10 hoặc 13 chữ số |
| `email` | Đúng định dạng email |
| Các trường còn lại | Chuỗi ký tự |

**Các lỗi có thể gặp:**

| HTTP | Nguyên nhân |
|---|---|
| 400 | Validation thất bại |
| 403 | Không đủ quyền (role Staff hoặc thấp hơn) |
| 404 | VAT request không tồn tại |

---

### Bước 5 — Kế toán cập nhật thông tin nội bộ (số hóa đơn, ghi chú)

```
PATCH /vat-request/:slug/accountant-info
Authorization: Bearer {token}  (Role: Manager / Admin / SuperAdmin)
Content-Type: application/json
```

Tất cả các trường đều **tùy chọn** — chỉ gửi trường cần cập nhật.

**Request body:**
```json
{
  "invoiceNumber": "HD-2026-001",
  "accountantNote": "Đã kiểm tra thông tin, đang chờ phát hành"
}
```

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| `invoiceNumber` | Không | Số hóa đơn VAT đã/sẽ phát hành |
| `accountantNote` | Không | Ghi chú nội bộ của kế toán |

**Các lỗi có thể gặp:**

| HTTP | Nguyên nhân |
|---|---|
| 403 | Không đủ quyền (role Staff hoặc thấp hơn) |
| 404 | VAT request không tồn tại |

---

### Bước 6 — Kế toán xem danh sách yêu cầu (trang admin)

```
GET /vat-request?status=PENDING&page=1&size=20
Authorization: Bearer {token}  (Role: Manager / Admin / SuperAdmin)
```

**Query params:**

| Param | Bắt buộc | Mô tả |
|---|---|---|
| `status` | Không | Lọc theo trạng thái: `PENDING`, `PROCESSING`, `COMPLETED`, `REJECTED` |
| `page` | Không | Trang hiện tại (mặc định: 1) |
| `size` | Không | Số bản ghi mỗi trang (mặc định: 10) |

---

### Bước 7 — Kế toán cập nhật trạng thái

```
PATCH /vat-request/:slug/status
Authorization: Bearer {token}  (Role: Manager / Admin / SuperAdmin)
Content-Type: application/json
```

**Request body:**
```json
{
  "status": "COMPLETED",
  "invoiceNumber": "HD-2026-001",
  "note": "Đã phát hành hóa đơn"
}
```

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| `status` | Có | Một trong 4 giá trị bên dưới |
| `invoiceNumber` | Không | Số hóa đơn VAT đã phát hành |
| `note` | Không | Ghi chú nội bộ của kế toán |

---

## Trạng thái yêu cầu VAT

```
PENDING → PROCESSING → COMPLETED
                    ↘ REJECTED
```

| Status | Ý nghĩa | Hiển thị cho khách |
|---|---|---|
| `PENDING` | Chờ kế toán xử lý | "Yêu cầu đang chờ xử lý" |
| `PROCESSING` | Kế toán đang xử lý | "Đang xử lý" |
| `COMPLETED` | Đã xuất hóa đơn, đã gửi mail | "Hoàn thành" |
| `REJECTED` | Từ chối (thông tin sai, hết hạn...) | "Yêu cầu bị từ chối" |

---

## Kịch bản test

### ✅ Happy path
1. Tạo order → thanh toán thành công
2. Gọi `POST /orders/:slug/vat-link` → nhận về URL
3. Gọi `GET /vat-request/public/:invoiceSlug` → status `AVAILABLE`
4. Submit form với thông tin hợp lệ → `201`, nhận email xác nhận
5. Gọi lại `GET /vat-request/public/:invoiceSlug` → status `SUBMITTED`
6. Gọi `PATCH /vat-request/:slug/status` với `COMPLETED` → thành công

### ❌ Error cases
| Tình huống | API | Kết quả mong đợi |
|---|---|---|
| Order chưa thanh toán | `POST /orders/:slug/vat-link` | `400` Order is not paid |
| Order không tồn tại | `POST /orders/:slug/vat-link` | `404` Order not found |
| Submit form lần 2 | `POST /vat-request/public/:invoiceSlug` | `409` Already exists |
| `taxCode` 9 chữ số | `POST /vat-request/public/:invoiceSlug` | `400` Validation error |
| `taxCode` 11 chữ số | `POST /vat-request/public/:invoiceSlug` | `400` Validation error |
| Email sai định dạng | `POST /vat-request/public/:invoiceSlug` | `400` Validation error |
| Thiếu `customerName` | `POST /vat-request/public/:invoiceSlug` | `400` Validation error |
| InvoiceSlug không tồn tại | `GET /vat-request/public/:invoiceSlug` | `400` Invoice not found |
| Kế toán dùng role Staff | `GET /vat-request` | `403` Forbidden |
| Sửa thông tin với role Staff | `PATCH /vat-request/:slug` | `403` Forbidden |
| Sửa `taxCode` thành 9 chữ số | `PATCH /vat-request/:slug` | `400` Validation error |
| Sửa VAT request không tồn tại | `PATCH /vat-request/:slug` | `404` Not found |
| Cập nhật accountant info với role Staff | `PATCH /vat-request/:slug/accountant-info` | `403` Forbidden |
| Cập nhật accountant info — VAT không tồn tại | `PATCH /vat-request/:slug/accountant-info` | `404` Not found |

### 📧 Email
- Sau khi submit form thành công → kiểm tra hòm thư tại địa chỉ email đã điền có nhận được email xác nhận không.
- Subject: `[The Terminal] Xác nhận yêu cầu xuất hóa đơn VAT`
- Nội dung: tóm tắt thông tin đã gửi, số hóa đơn tham chiếu.

---

## Lưu ý cho FE

- Endpoint `GET` và `POST /vat-request/public/*` là **public** (không cần token).
- Endpoint `POST /orders/:slug/vat-link` yêu cầu **auth token** (nhân viên hoặc khách đã đăng nhập).
- Rate limit: public endpoint giới hạn **30 req/phút** cho GET, **10 req/phút** cho POST.
- Trang `/vat-request/{invoiceSlug}` là trang **độc lập, không cần đăng nhập** — thiết kế phù hợp để khách mở từ QR code.
