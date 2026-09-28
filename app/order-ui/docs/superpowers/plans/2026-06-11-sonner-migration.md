# Migration: react-hot-toast → Sonner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Thay react-hot-toast bằng Sonner để có UI/UX chuẩn ngành: stack animation, swipe dismiss, action buttons, description slot, native dark/light, A11y tốt hơn. Migration ít disruptive vì 724 callers đều dùng wrapper utils → chỉ cần đổi 4 file source.

**Tech Stack:** React 18, Vite, Tailwind, shadcn ecosystem (Sonner là toast lib shadcn ship sẵn).

**Risk level:** Low. Util signatures GIỮ NGUYÊN — caller code không đổi. Diff tập trung 4 file. Easy revert nếu cần.

---

## Audit (đã verify)

### Files import `react-hot-toast` (4 files)
1. `src/main.tsx:3` — `<Toaster>` mount
2. `src/utils/toast.ts:1` — utility wrappers `showToast`, `showErrorToast`, `showErrorToastMessage`, `useErrorToast`
3. `src/components/app/notification-provider.tsx:4` — direct API (`toast.custom`, `toast.dismiss`)
4. `src/components/app/dialog/scan-rfid-customer-dialog.tsx:4` — `toast.success`

### Callers (KHÔNG cần modify)
- **724 sites** gọi `showToast` / `showErrorToast` / `showErrorToastMessage` từ utils — wrapper-first migration nghĩa là 724 sites này giữ nguyên.

### Advanced API in use
- `toast.success(text)` — scan-rfid (matches Sonner trực tiếp)
- `toast.custom((t) => <JSX />)` — notification-provider (Sonner có `toast.custom` nhưng signature khác)
- `toast.dismiss(id)` — notification-provider (Sonner có `toast.dismiss(id)` matches)

---

## File Structure

**Modify (4):**
- `package.json` — bỏ `react-hot-toast`, thêm `sonner`
- `src/main.tsx` — swap `<Toaster>` mount
- `src/utils/toast.ts` — swap internal impl, GIỮ NGUYÊN signatures
- `src/components/app/dialog/scan-rfid-customer-dialog.tsx` — đổi import path
- `src/components/app/notification-provider.tsx` — migrate `toast.custom` to Sonner shape

---

## Task 1: Install Sonner + update package.json

**Files:**
- `package.json`

- [ ] **Step 1: Install Sonner, remove react-hot-toast**

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npm install sonner
npm uninstall react-hot-toast
```

- [ ] **Step 2: Verify package.json**

`package.json` should now have `"sonner": "^1.x.x"` and NO `"react-hot-toast"`.

- [ ] **Step 3: Verify type check still works (will fail until other tasks done)**

```bash
npx tsc -b 2>&1 | tail -10
```

Expected: errors for `react-hot-toast` imports in 4 files. That's fine — fix in Task 2-5.

- [ ] **Step 4: Commit just dependency change**

```bash
git add package.json package-lock.json
git commit -m "deps: replace react-hot-toast with sonner"
```

---

## Task 2: Migrate utils/toast.ts (PRESERVE all signatures)

**Files:**
- Modify: `src/utils/toast.ts`

> CRITICAL: Signatures `showToast(message)`, `showErrorToast(code)`, `useErrorToast(code)`, `showErrorToastMessage(message)` MUST stay identical. 724 callers depend on these.

- [ ] **Step 1: Replace import + impl**

Current top of file:
```ts
import toast from 'react-hot-toast'
import i18next from 'i18next'

// Map error codes from JSON to corresponding toast messages
const errorCodes: { [key: number]: string } = { ... }
```

Change to:
```ts
import { toast } from 'sonner'
import i18next from 'i18next'

const errorCodes: { [key: number]: string } = { /* unchanged */ }
```

> `errorCodes` map giữ nguyên 100%.

- [ ] **Step 2: Update wrapper functions**

Current:
```ts
export function showToast(message: string) {
  toast.success(i18next.t(message, { ns: 'toast' }))
}

export function showErrorToast(code: number) {
  const messageKey = errorCodes[code] || 'toast.requestFailed'
  toast.error(i18next.t(messageKey, { ns: 'toast' }))
}

export function useErrorToast(code: number) {
  const messageKey = errorCodes[code] || 'toast.requestFailed'
  toast.error(i18next.t(messageKey, { ns: 'toast' }))
}

