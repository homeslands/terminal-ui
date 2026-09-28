# Chef Workflow Gap — POS Order Mutations vs Bếp Coordination

**Status**: Open — cần product + backend align.
**Raised by**: FE team, 2026-06-08
**Scope**: Cross-team (product, backend, FE chỉ visibility)

---

## Vấn đề

Hiện tại flow phục vụ tại bàn (`/staff/table/:id`) cho phép staff thực hiện các thao tác sau khi order đã được submit (bill chef đã in tự động):

| Thao tác | API | UI vị trí |
|---|---|---|
| Sửa quantity item đã submit | `PATCH /order-items/{slug}` | SubmittedOrdersDialog |
| Sửa note item đã submit | `PATCH /order-items/{slug}/note` | SubmittedOrdersDialog |
| Xóa item đã submit | `DELETE /order-items/{slug}` | SubmittedOrdersDialog |
| Hủy toàn bộ đơn | `DELETE /orders/{slug}` | Header "Hủy đơn" |
| Đổi bàn | `PATCH /orders/{slug}/change-table` | TransferTableDialog |

**Vấn đề**: bill chef đã in tự động cho bếp ngay khi order created. Các thao tác trên KHÔNG tự động in lại bill cập nhật / hủy bill cũ ở bếp. Bếp không biết về thay đổi → vẫn làm món theo bill cũ.

## Use case cụ thể bị ảnh hưởng

### Case 1: Khách hủy 1 món sau khi đã gọi

- Khách: "Em ơi bỏ giùm 1 cafe đen"
- Staff: vào SubmittedOrdersDialog, sửa quantity 1 → 0 → confirm
- BE: `DELETE /order-items/{slug}` thành công, UI báo OK
- **Bếp**: vẫn làm cafe theo bill cũ
- **Hậu quả**: cafe được làm, không có ai uống → bỏ đi, quán lỗ tiền

### Case 2: Khách giảm quantity từ 2 → 1

- Khách: "Em ơi bớt 1 phở, để 1 thôi"
- Staff sửa quantity → BE OK
- **Bếp**: vẫn làm 2 tô
- **Hậu quả**: 1 tô dư

### Case 3: Khách hủy nguyên đơn

- Khách: "Em không ăn nữa"
- Staff bấm "Hủy đơn" → `DELETE /orders/{slug}` OK
- **Bếp**: vẫn làm tất cả món đã in bill
- **Hậu quả**: lãng phí toàn bộ nguyên liệu đã chuẩn bị

### Case 4: Đổi bàn

- Khách: "Em chuyển sang bàn rộng hơn"
- Staff bấm "Đổi bàn" → `PATCH /orders/{slug}/change-table` OK, đơn server giờ thuộc bàn mới
- **Bếp**: vẫn nhìn bill có tên bàn CŨ
- **Hậu quả**: server bê món ra bàn cũ → tìm khách không thấy → confused

## Tại sao FE không thể tự fix

Bếp không có app/UI tương tác — chỉ in bill ra giấy qua printer subsystem (`src/utils/printer.ts` + chef-area network printer API). Thay đổi bill in vật lý là responsibility của:
- **Backend**: trigger in lại bill khi có mutation
- **Product**: định nghĩa khi nào in lại + nội dung bill ("HỦY", "CẬP NHẬT", "ĐỔI BÀN")
- **Hardware**: máy in chef có support in nhiều bill liên tiếp không

FE chỉ có thể call API mutation và hiển thị toast/dialog cho staff. Sau đó staff phải báo bếp **thủ công** (chạy xuống bếp nói trực tiếp, hoặc gọi qua bộ đàm).

## Đề xuất giải pháp (cần thảo luận)

