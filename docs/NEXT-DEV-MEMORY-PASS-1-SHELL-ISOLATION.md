# Next dev memory — Pass 1: authenticated shell graph isolation

**Date:** 2026-09-25  
**Baseline report:** `docs/NEXT-DEV-14GB-ROOT-CAUSE-REPORT.md`  
**Status:** Complete — **no material T3 improvement** (<10%). Stop Pass 2 per protocol; review before next boundary.

---

## Objective

Reduce **T3** (`GET /mctb` after clean `.next`) by breaking unnecessary **authenticated shell** imports (nav builders, voice-nav/SMS/appointments, title resolvers) without changing MCTB/Voice product behavior or adding a fake dev-only layout.

---

## Shell graph map (before)

```
(app)/layout.tsx (server)
  → AppShell (client)
      → imports: voice-nav titles, sms-platform titles, appointments titles, numbers, ai-after-hours, getPageTitle
      → Sidebar (client)
          → resolve-product-nav.ts [STATIC]
              → appointments-nav, sms-platform-nav, ai-after-hours-nav, voice-nav (→ smart-routing nav-children)
          → buildRealtorNav, buildNumbersNav, voice-nav, sms-platform-nav [STATIC top-level]
          → TransovoSidebar + map-nav (Kimi)
          → product-shell-tabs, CallHandlingSwitcher, solutions-nav, lib/nav.ts
      → MobileNav
          → voice-nav mobile builders [STATIC, eagerly executed]
          → resolve-product-nav [same fat graph]
```

**Classification for `/mctb` probe:**

| Module | Class |
|--------|--------|
| `buildMctbV1Nav` / `mctb-nav` | REQUIRED FOR MCTB SHELL |
| `getMctbPageTitle` | REQUIRED (lightweight metadata) |
| `TransovoSidebar` + `map-nav` | REQUIRED for current MCTB chrome (small UI; not 5 GB alone) |
| `resolve-product-nav` → appointments/sms/voice-nav | OTHER PRODUCT IMPLEMENTATION (unnecessary for MCTB-only nav resolution) |
| `getVoicePageTitle` on MCTB context | OTHER (removed; mctb-nav titles cover bundled voice paths) |
| MobileNav `buildVoiceMobileNav()` eager calls | OTHER (removed) |
| MCTB `page.tsx` → `MctbOverviewView` → home sections | **Not shell** — still compiled at T3 (intentionally not touched this pass) |

---

## Changes made (Pass 1)

### Lightweight MCTB-primary nav boundary

- `src/lib/products/resolve-mctb-primary-nav.ts` — MCTB-only sidebar/mobile nav + shell detection.
- `src/lib/products/resolve-product-nav-shell.ts` — `isMctbShellActive`, `resolveEffectiveProductShell` (no product nav builders).
- `src/lib/products/resolve-product-nav-types.ts` — shared input type.
- `src/lib/products/resolve-product-nav-extended.ts` — appointments, SMS, legacy `buildMctbShellNav`, ai-after-hours ( **not** imported on MCTB path).
- `src/lib/products/resolve-product-nav.ts` — re-exports shell helpers; MCTB-only fast path (extended via throw if mis-called).

### Shell UI wiring

- `sidebar.tsx` — MCTB path uses `buildMctbPrimarySidebarNav`; `require()` extended module **only** in non-MCTB branch.
- `mobile-nav.tsx` — same; removed eager `buildVoiceMobileNav` / mass SMS / ai-after-hours calls.
- `app-shell.tsx` — MCTB titles via `getMctbPageTitle` only; `require()` extended title module only when `!mctbContextActive`.
- `src/lib/shell/resolve-app-shell-title-extended.ts` — non-MCTB titles (unchanged behavior).

### Not done (per scope)

- No MCTB page / loader / runtime changes.
- No global CSS moves (Pass 1 secondary).
- No route-group split.
- No `DEV_MCTB_ONLY` fake shell.

