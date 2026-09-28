# P7: Query Key Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize all TanStack Query keys into `src/constants/query.ts` and migrate every raw string literal across 15 hook files, eliminating typo-prone duplication and making cache invalidation reliable.

**Architecture:** `QUERYKEY` in `src/constants/query.ts` is the single source of truth for query cache keys. A query key is declared there as a tuple (e.g. `orders: ['orders']`). For queries with extra params, compose as `[...QUERYKEY.orders, q]` (spread the base, append params). Never pass `QUERYKEY.x` directly as a key that requires spreading — `[QUERYKEY.x, param]` creates a nested array `[['orders'], param]` which does NOT match prefix-based invalidation of `QUERYKEY.orders`. Eliminate all `JSON.stringify(q)` in query keys — TanStack v5 serializes object keys deterministically.

**Tech Stack:** TypeScript, TanStack Query v5, Vitest

---

### Task 1: Add all missing QUERYKEY entries to constants/query.ts

**Files:**
- Modify: `src/constants/query.ts`

The current file has 46 entries. The following raw strings are used in hooks but have no constant:

| Raw string | Proposed constant name |
|---|---|
| `'tableLocations'` | `tableLocations` |
| `'systemConfigs'` | `systemConfigs` |
| `'logs'` | `logs` |
| `'users'` | `users` |
| `'user'` | `user` |
| `'userGiftCardsInfinite'` | `userGiftCardsInfinite` |
| `'feature-flags'` | `featureFlags` |
| `'feature-flag-groups'` | `featureFlagGroups` |
| `'bankConnector'` | `bankConnector` |
| `'authority-group'` | `authorityGroup` |
| `'branchInfoForDelivery'` | `branchInfoForDelivery` |
| `'branchConfig'` | `branchConfig` |
| `'specificBranchConfig'` | `specificBranchConfig` |
| `'branchConfigs'` | `branchConfigs` |
| `'size'` | `size` |
| `'userBalance'` | `userBalance` |
| `'analyze-balance'` | `analyzeBalance` |
| `'menus'` | `menus` |
| `'specific-menu'` | `specificMenu` |
| `'public-specific-menu'` | `publicSpecificMenu` |
| `'specific-menu-item'` | `specificMenuItem` |
| `'staticPages'` | `staticPages` |
| `'staticPage'` | `staticPage` |
| `'allRevenue'` | `allRevenue` |
| `'branchRevenue'` | `branchRevenue` |
| `'topProducts'` | `topProducts` |
| `'topBranchProducts'` | `topBranchProducts` |
| `'pointTransactions'` | `pointTransactions` |
| `'system-point-transactions'` | `systemPointTransactions` |
| `'analyze-point-transactions'` | `analyzePointTransactions` |
| `'coin-policies'` | `coinPolicies` |
| `'cardOrders'` | `cardOrders` |
| `'cardOrdersInfinite'` | `cardOrdersInfinite` |

Note: `'branches'`, `'products'`, `'productVariants'`, `'catalogs'`, `'userGiftCards'` already exist in QUERYKEY — do NOT add duplicates.

- [ ] **Step 1: Append all missing entries to `src/constants/query.ts`**

Add inside the `QUERYKEY` object before the closing `}`:

```ts
  tableLocations: ['tableLocations'],
  systemConfigs: ['systemConfigs'],
  logs: ['logs'],
  users: ['users'],
  user: ['user'],
  userGiftCardsInfinite: ['userGiftCardsInfinite'],
  featureFlags: ['feature-flags'],
  featureFlagGroups: ['feature-flag-groups'],
  bankConnector: ['bankConnector'],
  authorityGroup: ['authority-group'],
  branchInfoForDelivery: ['branchInfoForDelivery'],
  branchConfig: ['branchConfig'],
  specificBranchConfig: ['specificBranchConfig'],
  branchConfigs: ['branchConfigs'],
  size: ['size'],
  userBalance: ['userBalance'],
  analyzeBalance: ['analyze-balance'],
  menus: ['menus'],
  specificMenu: ['specific-menu'],
  publicSpecificMenu: ['public-specific-menu'],
  specificMenuItem: ['specific-menu-item'],
  staticPages: ['staticPages'],
  staticPage: ['staticPage'],
  allRevenue: ['allRevenue'],
  branchRevenue: ['branchRevenue'],
  topProducts: ['topProducts'],
  topBranchProducts: ['topBranchProducts'],
  pointTransactions: ['pointTransactions'],
  systemPointTransactions: ['system-point-transactions'],
  analyzePointTransactions: ['analyze-point-transactions'],
  coinPolicies: ['coin-policies'],
  cardOrders: ['cardOrders'],
  cardOrdersInfinite: ['cardOrdersInfinite'],
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: zero errors.

---

### Task 2: Migrate raw string keys in core hook files

**Files:**
- Modify: `src/hooks/use-branch.ts`
- Modify: `src/hooks/use-menu.ts`
- Modify: `src/hooks/use-product.ts`
- Modify: `src/hooks/use-auth.ts`
- Modify: `src/hooks/use-table.ts`
- Modify: `src/hooks/use-system.ts`

For each file: confirm `QUERYKEY` is imported from `@/constants`, then replace raw strings.

- [ ] **Step 1: use-branch.ts**

Ensure import: `import { QUERYKEY } from '@/constants'`

Replace:
```ts
// line ~20
queryKey: ['branches'],
// → already in QUERYKEY
queryKey: QUERYKEY.branches,

