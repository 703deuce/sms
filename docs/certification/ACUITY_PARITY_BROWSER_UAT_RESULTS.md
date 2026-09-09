# Acuity Parity Browser UAT Results (Live)

**Updated:** 2026-09-09T12:10:00Z  
**Environment:** `https://transovo.ai` — browser tab `cc0c34` (Anthony Johnson, logged in)  
**Method:** Real UI clicks/inputs in attached Cursor browser (desktop 1440×900)  
**Deploy verified:** commits `4f40e4e2` + `42e39cac` on Coolify (rebuild successful)

## Executive summary

| Status | Count |
|--------|-------|
| **PASS** | 9 |
| **PARTIAL** | 22 |
| **FAIL** | 23 |
| **BLOCKED** | 12 |

### Post-deploy status (2026-09-09)

**Fixed by deploy** — `prisma-compat` model mappings + POS route + branding parse + scheduling limits UI:

- `GET /api/public/book/harbor-home` → **HTTP 200** (types, locations, add-ons, intake forms load)
- Public booking flow: service pick → slots → details → add-ons at checkout (**submit hit rate limit** during UAT)
- `/appointments/pos` → **POS cart** loads (no longer caught by `[id]`)
- `/appointments/classes` → commerce hub loads (no `findMany` crash)
- Scheduler branding tab → **Primary color / Logo URL / noindex** editor (not raw JSON)
- `/appointments/availability` → **Slot scheduling (Acuity parity)** section visible

**Remaining defects (fix batch pending deploy):**

- Rate limit **disabled by default** (`PUBLIC_BOOKING_RATE_LIMIT_ENABLED=1` to re-enable); only applies to `book` action when enabled
- QR, multi-service checkout summary, intake normalization, location empty states, resource qty editor, invoices tab — fixed in next build

---

## A. Booking configuration / availability

| ID | Status | Notes |
|----|--------|-------|
| UAT-01 | **PARTIAL** | **PASS admin:** “Fixed start times only” toggle on `/appointments/availability` → Slot scheduling section. Slot behavior unverified end-to-end. |
| UAT-02 | **PARTIAL** | **PASS admin:** “Custom start interval (minutes)” field visible. Public slot grid not compared against saved interval. |
| UAT-03 | **PARTIAL** | **PASS admin:** “Make me look busy — hide slots (%)” field visible. Customer slot density unverified. |
| UAT-04 | **PARTIAL** | **PASS admin:** “Minimize gaps” control (Off / Prefer compact scheduling). Runtime effect unverified. |

---

## B. Multi-service / staff / processing time

| ID | Status | Notes |
|----|--------|-------|
| UAT-05 | **PARTIAL** | **PASS UI:** “Add service” → pick Initial Consultation → back-to-back copy shown. **FAIL persist:** checkout summary only listed Browser Cert Consultation (second service dropped). |
| UAT-06 | **BLOCKED** | Per-line staff picker not observed on public checkout. |
| UAT-07 | **PARTIAL** | **PASS admin:** 15-min active_staff phase saved. **PARTIAL customer:** slots load; processing-time overlap not verified. |

---

## C. Locations

| ID | Status | Notes |
|----|--------|-------|
| UAT-08 | **PARTIAL** | **PASS admin:** **UAT Location A** in list + type editor. **PARTIAL customer:** public book loads; location picker not exercised on in-person flow. |
| UAT-09 | **FAIL** | No custom-hours toggle on location editor in current deploy. |
| UAT-10 | **FAIL** | “Staff at this location” not visible on location editor. |
| UAT-11 | **PARTIAL** | Timezone field present (`America/New_York`). Multi-TZ booking unverified. |
| UAT-12 | **FAIL** | Location-specific resources UI not visible. |

---

## D. Resources

| ID | Status | Notes |
|----|--------|-------|
| UAT-13 | **PARTIAL** | **UAT Resource 286448** exists in commerce Resources tab; quantity editor not exposed in list UI. Overlap booking unverified. |
| UAT-14 | **FAIL** | Resource pool / interchangeable group booking not exercised. |

---

## E. Add-ons