---

## After dependency chains (MCTB path)

```
AppShell
  → getMctbPageTitle (mctb-nav only)
  → Sidebar
      → shouldUseMctbPrimarySidebar → buildMctbV1Nav (mctb-nav)
      → TransovoSidebar (unchanged)
      → [NO static import of voice-nav, appointments-nav, sms-platform-nav on this path]
  → MobileNav
      → buildMctbPrimaryMobileNav only
```

Non-MCTB shells still load `resolve-product-nav-extended` via `require()` when user navigates there.

---

## Files changed

- `src/lib/products/resolve-mctb-primary-nav.ts` (new)
- `src/lib/products/resolve-product-nav-shell.ts` (new)
- `src/lib/products/resolve-product-nav-types.ts` (new)
- `src/lib/products/resolve-product-nav-extended.ts` (new)
- `src/lib/products/resolve-product-nav.ts` (slim)
- `src/lib/shell/resolve-app-shell-title.ts` (new; optional helper)
- `src/lib/shell/resolve-app-shell-title-extended.ts` (new)
- `src/components/layout/app-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/mobile-nav.tsx`

---

## Measurements (mandatory retest)

Environment: `DEV_AUTH_BYPASS=1`, `next dev --port 3000`, `rm -rf .next` once per run, one server, script `scripts/next-dev-memory-audit.sh`.

| Checkpoint | Baseline RSS (MB) | Pass 1 best RSS (MB) | Δ |
|------------|-------------------|----------------------|---|
| T0 | 366.7 | 460.2 (pass1) / 467.9 (pass1b) | ~same order |
| T1 | 329.4 | 392.9 | ~same |
| T2 | 393.7 | 394.9 / 467.9 | ~same |
| **T3** | **5637.9** | **5490.9** (pass1b) / 6041.9 (pass1a) | **−147 MB (~2.6%)** vs baseline |
| T4 | 6365.7 | 6751.0 (pass1) | not primary gate |
| T5 | 6958.1 | 6794.5 (pass1) | not primary gate |

**T3 turbopack cache (pass1b):** `.next` ≈ **1.12 GB**, cache ≈ **0.65 GB** (baseline after T3: 1.10 GB / 0.71 GB — **no meaningful cache reduction**).

**First `/mctb` compile time (pass1):** ~47s wall (baseline not recorded separately; same order of magnitude).

### Result classification

**NO MATERIAL IMPROVEMENT** — T3 fell **<10%** vs baseline (≈2.6%). Shell import cleanup alone **does not explain** the ~5.24 GB T2→T3 cliff.

---

## Interpretation

1. **Idle / health unchanged** — confirms cliff is not global route discovery at startup.
2. **~5+ GB on first `/mctb` remains** — majority likely **outside** the nav-builder imports we split (candidates: **MCTB overview client graph**, **shared `lib/nav` + shell components**, **server `(app)/layout` data loaders**, **Turbopack module retention** for the full RSC+client compile unit).
3. **Turbopack `require()` in dead branches** may still analyze extended modules in some builds; pass1b improved T3 slightly vs pass1a but not enough to change classification.

---

## Functionality preserved

- Desktop sidebar, mobile nav, product switcher, titles, entitlements: **unchanged behavior** (non-MCTB shells still use extended modules).
- MCTB and Voice routes: **no product logic changes**.
- Visual check: not run in automated pass (manual: `/mctb`, `/voice/overview` when dev stable).

---

## Next suspected boundary (do not implement until approved)

**Pass 2 diagnostic:** separate **cost of `(app)/layout` + AppShell client** vs **`/mctb` page module graph** (e.g. controlled probe route with shell but minimal page, or trace `MctbOverviewView` / `mctb-home-sections` import weight). T3 still **>3 GB** — problem not solved.

---

## STOP

No Pass 2 implementation in this change set. Review measurements before next boundary work.
