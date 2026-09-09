# Acuity Parity Browser UAT Results (Live)

**Updated:** 2026-09-09T07:25:00Z  
**Environment:** `https://transovo.ai` — browser tab `cc0c34` (Anthony Johnson, logged in)  
**Method:** Real UI clicks/inputs in attached Cursor browser (desktop 1440×900)

## Executive summary

| Status | Count |
|--------|-------|
| **PASS** | 8 |
| **PARTIAL** | 13 |
| **FAIL** | 31 |
| **BLOCKED** | 14 |

### Root cause (not connectivity)

`GET /api/public/book/harbor-home` returns:

```json
{"error":"Cannot read properties of undefined (reading 'findMany')"}
```

This is a **production server/DB migration bug** (Prisma model/client missing on deployed build). It blocks all public booking, checkout, portal, slot verification, and most customer journeys. Classes commerce tab shows the same error. Internet connectivity is **not** the issue — API fails consistently after retry.

Secondary defects:
- `/appointments/pos` → **Appointment not found** (`[id]` route catches `pos`)
- Scheduling limits UI (fixed starts, interval, look busy, minimize gaps) **not shipped** in admin
- Scheduler branding tab renders raw JSON blob instead of editor (UAT-54/55)
- Location editor missing staff/hours/resources sections visible in current deploy

---

## A. Booking configuration / availability

| ID | Status | Notes |
|----|--------|-------|
| UAT-01 | **FAIL** | No fixed-start-times UI on Types or Availability. Public book API broken. |
| UAT-02 | **FAIL** | No custom start interval control in UI. |
| UAT-03 | **FAIL** | No “Make Me Look Busy” control in UI. |
| UAT-04 | **FAIL** | No minimize-gaps / compact scheduling control in UI. |

---

## B. Multi-service / staff / processing time

| ID | Status | Notes |
|----|--------|-------|
| UAT-05 | **BLOCKED** | Public booking does not load — cannot test multi-service checkout. |
| UAT-06 | **BLOCKED** | Same — per-line staff picker requires booking flow. |
| UAT-07 | **PARTIAL** | **PASS admin:** Added 15-min active_staff phase on Browser Cert Consultation; Save phases succeeded. **BLOCKED customer:** slot overlap unverified (public book API 500). |

---

## C. Locations

| ID | Status | Notes |
|----|--------|-------|
| UAT-08 | **PARTIAL** | **PASS admin:** Created **UAT Location A**, saved, visible in list + on type editor. **BLOCKED customer:** public book broken. |
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
| UAT-15 | **PARTIAL** | **UAT Add-on 258949** exists; attached on Browser Cert Consultation type. Price at checkout unverified (public book broken). |
| UAT-16 | **BLOCKED** | Duration delta requires public slot comparison. |
| UAT-17 | **BLOCKED** | Add-on resource gating requires public availability. |

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
| UAT-42 | **FAIL** | `/appointments/pos` shows **Appointment not found** — route conflict with `[id]`. |

---

## M. Classes / waitlist / tickets

| ID | Status | Notes |
|----|--------|-------|
| UAT-43 | **FAIL** | Classes tab errors: `findMany` on load; cannot create **UAT Class Cap 3**. |
| UAT-44 | **BLOCKED** | Display modes require public class page. |
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
| UAT-54 | **FAIL** | Scheduler branding tab shows raw JSON config, not terminology editor. |
| UAT-55 | **FAIL** | Same — no usable custom CSS editor visible. |
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
| UAT-62 | **BLOCKED** | Trainer package journey — public book broken. |
| UAT-63 | **BLOCKED** | Membership journey — public book broken. |
| UAT-64 | **BLOCKED** | Class + waitlist journey — classes API broken. |
| UAT-65 | **BLOCKED** | Multi-service journey — public book broken. |
| UAT-66 | **PARTIAL** | Admin surfaces reachable (Commerce, Share, Calendar, Types); POS broken; public book broken. |

---

## Admin surfaces verified

| Surface | URL | Result |
|---------|-----|--------|
| Availability | `/appointments/availability` | PASS — weekly hours, limits, integrations |
| Booking types | `/appointments/types` | PASS — full editor, resources/add-ons/intake linked |
| Locations | `/appointments/locations` | PASS — CRUD basic fields |
| Commerce hub | `/appointments/commerce` | PARTIAL — packages/add-ons/intake OK; classes error |
| Calendar | `/appointments/calendar` | PASS |
| Waitlist admin | `/appointments/waitlist` | PASS — empty queue UI |
| Share & embed | `/appointments/booking/share` | PARTIAL — link OK, QR pending |
| Public booking | `/book/harbor-home` | **FAIL** — findMany API error |
| POS | `/appointments/pos` | **FAIL** — wrong page |
| Manage (invalid) | `/manage/invalid-uat-token-xyz` | PASS |

---

## Recommended fixes (priority)

1. **Deploy DB migration** — ensure Prisma models used by `listBookingCategories`, `listIntakeForms`, `listCustomerFieldDefinitions`, `classSeries`, etc. exist on production (`findMany` crash).
2. **Fix `/appointments/pos` route** — register static `pos` before dynamic `[id]` or use `/appointments/point-of-sale`.
3. **Ship scheduling limits UI** — fixed starts, custom interval, density, minimize gaps (backend exists).
4. **Fix Scheduler branding tab** — render editor instead of raw JSON.
5. **Expand location editor** — custom hours, staff, resources per location (code exists in `locations-connected.tsx`).

---

## Evidence

- Browser session: tab `cc0c34` on `transovo.ai`
- API probe: `curl https://transovo.ai/api/public/book/harbor-home` → findMany error
- Test records created: **UAT Location A** (locations)