### Option A: Backend tự động in lại bill khi có mutation
- Khi `DELETE /order-items` thành công → backend trigger printer in bill mới với header "ĐÃ XÓA: <tên món>"
- Khi `PATCH /order-items` (giảm qty) → in "CẬP NHẬT: <tên món> còn N phần"
- Khi `DELETE /orders` → in "HỦY ĐƠN: bàn X"
- Khi `PATCH /change-table` → in "ĐỔI BÀN: <cũ> → <mới>"

**Pros**: tự động, bếp luôn cập nhật.
**Cons**: tốn giấy, bếp có thể bị spam bill nếu staff sửa nhiều lần. Cần debounce hoặc batch.

### Option B: Lock down — không cho phép sửa sau khi bill đã in
- Sau khi `createOrder` thành công → server marks order là "printed" → các API mutation tiếp theo trả 403.
- Staff muốn sửa → phải "request manager override" hoặc cancel + tạo order mới.

**Pros**: tránh confusion với bếp hoàn toàn.
**Cons**: phá UX. Khách không thể đổi ý sau khi gọi.

### Option C: Hybrid — cho phép sửa nhưng có grace period
- Sau khi submit → có 2 phút "edit window" → sửa thoải mái, BE chưa fire printer.
- Sau 2 phút (hoặc khi chef confirm "đang làm") → lock + chỉ cho hủy với manager approval + in bill "HỦY".

**Pros**: balance UX và bếp coordination.
**Cons**: phức tạp implement, edge case xử lý chef status.

### Option D: Bếp screen riêng thay vì bill in giấy
- Chef-area có monitor hiển thị orders realtime.
- Mutation từ POS → instant update trên screen.
- Bếp tick "đang làm" / "xong" trên screen, staff thấy realtime.
- Bill giấy chỉ in khi đơn complete (để giao kèm).

**Pros**: hiện đại, no waste, perfect coordination.
**Cons**: hardware investment (tablet/monitor cho bếp). Đổi workflow lớn.

## Khuyến nghị

**Ngắn hạn (1-2 tuần)**: Option A — backend auto-print bill "CẬP NHẬT" / "HỦY" / "ĐỔI BÀN" cho các mutation thường gặp. Ít invasive nhất, addressing case 1-4 ngay.

**Dài hạn (3-6 tháng)**: Option D — chef screen. Đáng đầu tư nếu quán phục vụ ≥ 50 đơn/ngày. ROI từ giảm waste + tăng efficiency bếp.

**KHÔNG khuyến nghị Option B** — phá UX nghiêm trọng cho case khách đổi ý là chuyện bình thường.

## Câu hỏi cần product/backend trả lời

1. Quán target có máy in chef đủ tốc độ in nhiều bill liên tiếp không?
2. Workflow bếp hiện tại: bếp đọc bill rồi làm theo bill, hay có thêm step gì (vd: chef order screen ở chef-area)?
3. Tỉ lệ thực tế khách sửa/hủy sau khi đã gọi món? (đo lường tránh over-engineer)
4. Budget cho hardware nếu chọn Option D?
5. Compliance / kế toán: bill "HỦY" có cần lưu trữ riêng cho audit không?

## Liên quan FE code

Khi BE giải quyết, FE chỉ cần:
- Cập nhật toast messaging sau mutation (vd: "Đã xóa món + báo bếp tự động")
- Có thể remove warning bullet trong TransferTableDialog ("Bếp đã in ticket... — cần báo bếp") nếu Option A active
- Nếu Option C: thêm UI "Yêu cầu quản lý duyệt" cho mutation sau grace period
- Nếu Option D: implement chef screen page (đã có chef-area code base hiện tại?)

---

## Action items

- [ ] **Product**: review options trên + decide direction
- [ ] **Backend**: confirm capability của printer API + cost của auto-print logic
- [ ] **Operations/Owner**: thực tế đo tỉ lệ khách sửa/hủy + waste hiện tại
- [ ] **FE**: standby chờ decision, update UI/messaging tương ứng

---

*Doc này nên được share với product owner + backend lead. Có thể convert thành Linear/Jira ticket khi có owner.*
