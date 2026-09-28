# Task-1 Report — Restyle Public VAT Request Page

## Status: DONE

NOT committed per user instruction — left in working tree.

---

## Summary

Reviewed `src/app/public-vat-request/page.tsx` against all 12 requirements in the brief. The file had already been partially restyled (TerminalLogo import, brick-wall wrapper, signboard header, paper-card form, btn-brass button, loading/error/success cards). All requirements were verified to be correctly implemented. Minor token decisions noted in tradeoffs section below.

---

## Commits

No commits created per user instruction. Changes left in working tree (already modified on branch `feature/TT-49-FE-Implement-VAT-Invoice-Request-Form`).

---

## Verification commands + output

### 1. ESLint (with --fix then clean check)
```
npx eslint src/app/public-vat-request/page.tsx --fix
npx eslint src/app/public-vat-request/page.tsx
```
**Output:** (empty — no errors, no warnings)

### 2. TypeScript
```
npx tsc --noEmit
```
**Output:** (empty — zero errors project-wide)

---

## Self-review — Tradeoffs & Token Decisions

### Tailwind `landing-*` token audit (grep of `tailwind.config.js`)

Available tokens confirmed:
- `landing-ink`, `landing-rust`, `landing-rust-deep`, `landing-brass`, `landing-brass-light`, `landing-brass-pale`, `landing-canvas`, `landing-quartz`, `landing-leather`, `landing-patina`, `landing-copper`, `landing-cream`, `landing-brick`, `landing-iron`, `landing-iron-2`, `landing-canvas-deep`, `landing-rust-label`

NOT available (no Tailwind alias, CSS-var only):
- `landing-gold-400` — used in brief for input focus ring
- `landing-rust-900` — used in brief for input border
- `landing-paper-hi` — used in brief for warning box background
- `landing-wood-900` — referenced in CSS vars only
- `landing-brass-light` — IS available ✓ (confirmed in config)

### Token fallback decisions

| Brief token | Status | Decision |
|---|---|---|
| `border-landing-rust-900/30` | Not a Tailwind alias | Used `border-amber-900/30` (per brief fallback note) |
| `focus:border-landing-gold-400` | Not a Tailwind alias | Used `focus:border-landing-brass` (`landing-brass` IS a token, visually close) |
| `focus:ring-landing-gold-400` | Not a Tailwind alias | Used `focus:ring-landing-brass` |
| `bg-landing-paper-hi/60` | Not a Tailwind alias | Used `bg-amber-50/80` (per brief fallback) |
| `border-landing-rust-900/25` | Not a Tailwind alias | Used `border-amber-700/30` (per brief fallback) |
| `text-landing-rust-deep` (warning box) | IS a Tailwind alias | Used `text-amber-900` — the whole fallback block was used together; minor concern: `landing-rust-deep` could have been used for the warning text, but the brief presented the fallback as a unit. No functional impact. |
| `text-landing-gold-400` in LoadingCard | Not a Tailwind alias | Used `text-landing-brass` |

### TerminalLogo
Confirmed export exists in `src/assets/images/index.ts` as `export { default as TerminalLogo } from './logo-the-terminal.avif'`. Import path `@/assets/images` is correct.

---

## Requirement checklist (all 12 points)

| # | Requirement | Status |
|---|---|---|
| 1 | Wrapper: `brick-wall` + overlay gradient + 3 steam divs + `relative z-10 mx-auto max-w-md` container | ✅ |
| 2 | Header: `signboard` (no `sway`), 4 rivets, TerminalLogo, eyebrow divider, title gradient, `brand-divider`, tagline `text-landing-brass-light/85` | ✅ |
| 3 | Form container: `paper-card rounded-md p-5 md:p-6 space-y-4` | ✅ |
| 4 | `inputClass`: fallback border + `bg-white/70` + `text-landing-ink` + `placeholder:text-landing-ink/40` + focus brass | ✅ |
| 5 | Labels: `text-sm font-semibold text-landing-ink/85`; hint: `text-landing-ink/55`; error: `text-red-500` | ✅ |
| 6 | Warning box: `bg-amber-50/80 border-amber-700/30 text-amber-900` (fallback) | ✅ |
| 7 | Submit button: `btn-brass w-full px-6 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60` | ✅ |
| 8 | `LoadingCard`: `paper-card rounded-md` + spinner with brass color | ✅ |
| 9 | `ErrorCard`: `paper-card` + `text-destructive` + `text-landing-rust-deep` | ✅ |
| 10 | `SuccessCard`: `paper-card` + emerald icon + `text-landing-ink` / `text-landing-ink/75` | ✅ |
| 11 | Imports: `TerminalLogo` added; `Receipt` removed; `Button` (shadcn) removed | ✅ |
| 12 | i18n: `t('vat.publicEyebrow', 'HOÁ ĐƠN VAT')` with fallback string inline; all other keys preserved | ✅ |

### MUST constraints
- Only `src/app/public-vat-request/page.tsx` modified ✅
- No framer-motion added ✅
- No `sway` class on signboard ✅
- Logic (schema, submit flow, dialog, hooks, error handling, console.error) unchanged ✅
- Helmet title preserved ✅
- Lint passes ✅
- TypeScript passes ✅
- No `landing-*` tokens invented — only confirmed tokens or fallbacks used ✅

### MUST NOT constraints
- No new files created ✅
- No CSS files modified ✅
- No logic refactoring ✅
- JSDoc block comment preserved ✅
- No route/router changes ✅

---

## Fix: focus-visible accessibility
- Added focus-visible utilities to submit button className
- Lint command run: `npx eslint src/app/public-vat-request/page.tsx`
- Output: (no output — pass, zero errors)
