# MCTB Frontend Rebuild — Kickoff Instructions

**Status:** Active — mandatory for MCTB page implementation  
**Audience:** Cursor / frontend implementation agents  
**Prerequisites:** Product shell + product switcher approved. All MCTB governing docs + page build specs 01–12 (`alwaysApply` rules).

---

## Navigation separation — approved (do not redo)

The following is **correct and frozen** unless a page spec explicitly requires a change:

- Appointments and MCTB are **two product contexts** inside one Transovo shell
- Product switcher sits **above** product-local navigation
- Switching products **replaces the menu** — do not mix both products in one nav
- **Settings** remains shared (org-wide)
- SMS marketing is **not** a third product in the switcher right now
- Mobile navigation changes with the active product

**Do not make further product-shell / navigation changes** unless required by a page build spec.

---

## Three architecture corrections (mandatory)

### 1. Interim MCTB Home must not survive the rebuild

**Temporary (acceptable until Spec 01 ships):**

```
MCTB product home → /voice/missed-calls
```

(`mctbShellHome()` in `src/lib/products/product-shell.ts`)

**After Spec 01 — Overview is implemented:**

```
MCTB product home → /mctb
```

Home and Missed Calls are **different jobs** (Spec 01 vs Spec 02). Once the canonical MCTB Overview exists at `/mctb`, the product switcher Home link, default MCTB landing, and any “overview” CTAs must **not** resolve to the Missed Calls list.

Do **not** use `/mctb/overview` unless the page manifest is explicitly updated — canonical route is **`/mctb`** per Spec 01.

### 2. Routes ≠ backends (do not confuse agents)

**Wrong framing:**

> “MCTB page rebuild at `/mctb/*` routes (nav still points at working `/voice/*` backends)”

**Correct framing:**

The existing **`/voice/*` implementation** (and related `src/lib/mctb/`, `src/lib/agents/missed-call-text-back/`, APIs, Prisma models, webhooks, workers) contains **working MCTB runtime, APIs, components, and data connections** that must be **audited and reused**.

The new canonical MCTB UI may live under **`/mctb/*`**, but:

- **Do not duplicate** or rewrite working telephony/SMS backend merely to change frontend routes
- **`/voice/*` is not “the backend”** — it is the **current frontend route namespace** that often wraps the same runtime
- New pages call the **same authoritative services**; only the presentation layer and route structure change

### 3. Final route cleanup / redirect pass (after pages exist)

After new `/mctb/*` surfaces are implemented and verified:

- Audit **all** internal links, nav items, CTAs, emails, bookmarks, and deep links still pointing at legacy `/voice/*` MCTB UI
- Apply redirects or link updates per `TRANSOVO-MCTB-PAGE-INVENTORY-AND-ROUTE-MANIFEST.md` migration matrix
- Product switcher must not be correct while random old links dump users into deprecated `/voice/*` screens

This is a **dedicated final pass** — not optional.

---

## Rebuild mandate

**Navigation separation is approved. Do not make further product-shell/navigation changes unless required by a page spec. Now begin the MCTB rebuild.**

### Before modifying any MCTB page

1. **Audit** the existing MCTB implementation: working runtime, APIs, data models, shared components, and actions behind each current `/voice/*` or related surface
2. **Preserve** that backend/runtime behavior — goal is to replace/consolidate the **frontend experience**, not rebuild telephony or messaging infrastructure

### Visual / design-system calibration

1. Inspect the **completed Appointments product** visually and structurally
2. Capture screenshots of representative surfaces:
   - dashboard/home
   - list/table
   - detail view
   - configuration/form page
   - drawer/modal patterns
   - empty/error states
   - mobile/responsive behavior
3. Inspect actual **components, design tokens, shell, typography, spacing, cards, tables, buttons, forms, badges, alerts, drawers**, and responsive patterns behind those screens
4. MCTB must look as though built in the **same design-system pass** as Appointments — reuse real Transovo/Appointments components and tokens; **do not** approximate with a separate MCTB design system

### Build order (one page at a time)

Build MCTB surfaces **one at a time** per full page specs in `docs/TRANSOVO-MCTB-PAGE-BUILD-SPECS.md`, in **canonical spec order**.

**For each surface:**

1. Read its **full** page build spec first
2. Audit existing implementation for that surface
3. Identify what backend/runtime **must be preserved**
4. Implement new UI against **real data and actions**
5. Complete all required states: loading, empty, error, degraded, success
6. Complete responsive, keyboard, and accessibility behavior per spec + Transovo standards
7. **Verify the page** before moving to the next spec

### Start here: Spec 01 — MCTB Home (Overview)

- **Route:** `/mctb`
- **Spec:** `docs/TRANSOVO-MCTB-PAGE-BUILD-SPEC-01-OVERVIEW.md`
- **Rule:** `.cursor/rules/transovo-mctb-page-spec-01-overview.mdc`

Home must become a **distinct canonical MCTB overview surface**. It must **no longer** simply resolve to the Missed Calls page once the new Home exists.

Update `mctbShellHome()` → `/mctb` when Spec 01 is verified complete.

**Do not start Spec 02** until Spec 01 is implemented and verified.

### Human gate

Implement **Home first**, produce for review, and **wait for approval** before running through remaining specs unattended.

---

## Spec sequence (this pass)

| # | Surface | Route |
|---|---------|-------|
| 01 | Overview (Home) | `/mctb` |
| 02 | Missed Calls | `/mctb/missed-calls` |
| 03 | Missed Call Detail | `/mctb/missed-calls/:id` |
| 04 | Conversations | `/mctb/conversations` |
| 05 | Visual Voicemail | `/mctb/voicemail` |
| 06 | Analytics | `/mctb/analytics` |
| 07–12 | Setup surfaces | `/mctb/setup/...` |

---

## Non-negotiables (unchanged)

- Keep **both** MCTB modes: `press_1` and `existing_consent`
- Preserve certified MCTB telephony pipeline (`docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`)
- No mock data, fake controls, or parallel business logic in the frontend
- Shared Transovo shell; governing docs + page specs are authority — not legacy page layout
