# P4: Hooks Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three hook naming/convention issues: rename `useGlobalTokenValidator.ts` to kebab-case, rename `.tsx` hook files that contain no JSX to `.ts`, and make the mock status of `use-staff-shift.ts` unmistakable.

**Architecture:** The project convention is kebab-case for all hook filenames (e.g. `use-order.ts`, `use-auth.ts`). Two files violate this: `useGlobalTokenValidator.ts` (PascalCase) and implicitly the `.tsx` extension on `use-mobile.tsx` and `use-profile.tsx` (neither exports JSX — the `.tsx` extension misleads tooling). `use-staff-shift.ts` has a `// TODO:` comment that will be missed in code review; the mock state needs to be visible in the return value and documented at the top of the function.

**Tech Stack:** TypeScript, Vitest, git mv

---

### Task 1: Rename useGlobalTokenValidator.ts to use-global-token-validator.ts

**Files:**
- Rename: `src/hooks/useGlobalTokenValidator.ts` → `src/hooks/use-global-token-validator.ts`
- Modify: `src/hooks/index.ts`

- [ ] **Step 1: Git-rename the file**

```bash
git mv src/hooks/useGlobalTokenValidator.ts src/hooks/use-global-token-validator.ts
```

- [ ] **Step 2: Update the barrel export in src/hooks/index.ts**

Change:
```ts
export * from './useGlobalTokenValidator'
```
To:
```ts
export * from './use-global-token-validator'
```

- [ ] **Step 3: Check for direct imports of the old path**

```bash
grep -rn "useGlobalTokenValidator" src/
```

If any import uses the old path `'./useGlobalTokenValidator'` or `'@/hooks/useGlobalTokenValidator'`, update it to `'./use-global-token-validator'` or `'@/hooks/use-global-token-validator'` respectively. The exported function name `useGlobalTokenValidator` stays the same — only the file path changes.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-global-token-validator.ts src/hooks/index.ts
git commit -m "refactor(hooks): rename useGlobalTokenValidator.ts to kebab-case"
```

---

### Task 2: Rename use-mobile.tsx and use-profile.tsx to .ts

**Files:**
- Rename: `src/hooks/use-mobile.tsx` → `src/hooks/use-mobile.ts`
- Rename: `src/hooks/use-profile.tsx` → `src/hooks/use-profile.ts`
- Modify: `src/hooks/index.ts`

- [ ] **Step 1: Verify neither file contains JSX**

```bash
grep -n "<[A-Z]\|<[a-z]\|jsx\|tsx" src/hooks/use-mobile.tsx src/hooks/use-profile.tsx
```

Expected: zero results. If JSX is found, do NOT rename — the `.tsx` extension is correct.

- [ ] **Step 2: Git-rename both files**

```bash
git mv src/hooks/use-mobile.tsx src/hooks/use-mobile.ts
git mv src/hooks/use-profile.tsx src/hooks/use-profile.ts
```

- [ ] **Step 3: Update barrel exports in src/hooks/index.ts**

The barrel uses `export * from './use-mobile'` style (no extension), so no change is needed there. Verify:

```bash
grep -n "use-mobile\|use-profile" src/hooks/index.ts
```

Expected: `export * from './use-mobile'` and `export * from './use-profile'` — already correct (no extension in the import string).

If any file elsewhere imports with explicit `.tsx` extension, update those imports.

- [ ] **Step 4: Check for explicit .tsx imports**

```bash
grep -rn "use-mobile\.tsx\|use-profile\.tsx" src/
```

Expected: zero results. Update any found.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-mobile.ts src/hooks/use-profile.ts
git commit -m "refactor(hooks): rename use-mobile.tsx and use-profile.tsx to .ts (no JSX)"
```

---

### Task 3: Mark use-staff-shift.ts mock status clearly

**Files:**
- Modify: `src/hooks/use-staff-shift.ts`

**Context — current content:**

```ts
export function useStaffShift(
  date: string,
  shift: ShiftKey,
): { data: ShiftStats; isLoading: false } {
  // ...mock implementation...
  // TODO: replace with useQuery once the staff shift-stats API endpoint exists
  return { data, isLoading: false }
}
```

The `// TODO:` comment is easy to skip. Returning `isMock: true` from the hook makes the mock status self-documenting and type-checkable.

- [ ] **Step 1: Update the return type and add isMock to the return value**

Change the function signature and return in `src/hooks/use-staff-shift.ts`:

```ts
export function useStaffShift(
  date: string,
  shift: ShiftKey,
): { data: ShiftStats; isLoading: false; isMock: true } {
  const s = mockSeed(date, shift)
  const data: ShiftStats = {
    revenue:    800_000 + (s % 20) * 100_000,
    orderCount: 5  + (s % 15),
    itemCount:  10 + (s % 30),
    topItems: MOCK_ITEMS.map((name, i) => ({
      name,
      quantity: Math.max(1, 8 - i * 2 + (s % (i + 2))),
    })).sort((a, b) => b.quantity - a.quantity),
  }
  // TODO: replace with useQuery once the staff shift-stats API endpoint exists
  return { data, isLoading: false, isMock: true }
}
```

- [ ] **Step 2: Update the existing test to cover isMock**

Open `src/hooks/__tests__/use-staff-shift.test.ts` and add an assertion to the existing "returns data" test:

```ts
expect(result.isMock).toBe(true)
```

- [ ] **Step 3: Run the hook tests**

```bash
npx vitest run src/hooks/__tests__/use-staff-shift.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Check the page that uses useStaffShift**

```bash
grep -n "isMock\|useStaffShift" src/app/staff/my-shift.tsx
```

The page destructures `{ data }` from `useStaffShift`. If `isMock` is unused there, no change is needed — the extra property is safe to ignore at the call site.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-staff-shift.ts src/hooks/__tests__/use-staff-shift.test.ts
git commit -m "refactor(hooks): expose isMock flag from useStaffShift to make mock status explicit"
```
