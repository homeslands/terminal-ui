# 📋 Audit Logs


1. **Audit Logs** (`/audit-logs`) – xem lịch sử thay đổi dữ liệu.
2. **Audit Logs Config** (`/audit-logs-config`) – bật/tắt việc theo dõi (audit) cho từng entity.


---

## 1. Lấy danh sách Audit Logs

```
GET /audit-logs
```

**Quyền (role):** `SuperAdmin`, `Admin`

### Query params

| Param        | Kiểu     | Bắt buộc | Mô tả                                                                 |
| ------------ | -------- | -------- | --------------------------------------------------------------------- |
| `user`       | string   | Không    | Lọc theo **slug** của user thực hiện hành động                        |
| `entity`     | string   | Không    | Lọc theo tên entity bị tác động (vd: `Order`, `User`). So khớp `LIKE` |
| `event`      | enum     | Không    | Lọc theo loại sự kiện: `Create` \| `Update` \| `Delete`               |
| `hasPaging`  | boolean  | Không    | Mặc định `true`. Nếu `false` → trả về **toàn bộ**, không phân trang   |
| `page`       | number   | Không    | Mặc định `1`                                                          |
| `size`       | number   | Không    | Mặc định `10`                                                         |
| `sort`       | string[] | Không    | vd `createdAt:desc` (server hiện luôn sắp xếp `createdAt DESC`)        |

> ⚠️ `event` phân biệt hoa-thường: phải gửi đúng `Create` / `Update` / `Delete` (viết hoa chữ cái đầu).

### Response

```jsonc
{
  "message": "The audit logs have been retrieved successfully",
  "statusCode": 200,
  "timestamp": "2026-06-20T08:00:00.000Z",
  "result": {
    "items": [
      {
        "slug": "log-abc123",
        "createdAt": "2026-06-20T07:55:12.000Z",
        "userSlug": "user-xyz",
        "user": "John Doe",               // tên hiển thị của người thực hiện
        "event": "Update",                 // Create | Update | Delete
        "entity": "Order",                 // entity bị tác động
        "from": { "status": "pending" },   // giá trị TRƯỚC (null nếu Create)
        "to":   { "status": "paid" }       // giá trị SAU  (null nếu Delete)
      }
    ],
    "total": 124,
    "page": 1,
    "pageSize": 10,
    "totalPages": 13,
    "hasNext": true,
    "hasPrevios": false   
  }
}
```

### Cách render thay đổi (`from` / `to`)

- **Create**: `from = null`, `to` = object dữ liệu mới.
- **Update**: cả `from` và `to` đều có → so sánh từng field để hiển thị *"giá trị cũ → giá trị mới"*.
- **Delete**: `to = null`, `from` = dữ liệu đã bị xóa.

---

## 2. Lấy danh sách cấu hình theo dõi (Config)

```
GET /audit-logs-config
```

**Quyền:** `Manager`, `Admin`, `SuperAdmin`

Dùng để hiển thị bảng "Các entity nào đang được audit". Backend tự seed sẵn tất cả entity
(trừ các entity nhạy cảm như token, connector config…).

### Response

```jsonc
{
  "message": "The audit watch configs retrieved successfully",
  "statusCode": 200,
  "timestamp": "...",
  "result": [
    {
      "slug": "slug-1234",
      "entity": "Order",
      "enabled": true,
      "createdAt": "...",
      "updatedAt": "..."
    },
    { "slug": "slug-5678", "entity": "User", "enabled": false }
  ]
}
```

---

## 3. Bật / tắt theo dõi cho một entity

```
PATCH /audit-logs-config
```

**Quyền:** `Manager`, `Admin`, `SuperAdmin`

### Body

```jsonc
{
  "slug": "slug-1234",   // slug của config (lấy từ API GET ở mục 2)
  "enabled": true         // true = bật audit, false = tắt
}
```

### Response

```jsonc
{
  "message": "The audit watch config updated successfully",
  "statusCode": 200,
  "result": { "slug": "slug-1234", "entity": "Order", "enabled": true }
}
```

> Dùng cho UI dạng **toggle switch** trên mỗi dòng entity. Sau khi PATCH thành công nên
> cập nhật state local hoặc refetch lại API GET config.

---
