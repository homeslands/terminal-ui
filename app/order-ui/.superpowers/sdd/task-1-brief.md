# Task: Restyle Public VAT Request Page theo landing-style (Hero + form tách biệt)

## Mục tiêu
Áp landing-page style (`src/app/client/home/page.tsx`) cho màn `src/app/public-vat-request/page.tsx`. Hướng đã chốt với user: **Hero giống landing (brick-wall + signboard + title gradient + eyebrow divider) — form section tách riêng trên `paper-card`** để giữ readability.

Scope: **chỉ sửa 1 file** `src/app/public-vat-request/page.tsx`. Không động vào file khác (CSS, schema, hooks, dialog đều giữ nguyên).

---

## Required reading (đọc TRƯỚC khi code)

1. `src/app/public-vat-request/page.tsx` — file đang sửa, hiểu structure hiện tại (LoadingCard, ErrorCard, SuccessCard, PublicForm, Field, inputClass).
2. `src/app/client/home/page.tsx` — reference Hero section (lines 47-150).
3. `src/index.css` lines 1894-2120 — định nghĩa các utility class landing: `text-grad-primary`, `text-grad-accent`, `brand-divider`, `signboard`, `paper-card`, `brick-wall`, `rivet`, `steam`, `sway`, `btn-brass`, `btn-brass-outline`.
4. Grep `landing-` trong `tailwind.config.js` (hoặc `tailwind.config.ts`) để xác nhận các color token Tailwind có sẵn: `landing-ink`, `landing-canvas`, `landing-brass`, `landing-gold-*`, `landing-rust`, `landing-rust-deep`, `landing-quartz`, `landing-paper-hi`, `landing-wood-900`, `landing-brass-light`, v.v.
5. `src/assets/images` — confirm `TerminalLogo` export tồn tại (landing import: `import { TerminalLogo } from '@/assets/images'`).

---

## Yêu cầu chi tiết

### 1. Wrapper trang (thay phần `<div className="min-h-screen bg-gradient-to-b ...">`)
- Đổi class wrapper thành `brick-wall` + relative + overflow hidden + min-h-screen + padding tương đương hiện tại (`px-4 py-8 md:py-12`).
- Thêm absolute overlay div đè dark gradient giống landing (copy đúng từ landing line 51-57):
  ```
  background: linear-gradient(180deg, rgba(20,12,4,.78) 0%, rgba(15,10,4,.82) 60%, rgba(8,5,2,.92) 100%)
  ```
- Thêm 2-3 `<div className="steam">` với `style={{ left: '12%' }}`, `left: '52%'`, `left: '85%'` và `animationDelay` lệch nhau (-2s, -4s). Không cần thêm CSS — class `steam` đã định nghĩa sẵn.
- Container `<div className="mx-auto flex w-full max-w-md flex-col gap-5 relative z-10">` (giữ max-w-md cho form đẹp ở mobile + desktop centered).

### 2. Header (signboard mini)
Thay hẳn block `<header>...Receipt icon + h1 + tagline...</header>`:
- Bọc trong `<div className="signboard relative w-full px-6 py-7">` — **KHÔNG dùng class `sway`** (form page không nên animate header để tránh phân tâm).
- 4 rivet ở 4 góc: `<span className="rivet" style={{ top: '8px', left: '8px' }} />` (và 3 vị trí còn lại).
- Bên trong `<div className="signboard-inner text-center">`:
  - Logo TerminalLogo: `<img src={TerminalLogo} alt="The Terminal" className="mx-auto mb-4 h-16 w-16 rounded-full object-cover ring-1 ring-landing-brass/30 md:h-20 md:w-20" />`
  - Eyebrow row (copy pattern landing lines 86-98):
    ```tsx
    <div className="mb-3 flex items-center justify-center gap-3">
      <span className="h-px w-8 md:w-12" style={{ background: 'linear-gradient(90deg, transparent, #c88d2b 70%, #ffe9a3)' }} />
      <span className="text-grad-accent text-[10px] font-medium tracking-[.4em] md:text-[11px]">
        {t('vat.publicEyebrow', 'HOÁ ĐƠN VAT')}
      </span>
      <span className="h-px w-8 md:w-12" style={{ background: 'linear-gradient(90deg, #ffe9a3, #c88d2b 30%, transparent)' }} />
    </div>
    ```
  - Title "The Terminal": `<h1 className="text-grad-primary whitespace-nowrap font-black uppercase leading-[.9] tracking-[.04em]" style={{ fontSize: 'clamp(1.5rem, 7vw, 2.75rem)' }}>The Terminal</h1>` (size nhỏ hơn landing vì context khác).
  - `<div className="brand-divider mx-auto mt-4" style={{ maxWidth: '180px' }} />`
  - Tagline: `<p className="mt-4 text-[11px] md:text-xs font-medium uppercase tracking-[.3em] text-landing-brass-light/85">{t('vat.publicTagline', 'Yêu cầu xuất hoá đơn VAT')}</p>`

### 3. Form container (`PublicForm`)
Thay form className:
- Bỏ `bg-white border shadow-sm`
- Dùng `paper-card rounded-md p-5 md:p-6` + `space-y-4`
- Text mặc định trong form là dark trên paper — không cần override, nhưng update các sub-element ở dưới.

