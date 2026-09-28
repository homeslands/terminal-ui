# Active Order Focus-Aware Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi `useGetActiveOrderByTable` từ flat polling 30s → focus-aware polling 5s để rút ngắn latency multi-staff sync (Staff B thấy thay đổi Staff A vừa làm) mà không tăng tải BE khi tab ở background.

**Architecture:** TanStack Query có 2 prop built-in cho behavior này — `refetchIntervalInBackground: false` (pause polling khi tab hidden) + `refetchOnWindowFocus: true` (catch-up khi tab focus lại). Combo với `refetchInterval: 5_000` cho realtime gần khi tab active.

**Tech Stack:** TanStack Query v5, React 18, TypeScript. (No new dependencies.)

**Scope:** Hook duy nhất `useGetActiveOrderByTable` ở `src/hooks/use-order.ts`. Optional follow-up cho `useTables` (defer Phase 2 nếu cần).

**Out of scope:**
- WebSocket/SSE realtime push (BE chưa có infra)
- BE version-based conflict detection (Option E — cần BE coordinate)
- Apply pattern cho hook khác (vd `useTables` đang được caller `floor-plan.tsx` set refetchInterval 3s — cũng nên focus-aware nhưng defer)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/hooks/use-order.ts` | Modify (lines 396-405) | Add `refetchIntervalInBackground: false` + explicit `refetchOnWindowFocus: true`; change `refetchInterval` 30_000 → 5_000 |

Single-file change. No new files. No types update.

---

### Task 1: Apply focus-aware polling to `useGetActiveOrderByTable`

**Files:**
- Modify: `src/hooks/use-order.ts:396-405`

Current implementation:

```ts
export const useGetActiveOrderByTable = (tableSlug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
    queryFn: () => getActiveOrderByTable(tableSlug),
    enabled: !!tableSlug,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    select: (data) => data.result,
  })
}
```

- [ ] **Step 1: Modify hook**

Replace the body of `useGetActiveOrderByTable` with:

```ts
export const useGetActiveOrderByTable = (tableSlug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
    queryFn: () => getActiveOrderByTable(tableSlug),
    enabled: !!tableSlug,
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    select: (data) => data.result,
  })
}
```

Changes:
- `refetchInterval: 30_000` → `5_000` (6× faster)
- `refetchIntervalInBackground: false` (pause polling khi tab hidden — Page Visibility API)
- `refetchOnWindowFocus: true` (explicit — TanStack default but make intent clear)

- [ ] **Step 2: Tsc check**

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean (no output).

- [ ] **Step 3: Eslint check**

Run: `npx eslint src/hooks/use-order.ts 2>&1 | head -5`
Expected: clean.

- [ ] **Step 4: Full test suite**

Run: `npx vitest run 2>&1 | tail -5`
Expected: 517 PASS (no test change needed — hook behavior change is observable only via runtime polling).

- [ ] **Step 5: Manual smoke**

Run dev server `npm run dev`. Open 2 browser tabs as STAFF on same table page `/staff/table/<id>`:

1. **Tab A active, Tab B active**: Add a món in Tab A → wait ≤5s → Tab B should show món added (auto-refetch from poll).
2. **Tab A active, Tab B background** (vd switch sang tab khác): Add món in Tab A → Tab B's polling paused (Network tab: no requests). Switch back to Tab B → immediate refetch fires (catch-up) → món visible.
3. **Tab A minimize browser entirely**: Network tab quiet (no requests). Restore browser → refetch fires.

Verify trong DevTools Network tab — request count tăng khi tab focused, dừng khi tab hidden.

---

## Self-Review

**Spec coverage:**
- Hook `useGetActiveOrderByTable` updated ↔ Task 1. ✓
- Polling 5s khi active, pause background ↔ `refetchInterval: 5_000 + refetchIntervalInBackground: false`. ✓
- Catch-up khi focus lại ↔ `refetchOnWindowFocus: true`. ✓

**Type consistency:** All 3 new props are well-typed `boolean | number` on `useQuery` options. No type mismatch risk.

**Placeholder scan:** none.

**Risks:**
1. **BE tải tăng**: 5s polling × 10 staff active = 120 req/phút (so với 20 req/phút trước đây). Nếu BE chịu không nổi, cân nhắc tăng lên 10s. Mitigation: monitor BE metrics sau deploy.
2. **Spurious refetch on focus**: nếu user switch tab nhanh nhiều lần, sẽ có nhiều refetch liên tiếp. TanStack Query auto-deduplicates concurrent requests, không thành vấn đề.
3. **Race với mutation**: Staff A add item → optimistic local + invalidate cũng trigger polling → 2 requests gần nhau. Acceptable (BE idempotent read).
4. **Page Visibility API compatibility**: Hỗ trợ trên tất cả browser hiện đại (>95% global). Edge case: iOS Safari có thể behave hơi khác (vd vẫn poll khi tab khác). Acceptable cho POS desktop/Android tablet context.

**Optional follow-up (NOT in this plan):**
- `useTables` (floor-plan) đang poll 3s flat — cũng nên thêm `refetchIntervalInBackground: false`. Defer plan riêng nếu cần.
- WebSocket push thay polling — Phase 4+, cần BE infra.
