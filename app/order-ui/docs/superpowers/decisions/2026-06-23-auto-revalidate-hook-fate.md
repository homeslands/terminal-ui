# `useAutoRevalidateAppliedVoucher` — keep (2026-06-23)

**Context.** The Phase-2 voucher refactor introduces `useVoucherState`
(`src/hooks/use-voucher-state.ts`) which owns the entire applied-voucher
lifecycle — apply/remove/auto-revalidate/BE-seed — at the **host** component
level (admin-cart-content, table-payment-screen, table-order-screen).

**Decision.** Keep `useAutoRevalidateAppliedVoucher` for now.

**Why.**

1. **Client routes still need it.** The hook is used by
   `client-voucher-list-sheet-in-payment.tsx`,
   `client-voucher-list-sheet-in-update-order-with-local-storage.tsx`,
   and the generic `voucher-list-sheet.tsx`. The client-side hosts that
   render these sheets were NOT migrated to `useVoucherState` (out of scope
   for this refactor). Removing the hook would leave those flows without
   sheet-level revalidation.

2. **Trust-BE phase semantics are not 1:1 in `useVoucherState`.** The
   sheet hook intentionally tolerates a brief FE/BE rounding-diff window
   right after apply. `useVoucherState`'s "wait for items / wait for
   orderSlug" guards approximate but do not exactly replicate this phase.

3. **Removal cost.** Seven sheet consumers + their tests would need
   updates. That is a meaningful migration of its own, with regression
   risk in flows the current refactor has not exercised.

**Follow-up.** When all client and staff hosts adopt `useVoucherState`,
this hook becomes redundant and should be deleted. Tracking ticket: TBD.