### 4. Inputs (`inputClass` constant)
Đổi `inputClass` từ:
```
'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold'
```
thành:
```
'w-full rounded-md border border-landing-rust-900/30 bg-white/70 px-3 py-2 text-sm text-landing-ink placeholder:text-landing-ink/40 focus:border-landing-gold-400 focus:outline-none focus:ring-1 focus:ring-landing-gold-400'
```
(nếu token `landing-rust-900` không có ở Tailwind, fallback `border-amber-900/30`. Confirm bằng cách grep tailwind config TRƯỚC khi viết.)

### 5. Field labels (function `Field`)
- Label className đổi từ `text-sm font-medium` → `text-sm font-semibold text-landing-ink/85`
- Error text: giữ `text-red-500` OK
- Hint text: `text-landing-ink/55` thay vì `text-muted-foreground`

### 6. Warning box (amber)
Đổi từ `bg-amber-50 text-amber-800` sang tông phù hợp paper:
```tsx
<div className="flex items-start gap-2 rounded-md border border-landing-rust-900/25 bg-landing-paper-hi/60 p-3 text-xs text-landing-rust-deep">
```
(Fallback `bg-amber-50/80 text-amber-900 border-amber-700/30` nếu token landing-paper-hi/landing-rust-deep không có Tailwind alias.)

### 7. Submit Button
Thay `<Button>` (shadcn) bằng button thuần dùng `btn-brass`:
```tsx
<button
  type="submit"
  disabled={isPending}
  className="btn-brass w-full px-6 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {t('vat.submit', 'Gửi yêu cầu')}
</button>
```
Bỏ import `Button` nếu không còn chỗ dùng.

### 8. LoadingCard
Wrap bằng `paper-card rounded-md` + flex center:
```tsx
<div className="flex items-center justify-center rounded-md paper-card py-10">
  <Loader2 className="h-6 w-6 animate-spin text-landing-gold-400" />
</div>
```

### 9. ErrorCard
Giữ tông destructive nhưng đặt trên paper-card layer:
```tsx
<div className="paper-card flex flex-col items-center gap-3 rounded-md p-6 text-center">
  <AlertCircle className="h-10 w-10 text-destructive" />
  <p className="text-sm font-medium text-landing-rust-deep">{message}</p>
</div>
```

### 10. SuccessCard
Giữ tông emerald nhưng trên paper-card:
```tsx
<div className="paper-card flex flex-col items-center gap-3 rounded-md p-6 text-center">
  <div className="rounded-full bg-emerald-100 p-3">
    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
  </div>
  <h3 className="text-base font-semibold text-landing-ink">{title}</h3>
  <p className="text-sm text-landing-ink/75">{body}</p>
</div>
```

### 11. Imports
- Add: `import { TerminalLogo } from '@/assets/images'` (verify path đúng).
- Remove: `Receipt` (lucide) — không còn dùng.
- Remove: `Button` from `@/components/ui` (nếu không còn dùng).
- Keep: tất cả còn lại.

### 12. i18n
- Thêm key fallback `vat.publicEyebrow` với default 'HOÁ ĐƠN VAT' (gọi t() có fallback string sẵn — không cần thêm file translation).
- Tất cả i18n key khác giữ nguyên.

---

## Ràng buộc

### MUST
- Chỉ sửa duy nhất `src/app/public-vat-request/page.tsx`.
- Không thêm framer-motion vào trang này (form page tránh animate).
- Không dùng class `sway` cho signboard.
- Giữ nguyên logic: form schema, submit flow, dialog, hooks, error handling, console.error.
- Giữ Helmet title.
- Lint pass cho file đó: `npx eslint src/app/public-vat-request/page.tsx --fix` rồi `npx eslint src/app/public-vat-request/page.tsx`.
- TypeScript build pass: `npx tsc -b --noEmit` (hoặc `npm run build` — nếu nặng quá thì chỉ chạy `npx tsc --noEmit` trên dự án).
- Token Tailwind `landing-*`: **PHẢI grep `tailwind.config.*` trước khi dùng**. Nếu token không tồn tại, dùng arbitrary value `[#...]` hoặc fallback đã ghi ở từng mục trên. Đừng tự bịa token mới.

### MUST NOT
- Không tạo file mới.
- Không sửa CSS file.
- Không refactor logic không liên quan.
- Không xoá comment block JSDoc đầu file (`/** Public form page khách quét QR ... */`).
- Không thay đổi `route.ts`, `route` constants, hay router config.

---

## Verification (implementer phải chạy & report output)

1. `npx eslint src/app/public-vat-request/page.tsx` — không lỗi.
2. `npx tsc --noEmit` — không lỗi type cho file này (báo lại nếu có lỗi pre-existing ở file khác — không sửa).
3. Đọc lại diff cuối, confirm:
   - Wrapper là `brick-wall` + overlay + steam.
   - Header dùng `signboard` không kèm `sway`, có 4 rivet, có TerminalLogo, có eyebrow divider, có title gradient, có `brand-divider`.
   - Form trên `paper-card`.
   - Inputs có border landing-* tokens hoặc fallback đã ghi.
   - Submit button dùng `btn-brass`.
   - Loading/Error/Success đều trên `paper-card`.

Không bắt buộc chạy dev server (user sẽ test browser sau).

---

## Báo cáo
Ghi report vào file `.superpowers/sdd/task-1-report.md` (path tương đối từ repo root). Trong report bao gồm:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commits tạo (git log --oneline cho range BASE..HEAD)
- Test/lint commands chạy + output
- Self-review notes (bất cứ tradeoff nào, có dùng fallback token không, có concern nào không)
- Confirm tất cả 12 điểm requirement ở trên đã đạt