export function showErrorToastMessage(message: string) {
  toast.error(i18next.t(message, { ns: 'toast' }))
}
```

Sonner API is identical for these methods:
```ts
toast.success(text)  // ✓ same
toast.error(text)    // ✓ same
```

→ Function bodies KHÔNG đổi, chỉ đổi import statement ở Step 1.

Also remove the debug `console.log` we added trong `showErrorToast` (commit `daeec59`) nếu chưa revert — bây giờ là lúc clean up.

- [ ] **Step 3: Verify tsc + lint clean for this file**

```bash
npx tsc -b 2>&1 | tail -5
npx eslint src/utils/toast.ts 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/toast.ts
git commit -m "refactor(toast): swap react-hot-toast → sonner in utils (signatures preserved)"
```

---

## Task 3: Migrate Toaster mount in main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Swap Toaster import**

```ts
// remove:
import { Toaster } from 'react-hot-toast'

// add:
import { Toaster } from 'sonner'
```

- [ ] **Step 2: Update Toaster config**

Current (from commit `2584259`):
```tsx
<Toaster
  position="top-center"
  reverseOrder={false}
  containerStyle={{ zIndex: 999999 }}
  toastOptions={{
    duration: 4000,
    error: { duration: 5000 },
  }}
/>
```

Sonner's `<Toaster>` props khác:
```tsx
<Toaster
  position="top-center"
  richColors        // auto color theo type (success/error/warning)
  closeButton       // hiện X button
  expand={false}    // false = stack thu nhỏ (default), true = expand luôn
  duration={4000}
  toastOptions={{ duration: 4000 }}