// line ~52
queryKey: ['branchInfoForDelivery', slug],
// →
queryKey: [...QUERYKEY.branchInfoForDelivery, slug],

// line ~87
queryKey: ['branchConfig', slug],
// →
queryKey: [...QUERYKEY.branchConfig, slug],

// line ~96
queryKey: ['specificBranchConfig', params],
// →
queryKey: [...QUERYKEY.specificBranchConfig, params],

// line ~105
queryKey: ['branchConfigs', branchSlug],
// →
queryKey: [...QUERYKEY.branchConfigs, branchSlug],
```

- [ ] **Step 2: use-menu.ts**

Ensure import: `import { QUERYKEY } from '@/constants'`

Replace:
```ts
// line ~26 — JSON.stringify removed; object key is fine in TanStack v5
queryKey: ['menus', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.menus, q],

// line ~36
queryKey: ['specific-menu', query],
// →
queryKey: [...QUERYKEY.specificMenu, query],

// line ~46
queryKey: ['public-specific-menu', query],
// →
queryKey: [...QUERYKEY.publicSpecificMenu, query],

// line ~54
queryKey: ['specific-menu-item', slug],
// →
queryKey: [...QUERYKEY.specificMenuItem, slug],
```

- [ ] **Step 3: use-product.ts**

Ensure import: `import { QUERYKEY } from '@/constants'`

Replace:
```ts
// line ~36
queryKey: ['products', params],
// →
queryKey: [...QUERYKEY.products, params],

// line ~105
queryKey: ['productVariants'],
// → already in QUERYKEY
queryKey: QUERYKEY.productVariants,

// line ~137 — JSON.stringify removed
queryKey: ['topProducts', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.topProducts, q],

// line ~145 — JSON.stringify removed
queryKey: ['topBranchProducts', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.topBranchProducts, q],
```

- [ ] **Step 4: use-auth.ts**

Ensure import is uncommented: the file has `// import { QUERYKEY } from '@/constants'` (line ~18) — uncomment it.

Replace:
```ts
// line ~132 — JSON.stringify removed
queryKey: ['authority-group', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.authorityGroup, q],
```

- [ ] **Step 5: use-table.ts**

Ensure import: `import { QUERYKEY } from '@/constants'`

Replace:
```ts
// line ~60
queryKey: ['tableLocations'],
// →
queryKey: QUERYKEY.tableLocations,
```

- [ ] **Step 6: use-system.ts**

Ensure import: `import { QUERYKEY } from '@/constants'`

Replace:
```ts
// line ~12
queryKey: ['systemConfigs'],
// →
queryKey: QUERYKEY.systemConfigs,
```

- [ ] **Step 7: TypeScript check for all modified files**

```bash
npx tsc --noEmit 2>&1 | grep -E "use-branch|use-menu|use-product|use-auth|use-table|use-system"
```

Expected: zero errors.

---

### Task 3: Migrate raw string keys in remaining hook files

**Files:**
- Modify: `src/hooks/use-logger.ts`
- Modify: `src/hooks/use-user.ts`
- Modify: `src/hooks/use-gift-card.ts`
- Modify: `src/hooks/use-bank.ts`
- Modify: `src/hooks/use-size.ts`
- Modify: `src/hooks/use-balance.ts`
- Modify: `src/hooks/use-static-page.ts`
- Modify: `src/hooks/use-revenue.ts`
- Modify: `src/hooks/use-point-transaction.ts`
- Modify: `src/hooks/use-coin-policies.ts`
- Modify: `src/hooks/use-card-order.ts`

- [ ] **Step 1: use-logger.ts**

```ts
queryKey: ['logs', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.logs, q],
```