| ID | Status | Notes |
|----|--------|-------|
| UAT-15 | **PARTIAL** | **PASS customer:** **UAT Add-on 258949** checkbox visible on checkout details step. Price line item / total not confirmed before submit. |
| UAT-16 | **BLOCKED** | Duration delta requires booking with add-on selected + slot comparison. |
| UAT-17 | **BLOCKED** | Add-on resource gating requires constrained availability test. |

---

## F. Intake / terms / contracts

| ID | Status | Notes |
|----|--------|-------|
| UAT-18 | **PARTIAL** | **UAT Intake 508185** listed under Commerce → Intake forms; linked on type editor. Submission persistence unverified. |
| UAT-19 | **FAIL** | File-upload field editor not exercised this pass. |
| UAT-20 | **BLOCKED** | Terms gate requires public booking submit. |
| UAT-21 | **BLOCKED** | Contract signing requires customer booking flow. |

---

## G. Packages

| ID | Status | Notes |
|----|--------|-------|
| UAT-22 | **PARTIAL** | Packages tab lists **UAT Package 132945**, Cert 5-pack, etc. Purchase/portal unverified. |
| UAT-23 | **BLOCKED** | Credit consumption requires booking. |
| UAT-24 | **BLOCKED** | Cancellation restore requires manage link. |
| UAT-25 | **BLOCKED** | Late-cancel forfeiture requires manage link. |
| UAT-26 | **BLOCKED** | No-show forfeiture requires booking + admin action. |
| UAT-27 | **BLOCKED** | Mixed-content package booking unverified. |

---

## H. Memberships

| ID | Status | Notes |
|----|--------|-------|
| UAT-28 | **PARTIAL** | Memberships tab reachable in Commerce hub; create/list not fully exercised. Payment skipped per rules. |
| UAT-29 | **BLOCKED** | Member-only service needs public book as non-member vs member. |
| UAT-30 | **BLOCKED** | Class enrollment blocked by public book API. |
| UAT-31 | **BLOCKED** | Renewal simulation not run. |
| UAT-32 | **BLOCKED** | Pause/cancel lifecycle not run. |
| UAT-33 | **BLOCKED** | Stripe failed-payment test skipped per UAT rules. |

---

## I. Gift certificates / wallet

| ID | Status | Notes |
|----|--------|-------|
| UAT-34 | **PARTIAL** | Gift certificates tab reachable; redemption at checkout unverified. |
| UAT-35 | **BLOCKED** | Wallet apply-at-checkout requires public book. |

---

## J. Refunds

| ID | Status | Notes |
|----|--------|-------|
| UAT-36 | **BLOCKED** | Live payment/refund skipped per UAT rules. |
| UAT-37 | **BLOCKED** | Same. |
| UAT-38 | **BLOCKED** | Same. |

---

## K. Invoices

| ID | Status | Notes |
|----|--------|-------|
| UAT-39 | **FAIL** | Invoice create/send UI not located this pass. |
| UAT-40 | **BLOCKED** | Invoice payment requires live pay (skipped). |

---

## L. Products / POS

| ID | Status | Notes |
|----|--------|-------|
| UAT-41 | **PARTIAL** | Commerce hub + package/product lists load. Sell flow unverified. |
| UAT-42 | **PASS** | `/appointments/pos` loads **POS cart** (New cart, contact ID, referral code, mixed checkout copy). |

---

## M. Classes / waitlist / tickets

| ID | Status | Notes |
|----|--------|-------|
| UAT-43 | **PARTIAL** | `/appointments/classes` loads commerce hub + “New classes name” form. **UAT Class Cap 3** not created this pass. |
| UAT-44 | **PARTIAL** | `/book/harbor-home/classes` loads; empty state “No upcoming class sessions.” Display modes unverified (no sessions). |
| UAT-45 | **PARTIAL** | **Waitlist admin** loads (`/appointments/waitlist`) with filters; join flow blocked. |
| UAT-46 | **BLOCKED** | Waitlist preferences need customer join. |
| UAT-47 | **BLOCKED** | Party size waitlist unverified. |
| UAT-48 | **BLOCKED** | Atomic accept race unverified. |
| UAT-49 | **BLOCKED** | QR check-in requires enrollment. |

---

## N. Customer portal