/>
```

> KHÔNG cần `zIndex` hack — Sonner render qua Portal đúng chuẩn, không bị Dialog đè.
> KHÔNG cần `error: { duration: 5000 }` — Sonner mặc định error toast lâu hơn rồi. Nếu muốn explicit, dùng `toast.error(text, { duration: 5000 })` per-call site.

Toaster vẫn nên ở vị trí outside ErrorBoundary (giữ từ commit `2584259`):

```tsx
createRoot(rootElement).render(
  <StrictMode>
    <Toaster
      position="top-center"
      richColors
      closeButton
    />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
```

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/main.tsx 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx
git commit -m "feat(toast): swap Toaster to Sonner with richColors + closeButton"
```

---

## Task 4: Migrate scan-rfid-customer-dialog direct usage

**Files:**
- Modify: `src/components/app/dialog/scan-rfid-customer-dialog.tsx:4`

- [ ] **Step 1: Swap import**

```ts
// remove:
import toast from 'react-hot-toast'

// add:
import { toast } from 'sonner'
```

- [ ] **Step 2: Verify line 240**

`toast.success(t('menu.userFound'))` — works identically in Sonner. No change needed.

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/components/app/dialog/scan-rfid-customer-dialog.tsx 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add src/components/app/dialog/scan-rfid-customer-dialog.tsx
git commit -m "refactor(rfid): swap toast import to sonner"
```

---

## Task 5: Migrate notification-provider toast.custom

**Files:**
- Modify: `src/components/app/notification-provider.tsx:4,234-269`

> This file uses `toast.custom((t) => <JSX onClick={() => toast.dismiss(t.id)} />)` — render-prop pattern. Sonner's `toast.custom` takes a function `(id) => <JSX>` returning JSX where `id` is the toast id (not an object).

- [ ] **Step 1: Read the current usage (lines 230-275)**

Understand:
- What JSX is rendered inside `toast.custom`
- Where `t.id` is used (for `toast.dismiss(t.id)`)
- Whether it's a notification card with title/body/close button

- [ ] **Step 2: Swap import + migrate API**

```ts
// remove:
import toast from 'react-hot-toast'

// add:
import { toast } from 'sonner'
```

API migration:
```tsx
// react-hot-toast pattern:
toast.custom(
  (t) => (
    <div className="...">
      <button onClick={() => toast.dismiss(t.id)}>X</button>
    </div>
  ),
  { duration: ... }
)

// Sonner pattern:
toast.custom(
  (id) => (
    <div className="...">
      <button onClick={() => toast.dismiss(id)}>X</button>
    </div>
  ),
  { duration: ... }
)
```

Key changes:
- `(t) => ...` becomes `(id) => ...`
- `t.id` references become just `id`
- Other refs to `t.visible`, `t.height`, etc. need separate handling — Sonner doesn't expose these. If used, simplify the JSX to not depend on them. If `t.visible` is used to conditionally render → just remove the condition (Sonner manages mount/unmount automatically).

- [ ] **Step 3: Verify Sonner styling doesn't conflict**

Sonner wraps custom JSX in its own container. If your JSX has `position: fixed` or specific layout assumptions, may need adjustment. Visual smoke test required.

- [ ] **Step 4: Verify tsc + lint**

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/components/app/notification-provider.tsx 2>&1 | tail -3
```

- [ ] **Step 5: Smoke test (manual, important for this task)**

- Trigger an FCM notification (or chef order failed printing notification)
- Verify custom notification toast renders correctly
- Verify close button dismisses it
- Verify no visual regression

- [ ] **Step 6: Commit**

```bash
git add src/components/app/notification-provider.tsx
git commit -m "refactor(notif): migrate toast.custom to Sonner API (id-based)"
```

---

## Task 6: Cleanup debug logs from earlier commits

**Files:**
- `src/app/App.tsx`
- `src/utils/toast.ts` (already cleaned in Task 2 if you removed)
- `src/app/staff/table-order.tsx`

> Commit `daeec59` added debug logs throughout. After migration verified working, revert this debug commit.

- [ ] **Step 1: Revert debug commit**

```bash
git revert daeec59 --no-edit
```

This creates a new revert commit removing all debug logs.

- [ ] **Step 2: Verify suite still green**

```bash
npx vitest run 2>&1 | tail -5
```

Expect 556/556 (debug logs didn't add tests, revert doesn't break anything).

---

## Task 7: Polish — leverage Sonner features (OPTIONAL)

> Skip này nếu chỉ migrate. Làm nếu muốn UX better ngay.

**Files:** Specific call sites where description/action would improve UX.

### Sub-task A: Add description to error toasts

Some errors have helpful context. Examples:

**Trước:**
```ts
showErrorToast(1010043)  // "Bàn đã được đặt..."
```

**Sau (new util signature):**
```ts
showErrorToast(1010043, 'Bạn có thể xem đơn cũ hoặc đổi bàn')
```

Update `showErrorToast` signature:
```ts
export function showErrorToast(code: number, description?: string) {
  const messageKey = errorCodes[code] || 'toast.requestFailed'
  toast.error(i18next.t(messageKey, { ns: 'toast' }), {
    description,
  })
}
```

→ Backward compatible (description optional).

### Sub-task B: Action buttons for common errors

Vd: lỗi 1010043 (table conflict) → action "Xem đơn cũ".

Cần thêm 1 util:
```ts
export function showErrorToastWithAction(
  code: number,
  action: { label: string; onClick: () => void }
) {
  const messageKey = errorCodes[code] || 'toast.requestFailed'
  toast.error(i18next.t(messageKey, { ns: 'toast' }), { action })
}
```

Use at 1-2 call sites strategically. Don't roll out everywhere — keeps toasts focused.

### Sub-task C: Promise toast cho long mutations

Replace ad-hoc loading toasts với `toast.promise()`:

```ts
export function showPromiseToast<T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string }
) {
  return toast.promise(promise, {
    loading: i18next.t(messages.loading, { ns: 'toast' }),
    success: i18next.t(messages.success, { ns: 'toast' }),
    error: i18next.t(messages.error, { ns: 'toast' }),
  })
}
```

Use cho create order, export Excel, etc.

---

## Final Review

- [ ] Full test suite green: `npx vitest run`
- [ ] tsc + lint clean: `npm run lint && npx tsc -b`
- [ ] Manual smoke:
  - Trigger error toast (POST /orders conflict) → "Bàn đã được đặt" hiện top-center, red color, X button
  - Multiple toasts in quick succession → stack animation smooth
  - Open Dialog rồi trigger error → toast vẫn hiện đè lên Dialog (Portal escape)
  - Click X → toast dismiss
  - Swipe (touch device / drag mouse) → toast dismiss
  - Notification toast (custom JSX) render đúng
- [ ] Bundle size check: `npm run build` — note size delta nếu quan tâm (Sonner ~10KB vs react-hot-toast ~5KB, +5KB)

---

## Notes / Design Decisions

1. **Wrapper-first migration**: 724 callers KHÔNG đổi vì utils giữ signatures. Migration tập trung 4 file source.

2. **Không cần z-index hack**: Sonner render qua Radix Portal đúng chuẩn, native escape Dialog context. Bỏ workaround `zIndex: 999999`.

3. **richColors + closeButton**: Bật ngay từ migration để hưởng UX. richColors auto-color theo `toast.success` / `toast.error`. closeButton cho user dismiss thủ công.

4. **Polish (Task 7) optional**: Migration thuần chỉ cần Task 1-6. Task 7 là value-add lớp UX. Có thể làm riêng PR sau.

5. **Bundle size**: +5KB. Trade-off chấp nhận được vì UX gain lớn. Nếu critical, có thể đo lại bằng `vite-plugin-bundle-visualizer`.

6. **Sonner version**: Cài `sonner@^1.x` (current stable). Verify compatibility với React 18 (Sonner support tốt React 18+).

7. **i18next integration**: Sonner không biết i18n. Wrapper utils tiếp tục dịch via `i18next.t()` trước khi pass vào toast.success/error.
