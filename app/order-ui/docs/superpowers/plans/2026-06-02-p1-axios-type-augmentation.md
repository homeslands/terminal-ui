# P1: Axios Type Augmentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Augment `AxiosRequestConfig` with `doNotShowLoading` so all 27 `@ts-expect-error` comments in api/* files can be removed.

**Architecture:** The project already augments `InternalAxiosRequestConfig` in `src/types/axios-extensions.d.ts`. The same property needs to be declared on `AxiosRequestConfig` (the user-facing config type passed to `http.post/get/put/delete`). Once done, every `// @ts-expect-error doNotShowLoading is not in AxiosRequestConfig` comment and the redundant `CustomAxiosRequestConfig` interface in `http.ts` become dead weight and must be deleted.

**Tech Stack:** TypeScript module augmentation, Axios 1.x, Vitest

---

### Task 1: Extend the type augmentation

**Files:**
- Modify: `src/types/axios-extensions.d.ts`

- [ ] **Step 1: Read the current file**

```
src/types/axios-extensions.d.ts
```

Current content:
```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import axios, { InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    doNotShowLoading?: boolean
  }
}
```

- [ ] **Step 2: Add `AxiosRequestConfig` augmentation**

Replace the file content with:
```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    doNotShowLoading?: boolean
  }
  interface InternalAxiosRequestConfig {
    doNotShowLoading?: boolean
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/axios-extensions.d.ts
git commit -m "fix(types): augment AxiosRequestConfig with doNotShowLoading"
```

---

### Task 2: Remove CustomAxiosRequestConfig from http.ts

**Files:**
- Modify: `src/utils/http.ts`

The file currently defines a local `CustomAxiosRequestConfig` interface (lines 242–244) and casts `config` to it at line 200. Both are redundant once `AxiosRequestConfig` is augmented.

- [ ] **Step 1: Remove the local interface**

Delete lines 242–244 from `src/utils/http.ts`:
```ts
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  doNotShowLoading?: boolean
}
```

- [ ] **Step 2: Remove the redundant cast**

Change line 200 from:
```ts
if (!(config as CustomAxiosRequestConfig).doNotShowLoading) {
```
to:
```ts
if (!config.doNotShowLoading) {
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/http.ts
git commit -m "refactor(http): remove redundant CustomAxiosRequestConfig interface"
```

---

### Task 3: Remove @ts-expect-error comments from src/api/order.ts

**Files:**
- Modify: `src/api/order.ts`

There are 12 `@ts-expect-error doNotShowLoading is not in AxiosRequestConfig` comment lines in this file (at lines 39, 44, 51, 54, 62, 65, 421, 426, 436, 441, 458, 463). Each appears directly above a `doNotShowLoading: true` line.

- [ ] **Step 1: Remove all 12 @ts-expect-error lines**

For each occurrence, delete the comment line. Example pattern to search for and delete:
```ts
      // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
      doNotShowLoading: true,
```
Becomes:
```ts
      doNotShowLoading: true,
```

Also remove the `as AxiosRequestConfig` cast where present (those casts were workarounds for the same type gap):
```ts
    } as AxiosRequestConfig)
```
Can become:
```ts
    })
```
Only if the cast is redundant (i.e., the object literal already matches `AxiosRequestConfig`). Check each site individually before removing the cast.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "order.ts"
```

Expected: no errors mentioning `order.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/api/order.ts
git commit -m "refactor(api): remove @ts-expect-error from order.ts"
```

---

### Task 4: Remove @ts-expect-error from remaining api files

**Files:**
- Modify: `src/api/gift-card.ts` (3 occurrences)
- Modify: `src/api/card-order.ts` (1 occurrence)
- Modify: `src/api/logger.ts` (2 occurrences)
- Modify: `src/api/notification.ts` (2 occurrences)
- Modify: `src/api/chef-area.ts` (7 occurrences)

- [ ] **Step 1: Remove all `@ts-expect-error doNotShowLoading is not in AxiosRequestConfig` comment lines**

For each file, search for:
```
// @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
```
and delete that comment line. The `doNotShowLoading: true` line below it stays.

- [ ] **Step 2: Verify TypeScript compiles for all modified files**

```bash
npx tsc --noEmit 2>&1 | grep -E "gift-card|card-order|logger|notification|chef-area"
```

Expected: no errors.

- [ ] **Step 3: Run full type check**

```bash
npx tsc --noEmit 2>&1 | wc -l
```

Expected: 0 lines (no errors at all).

- [ ] **Step 4: Commit**

```bash
git add src/api/gift-card.ts src/api/card-order.ts src/api/logger.ts src/api/notification.ts src/api/chef-area.ts
git commit -m "refactor(api): remove @ts-expect-error from all api files"
```
