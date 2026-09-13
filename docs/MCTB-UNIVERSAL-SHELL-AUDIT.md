# MCTB universal shell audit

Launch mode: **`MCTB_V1_PRIMARY`** (`isMctbV1Primary()`). One admin chrome for Missed Call Text Back; shared backends keep canonical routes.

| Route | Current shell (before) | Target shell | Sidebar | Header | Padding | Color | Status |
|-------|------------------------|--------------|---------|--------|---------|-------|--------|
| `/mctb` | MCTB neutral | Universal MCTB | MCTB V1 | Global | `mctb-home-inner` | Blue brand | **Migrated** |
| `/mctb/missed-calls` | MCTB | Universal MCTB | MCTB V1 | Global | Page-owned | Blue | **Migrated** |
| `/mctb/missed-calls/*` | MCTB | Universal MCTB | MCTB V1 | Global | Page-owned | Blue | **Migrated** |
| `/mctb/conversations` | MCTB | Universal MCTB | MCTB V1 | Global | Page-owned | Blue | **Migrated** |
| `/mctb/voicemail` | MCTB | Universal MCTB | MCTB V1 | Global | Page-owned | Blue | **Migrated** |
| `/mctb/analytics` | MCTB | Universal MCTB | MCTB V1 | Global | Full-bleed | Blue | **Migrated** |
| `/mctb/setup` | MCTB | Universal MCTB | MCTB V1 | Global | Full-bleed | Blue | **Migrated** |
| `/mctb/setup/*` | MCTB | Universal MCTB | MCTB V1 | Global | Full-bleed | Blue | **Migrated** |
| `/mctb/calendar` | MCTB | Universal MCTB | MCTB V1 | Global | Canvas | Blue | **Migrated** |
| `/mctb/appointments` | MCTB | Universal MCTB | MCTB V1 | Global | Canvas | Blue | **Migrated** |
| `/mctb/appointments/*` | MCTB | Universal MCTB | MCTB V1 | Global | Canvas | Blue | **Migrated** |
| `/mctb/booking` | MCTB | Universal MCTB | MCTB V1 | Global | Canvas | Blue | **Migrated** |
| `/mctb/reminders` | MCTB | Universal MCTB | MCTB V1 | Global | Canvas | Blue | **Migrated** |
| `/payments` | Appointments / ambiguous | Universal MCTB | MCTB V1 | Global | `MctbPageContainer` tokens | Blue | **Shell context** |
| `/payments/*` | Appointments / ambiguous | Universal MCTB | MCTB V1 | Global | Page-owned | Blue | **Shell context** |
| `/integrations` | SMS / ambiguous | Universal MCTB | MCTB V1 | Global | Page-owned | Blue | **Shell context** |
| `/integrations/*` | SMS / ambiguous | Universal MCTB | MCTB V1 | Global | Page-owned | Blue | **Shell context** |
| `/appointments/*` (legacy) | Appointments | Appointments (legacy) | Appointments | Appointments | Legacy | Legacy | **Excluded** |
| `/login`, `/signup` | Auth | Auth | — | — | — | — | **Excluded** |
| Public `/f/*`, booking | Public | Public | — | — | — | — | **Excluded** |

## Mechanism

- **`isMctbUniversalChromeActive`** — sidebar, header, canvas, tokens when `data-mctb-neutral-shell` is set.
- **`resolveMctbLaunchProductShell`** — MCTB nav on `/payments` and `/integrations` under MCTB launch (no route duplication).
- **`defaultProductShell` / post-login** — default **`/mctb`** when `MCTB_V1_PRIMARY`.
- **Tokens:** `src/components/mctb/shell/mctb-brand-tokens.css`, `mctb-design-tokens.css`, `mctb-sidebar.css`.

## Follow-ups (content-level, not shell)

- Align per-page inner padding to `MctbPageContainer` on Payments / Integrations / Calendar where old scheduler gutters remain.
- Roll blue semantic tokens into shared booking/calendar components (selection, tabs) without changing backends.

## Final status (this pass)

| Check | Value |
|-------|--------|
| MCTB_UNIVERSAL_SHELL | **YES** (chrome + nav context) |
| DEFAULT_LOGIN_DESTINATION | **`/mctb`** |
| UNIVERSAL_SIDEBAR | **YES** |
| UNIVERSAL_HEADER | **YES** (shared `Header`; MCTB title precedence) |
| UNIVERSAL_PAGE_PADDING | **PARTIAL** (canvas + tokens; page-level migration ongoing) |
| UNIVERSAL_COLOR_SYSTEM | **YES** (blue brand tokens) |
| BRAND_ACCENT | **BLUE** |
| GREEN_USED_AS_BRAND | **NO** |
| OLD_APPOINTMENTS_SHELL_VISIBLE_IN_MCTB | **NO** (MCTB launch) |
| OLD_SMS_SHELL_VISIBLE_IN_MCTB | **NO** (MCTB launch) |
| SHARED_PAYMENTS_BACKEND_DUPLICATED | **NO** |
| SHARED_INTEGRATIONS_BACKEND_DUPLICATED | **NO** |
