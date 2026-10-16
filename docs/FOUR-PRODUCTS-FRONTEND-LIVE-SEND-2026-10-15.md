# Four products — production front-end live send (2026-10-15)

**Target handset:** +1 571-477-6175  
**Environment:** https://transovo.ai (production UI, dev-bypass cert workspace `ws_1`)

## Results

| Product | Front-end path | Result | Notes |
|---------|----------------|--------|-------|
| **Mass Texting** | `/campaigns/new` → Review → Send Now | **PASS** | Campaign “Mass text front-end test Oct 15” — **1 sent, 1 delivered (100%)** to 571-477-6175 |
| **Review Requests** | `/reviews/requests` → Send SMS | **PASS** (after deploy `fed719a34`) | Backend bugs fixed: missing `requireCampaignSendAccess`, wrong permission arg order, audit `userId` |
| **Appointment Reminders** | `/appointment-reminders` → New appointment | **PARTIAL** | Alex / 5714776175 @ 6:15 PM created; **Rapid Flow (minutes)** workflow attached — reminder fires relative to appointment time, not manual test button |
| **MCTB** | `/mctb/phone` verify UI | **BLOCKED (PSTN)** | No “send test SMS to number” in UI. Recovery requires **call business line (571) 477-6175 from another phone**, no answer → auto text to **caller** |

## Review send bugs fixed (master)

1. `requireCampaignSendAccess` missing from `src/lib/auth/entitlements.ts`
2. `requireOrganizationPermission` called with reversed args; stub returned `void` but audit expected `userId`
3. Deploy: `fed719a3473b2a963fb460db2b257318a087f63c`

## MCTB customer instruction

From a **second phone** (or use 571-477-6175 as caller): call **(571) 477-6175**, let it ring unanswered. MCTB should text the **calling** number (must be 571-477-6175 to receive on your test handset).

## Appointment reminder instruction

For **immediate** booking confirmation SMS, workspace must have confirmation step enabled; new appointments sync from UI create into M365 + reminder discovery jobs. Use an appointment **start time soon** so timed steps fire without using Settings → Send test.

## Evidence

- Mass: `journey2-mass-texting-success.png`, `test-b-mass-texting-pass-delivered.png`
- Reviews error (pre-fix): `journey1-review-requests-sms-error.png`
- Appointments: `journey3-appointment-created-success.png`