- [ ] **Step 2: use-user.ts**

```ts
queryKey: ['users', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.users, q],

queryKey: ['user', slug],
// →
queryKey: [...QUERYKEY.user, slug],
```

- [ ] **Step 3: use-gift-card.ts**

```ts
queryKey: ['userGiftCardsInfinite', filters],
// →
queryKey: [...QUERYKEY.userGiftCardsInfinite, filters],

queryKey: ['feature-flags', group],
// →
queryKey: [...QUERYKEY.featureFlags, group],

queryKey: ['feature-flag-groups'],
// →
queryKey: QUERYKEY.featureFlagGroups,
```

Also check line ~75 uses `useInfiniteQuery` — the key format is the same for infinite queries in TanStack v5.

- [ ] **Step 4: use-bank.ts**

```ts
queryKey: ['bankConnector'],
// →
queryKey: QUERYKEY.bankConnector,
```

- [ ] **Step 5: use-size.ts**

```ts
queryKey: ['size'],
// →
queryKey: QUERYKEY.size,
```

- [ ] **Step 6: use-balance.ts**

```ts
queryKey: ['userBalance', slug],
// →
queryKey: [...QUERYKEY.userBalance, slug],

queryKey: ['analyze-balance'],
// →
queryKey: QUERYKEY.analyzeBalance,
```

- [ ] **Step 7: use-static-page.ts**

```ts
queryKey: ['staticPages'],
// →
queryKey: QUERYKEY.staticPages,

queryKey: ['staticPage', q],
// →
queryKey: [...QUERYKEY.staticPage, q],
```

- [ ] **Step 8: use-revenue.ts**

```ts
queryKey: ['allRevenue', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.allRevenue, q],

queryKey: ['branchRevenue', JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.branchRevenue, q],
```

Also fix `use-card-order-revenue.ts` — it uses `[QUERYKEY.cardOrderRevenue, JSON.stringify(q)]` (incorrect compose style + JSON.stringify):
```ts
// use-card-order-revenue.ts line ~9
queryKey: [QUERYKEY.cardOrderRevenue, JSON.stringify(q)],
// →
queryKey: [...QUERYKEY.cardOrderRevenue, q],
```

- [ ] **Step 9: use-point-transaction.ts**

```ts
queryKey: ['pointTransactions', userSlug, filters],
// →
queryKey: [...QUERYKEY.pointTransactions, userSlug, filters],

queryKey: ['system-point-transactions', params],
// →
queryKey: [...QUERYKEY.systemPointTransactions, params],

queryKey: ['analyze-point-transactions', params],
// →
queryKey: [...QUERYKEY.analyzePointTransactions, params],
```

Also fix `params: any` on `useSystemPointTransactions`:
```ts
// line ~242
export const useSystemPointTransactions = (params: any) => {
// →
export const useSystemPointTransactions = (params: IPointTransactionQuery) => {
```

Confirm `IPointTransactionQuery` is already imported in `use-point-transaction.ts`.

- [ ] **Step 10: use-coin-policies.ts**

```ts
queryKey: ['coin-policies'],
// →
queryKey: QUERYKEY.coinPolicies,
```

- [ ] **Step 11: use-card-order.ts**

```ts
queryKey: ['cardOrders', JSON.stringify(req)],
// →
queryKey: [...QUERYKEY.cardOrders, req],

queryKey: ['cardOrdersInfinite', filters],
// →
queryKey: [...QUERYKEY.cardOrdersInfinite, filters],
```

- [ ] **Step 12: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

---

### Task 4: Final audit — confirm no raw string query keys remain

- [ ] **Step 1: Search for remaining raw string query keys**

```bash
grep -rn "queryKey.*\['" src/hooks/
```

Expected: zero results. If any remain, fix them.

- [ ] **Step 2: Search for JSON.stringify in query keys**

```bash
grep -rn "queryKey.*JSON\.stringify" src/hooks/
```

Expected: zero results.

- [ ] **Step 3: Search for incorrect nested-array compose style**

```bash
grep -rn "queryKey.*\[QUERYKEY\." src/hooks/
```

For each result, check if the QUERYKEY constant itself is already an array (it is — all entries are `['x']`). If the pattern is `[QUERYKEY.x]` (no spread, no extra params), that creates `[['x']]` — a nested array. Fix to `QUERYKEY.x`. If the pattern is `[QUERYKEY.x, param]`, that creates `[['x'], param]` — also wrong. Fix to `[...QUERYKEY.x, param]`.

- [ ] **Step 4: Final full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | wc -l
```

Expected: 0.