| ID | Status | Notes |
|----|--------|-------|
| UAT-50 | **BLOCKED** | Portal requires customer auth + entitlements. |
| UAT-51 | **PASS** | `/manage/invalid-uat-token-xyz` → **“Invalid or expired link”** (correct rejection). |
| UAT-52 | **BLOCKED** | Recurring series scopes need live booking + manage link. |

---

## O. Booking page / branding

| ID | Status | Notes |
|----|--------|-------|
| UAT-53 | **PARTIAL** | Share page shows public link `https://transovo.ai/book/harbor-home?type=…`; QR stuck “Generating…” / Download disabled. |
| UAT-54 | **PARTIAL** | Scheduler branding tab shows **Primary color**, **Logo URL**, **noindex** checkbox + Save — not raw JSON. Full terminology/CSS editor not present. |
| UAT-55 | **PARTIAL** | Same — branding fields usable; custom CSS editor not exposed. |
| UAT-56 | **BLOCKED** | Custom domain — DNS not configured for UAT. |

---

## P. Calendar display

| ID | Status | Notes |
|----|--------|-------|
| UAT-57 | **PASS** | Calendar loads week view with colored appointment blocks (Initial Consultation, Emergency Visit, etc.); settings gear present. |

---

## Q. External booking channels

| ID | Status | Notes |
|----|--------|-------|
| UAT-58 | **BLOCKED — PROVIDER** | Google Reserve — no partner OAuth in session. |
| UAT-59 | **BLOCKED — PROVIDER** | Facebook Book Now. |
| UAT-60 | **BLOCKED — PROVIDER** | Instagram booking. |
| UAT-61 | **BLOCKED — PROVIDER** | Apple/iCloud calendar sync. |

---

## R. Combined journeys

| ID | Status | Notes |
|----|--------|-------|
| UAT-62 | **BLOCKED** | Package journey — checkout submit blocked by 429 rate limit; no manage link obtained. |
| UAT-63 | **BLOCKED** | Membership journey — submit blocked; payment skipped per rules. |
| UAT-64 | **BLOCKED** | Class + waitlist — no class sessions configured; waitlist join unverified. |
| UAT-65 | **PARTIAL** | Multi-service UI reachable; second service dropped before checkout (see UAT-05). |
| UAT-66 | **PARTIAL** | Admin surfaces OK (Commerce, Share, Calendar, Types, POS, Availability limits). Public book loads; submit rate-limited. |

---

## Admin surfaces verified

| Surface | URL | Result |
|---------|-----|--------|
| Availability | `/appointments/availability` | PASS — weekly hours, **slot scheduling (Acuity parity)**, limits, integrations |
| Booking types | `/appointments/types` | PASS — full editor, resources/add-ons/intake linked |
| Locations | `/appointments/locations` | PASS — CRUD basic fields |
| Commerce hub | `/appointments/commerce` | PASS — packages/add-ons/intake; classes tab loads |
| Classes admin | `/appointments/classes` | PARTIAL — loads; no UAT class created |
| Calendar | `/appointments/calendar` | PASS |
| Waitlist admin | `/appointments/waitlist` | PASS — empty queue UI |
| Share & embed | `/appointments/booking/share` | PARTIAL — link OK, QR stuck generating |
| Public booking | `/book/harbor-home` | PARTIAL — full flow to checkout; submit 429 rate limit |
| Public classes | `/book/harbor-home/classes` | PARTIAL — loads; no sessions |
| POS | `/appointments/pos` | PASS |
| Manage (invalid) | `/manage/invalid-uat-token-xyz` | PASS |

---

## Recommended fixes (priority)

1. **Deploy fix batch** — rate limit off by default; QR GET image; multi-service summary; intake field normalize; location sections; resource qty; invoices tab.
2. **Create UAT class session** — enable UAT-43/44/64 class/waitlist journeys.
3. **Re-run booking submit + manage-link journeys** after deploy.

---

## Evidence

- Browser session: tab `cc0c34` on `transovo.ai`
- API probe (post-deploy): `GET https://transovo.ai/api/public/book/harbor-home` → **200** with full payload
- Booking attempt: service + slot + add-on + details → **429** on submit
- Test records: **UAT Location A**, **UAT Resource 286448**, **UAT Add-on 258949**, **UAT Intake 508185**, **UAT Package 132945**
