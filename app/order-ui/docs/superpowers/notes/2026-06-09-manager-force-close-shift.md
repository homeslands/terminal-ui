# Manager Force-Close Shift — Inquiry

**Status**: Pending BE clarification.

## Problem

Per `src/docs/feature-management-staff-shifts-FE-Tester.md`:
- Only STAFF role can call `PATCH /staff-shifts/close`.
- The doc lists permission table where MANAGER/ADMIN/SUPER_ADMIN do NOT have close permission.

This leaves no recovery path when:
- Staff forgets to close ca (cứ qua đêm)
- Staff bỏ về không đóng ca
- Staff laptop/tablet hỏng giữa ca, không thể login lại

The ca stays ACTIVE on server, blocking the staff from opening a new ca next day.

## Questions for BE team

1. Is there an admin/manager endpoint to force-close a staff's shift?
2. If not, is there an auto-close after N hours of inactivity?
3. What's the intended workaround when staff cannot close their own shift?

## FE side once BE confirms

| BE answer | FE work |
|---|---|
| Has endpoint `PATCH /staff-shifts/{slug}/force-close` for MANAGER+ | Add `forceCloseShift` API + hook + admin UI button in shift detail page (Phase 2/3) |
| Has auto-close after X hours | No FE work needed; add tooltip on long-shift indicator explaining "Sẽ tự đóng sau X giờ" |
| No solution exists | Block this PR; raise as P0 to product/BE |

## Action
- [ ] Send this doc to BE lead via Slack/Linear
- [ ] Update plan when answer received

## FE-side mitigation already shipped (Phase 1 Edge Cases)

While waiting on BE, FE has shipped two preventive UX safeguards (see `docs/superpowers/plans/2026-06-09-staff-shift-edge-cases.md`):

1. **Long-shift visual warning** (`CurrentShiftIndicator`): chip turns orange + banner "Ca đã mở hơn 10 tiếng" appears in dropdown when `durationMinutes >= 600`.
2. **Logout-during-shift warning** (`LogoutDialog`): when STAFF has active shift, the logout dialog shows stronger title/description and button text "Vẫn đăng xuất" instead of the generic copy.

These reduce — but do not eliminate — the orphaned-shift problem. A real force-close mechanism is still needed.
