# Appointment Reminders — Link-Based Customer Self-Service Investigation

**Date:** 2026-10-12  
**Status:** Investigation only (no restoration implemented in this document)  
**Scope:** Restore a fourth customer response option — “Self-Service Link” — by reusing existing link infrastructure, not building a new scheduling system.

---

## Executive summary

**Verdict: (1) Fully implemented backend + customer UI exists, but it is disconnected from Appointment Reminders SMS — not deleted.**

The customer-facing **public pages, APIs, tokens, availability-based reschedule, and provider calendar updates** still exist and work for appointments that have tokens (typically **booked** or **manual** appointments).

What changed with the **notification / SMS reply** product:

- The **AI Rescheduler “handling level”** UI has **three** modes (`reminders_only` | `notify` | `ai`) — SMS **C/R/X**, not a fourth “link” mode.
- For the **platform SMS sender**, outbound SMS **strips all HTTP URLs**, so link self-service cannot work over SMS today even when templates mention `{{appointment_link}}`.
- **Calendar-imported** appointments (the main AR path) **do not mint** `confirmToken` / `cancelToken` / `rescheduleToken` on import, so public links are often **empty or invalid** for imported events.

Restoration is likely **small product wiring** (fourth mode + token minting + stop stripping URLs in that mode + calendar write-back hooks), not a new scheduling stack.

---

## 1. What exists today (files and routes)

### Public routes (customer, no login)

| Route | Page | API |
|--------|------|-----|
| `/appointments/reschedule/[token]` | `src/app/(public)/appointments/reschedule/[token]/page.tsx` → `PublicRescheduleConnected` → `RescheduleFlow` | `src/app/api/public/appointments/reschedule/[token]/route.ts` |
| `/appointments/cancel/[token]` | `src/app/(public)/appointments/cancel/[token]/page.tsx` → `PublicCancelConnected` | `src/app/api/public/appointments/cancel/[token]/route.ts` |
| `/appointments/confirm/[token]` | `src/app/(public)/appointments/confirm/[token]/page.tsx` | `src/app/api/public/appointments/confirm/[token]/route.ts` |

There is **no** live route at `/appointments/manage/[token]` (only preview placeholders in `src/lib/appointment-reminders/template-library/preview-vars.ts`). **Manage URL** in merge vars resolves to the **reschedule** public URL when a `rescheduleToken` exists (`resolveManageLinkFromMetadata` in `src/lib/appointments/settings.ts`).

### Customer UI (Kimi, mobile-oriented)

- **Reschedule:** `src/components/appointments/kimi-ui/public-reschedule/components/RescheduleFlow.tsx` — loads slots from API, slot picker, success states; supports **`requestOnly`** when staff-approval workflow applies.
- **Cancel:** `src/components/appointments/kimi-ui/public-cancel/components/public-cancel-client.tsx` — confirmation step, success / already canceled / invalid link.

### Token and URL infrastructure

- **Token generation:** `publicToken()` in `src/lib/appointments/settings.ts` (48-byte hex).
- **Stored on appointment metadata:** `confirmToken`, `cancelToken`, `rescheduleToken` (`src/lib/appointments/types.ts`).
- **Lookup:** `findAppointmentByPublicToken()` in `src/lib/appointments/booking-platform.ts` (JSON path query on metadata).
- **Each API enforces token kind** (e.g. reschedule route requires `metadata.rescheduleToken === token`).

**Tokens are created when:**

- Staff/platform **booking** flow runs (`src/lib/appointments/booking-platform.ts`, ~431–536).
- **Manual AR** appointment create (`src/lib/appointment-reminders/ar-manual-appointments.ts`).

**Tokens are not created in:**

- `buildImportMetadata()` / calendar import (`src/lib/calendar/import-sync.ts`) — no `publicToken()` usage under `src/lib/calendar/`.

### Server behavior (reuse, not a second engine)

| Action | Implementation |
|--------|----------------|
| Reschedule (instant) | `reschedulePlatformAppointment()` → slot snap, DB update, `syncExternalCalendarOnReschedule()` (`booking-platform.ts`) |
| Reschedule (staff request) | `requestRescheduleViaPublicEmail()` when `publicEmailActionsUseStaffRequestWorkflow()` is true (same gate as email; plan + AI mode) |
| Cancel (instant) | `cancelPlatformAppointment()` → `cancelAppointment()` + reminder suppression |
| Cancel (request) | `requestCancellationViaPublicEmail()` |
| Confirm | `updatePlatformAppointmentStatus(..., "confirmed", ...)` |

**Availability for public reschedule:** `getAvailability()` in the GET handler (14 days ahead, future slots filtered).

---

## 2. “Three options” vs link — what the UI actually is

The selectable **response handling** surface is **AI Rescheduler → Handling level** (`src/newui-transplant/connected/appointment-reminders/ar-ai-rescheduler-opus.tsx`):

1. **Reminders only** — no C/R/X suffix, no inbound change handling (`reminders_only`).
2. **Notify staff** — C/R/X on SMS; staff notified on change requests (`notify`).
3. **AI handles supported changes** — C/R/X + AI calendar mutation per approval (`ai`).

**Types:** `AiReschedulerMode` in `src/lib/appointment-reminders/ai-rescheduler/types.ts`.  
**Plan gates:** `aiReschedulerModes` in `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts`.

**Notifications & responses** settings (`src/newui-transplant/components/appointment-reminders/ar-notifications-responses-panel.tsx`) only **documents** confirm / cancel / reschedule (SMS + email links); it does **not** expose a fourth mode.

### Git history (high level)

- `reminders_only` as third mode: `f551940ea` — feat(ar): persist reminders_only as third AI Rescheduler handling mode.
- Earlier AI Rescheduler + C/R/X: `2badfca10`.
- **No commit found** adding a `link` / `self_service` `AiReschedulerMode` — the link path was not removed as a fourth enum; it was **never** a fourth handling level in this codebase.

---

## 3. Does the public link still work?

**Yes, if the appointment has the right token in metadata.**

- Opening `/appointments/reschedule/{rescheduleToken}` or `/appointments/cancel/{cancelToken}` hits live API + UI.
- Invalid/wrong token → **404** `"Invalid token"`.
- For many **calendar-imported** AR appointments, tokens are **missing** → merge vars produce empty links; SMS may strip or sanitize them anyway (see section 4).

**Customer sees:** service/time from `buildPublicAppointmentCustomerPreview()` (`src/lib/appointments/appointments-service.ts`) — limited fields; business name is not in that preview type today. Cancel/reschedule UIs use Kimi shells with “Powered by Transovo”.

**Reschedule vs cancel:** **Separate URLs/tokens**, not one combined manage page. Reschedule flow does not embed cancel navigation in the code reviewed.

**Calendar update:**

- **Reschedule (POST, non-request-only):** provider sync via `syncExternalCalendarOnReschedule`.
- **Cancel (POST, non-request-only):** `cancelAppointment` on provider through existing voice/calendar booking path.
- **Calendar write-back** (status block/categories on Outlook): **not** called from public confirm/cancel/reschedule routes today — only from AR SMS/commit paths (e.g. `triggerArCalendarWriteBack` in inbound-replies, commit-reschedule, confirm-calendar).

---

## 4. SMS / templates vs links (why link mode “disappeared” for AR)

- Merge tags: `reminderAppointmentMergeVars()` sets `appointment_link` / `manage_link` from `resolveManageLinkFromMetadata` + tokens (`src/lib/appointment-reminders/template-library/merge-context.ts`).
- Approved **platform** library SMS bodies can include `Details: {{appointment_link}}` (`src/lib/appointment-reminders/template-library/transovo-reminder-templates.json`).
- **But** for platform sender, after render (`src/lib/appointments/reminder-delivery.ts`):

```ts
let smsBody = finalizeReminderSmsBody(body);
if (platformSender) {
  smsBody = stripHttpUrlsFromSmsBody(smsBody);
}
```

`stripHttpUrlsFromSmsBody` in `src/lib/appointment-reminders/message-sanitize.ts` documents: *“Platform AR uses reply letters (C/R/X), not customer login URLs.”*

So for the commercial AR SMS product, **link self-service was superseded by SMS reply + notify/AI modes**, not by deleting public pages. Email reminders can still carry links (separate channel path; `stripHttpUrls` is SMS-only).

`PLATFORM_AR_ALLOWED_MERGE_TAGS` includes `{{appointment_link}}` but **not** `{{manage_link}}` / `{{reschedule_link}}` (`src/lib/appointment-reminders/platform-template-policy.ts`) — links in SMS are only via the approved `appointment_link` pattern, then URLs are removed unless policy changes per mode.

---

## 5. Related but separate: service-booking “manage appointment”

Commit `d72ef6a76` expanded **`/api/public/manage/[token]`** and `manage-appointment-public-client.tsx` for **service booking / portal** (pay, intake, etc.). That is a **different** token/route family from AR’s `confirmToken` / `rescheduleToken` / `cancelToken` triad. Do not conflate when restoring AR link mode.

---

## 6. What needs restoration vs new work

| Area | Status |
|------|--------|
| Public reschedule/cancel/confirm pages + APIs | **Exists** — polish/unify UX optional |
| Availability + provider reschedule/cancel | **Exists** |
| Secure tokens + lookup | **Exists** |
| Fourth config option “Self-Service Link” | **Missing** — extend `AiReschedulerMode` (or parallel flag) + UI card + plan gates |
| Tokens on **calendar import** | **Missing** — must mint (and optionally rotate on reschedule) |
| SMS includes working link | **Blocked** by `stripHttpUrlsFromSmsBody` unless mode-specific exception |
| SMS C/R/X when link mode selected | Should stay **off** (like `reminders_only` for suffix) |
| Unified “manage” page (reschedule + cancel) | **Missing** — only separate token URLs today |
| Calendar write-back on link actions | **Partial** — wire public flows to existing `triggerArCalendarWriteBack` / `reflectCustomerConfirmationOnProvider` |
| `reminders_only` / `notify` / `ai` behavior | **Unchanged** until explicitly branched |

**Estimated shape:** mostly **configuration + token minting + SMS policy + write-back triggers + UI fourth card**; not a new calendar or rescheduling engine.

---

## 7. Product requirements mapping (from feature brief)

### Fourth option (target)

- **Label:** Self-Service Link  
- **Description:** “Send customers a secure link to reschedule or cancel their appointment online.”  
- **Placement:** Alongside existing three handling levels on AI Rescheduler (or equivalent AR response configuration).  
- **Preserve:** All three existing modes unchanged.

### Link option behavior (target)

1. Send reminder via existing SMS workflow.  
2. Include secure, appointment-specific management link (`appointment_link` → reschedule URL today).  
3. Customer opens link without Transovo account.  
4. View appointment details; reschedule or cancel per business rules.  
5. Process through existing `reschedulePlatformAppointment` / `cancelPlatformAppointment` / request-only paths.  
6. Update original Google/Microsoft event via existing sync.  
7. Update reminders, status, activity; integrate **Calendar Write-Back** (no duplicate write-back system).

### Secure links (verify on restore)

- Unguessable per-appointment tokens (`publicToken`).  
- No auth required; token kind scoping on each route.  
- Invalid/expired → appropriate error UI.  
- Consider token rotation after reschedule so old links cannot modify wrong slot.  
- Do not introduce a second token system.

### Testing checklist (from brief)

1. Existing three response modes unchanged.  
2. Fourth mode saves correctly.  
3. SMS contains correct URL (link mode only).  
4. Public open without login.  
5. Correct appointment shown.  
6. Reschedule with real availability.  
7. Cancel / request per rules.  
8. Provider calendar updated.  
9. Calendar write-back status/colors.  
10. Reminders recalculated or suppressed.  
11. Invalid/reused links safe.  
12. Platform-sender restrictions intact for non-link modes.  
13. Mobile UX.  
14. No regression to SMS reply, notify, or AI rescheduling.

---

## 8. Suggested execution order (implementation)

1. Add `self_service_link` (or `link`) to `AiReschedulerMode`, plan catalog, API validation, and AI Rescheduler Opus grid (fourth card with link/calendar icon).  
2. Implement `ensurePublicActionTokens()` on calendar import and before first reminder send if missing.  
3. In `buildReminderSmsBodyForOutbound`: if link mode — **do not** strip URLs; **do not** append C/R/X; ensure approved template includes `{{appointment_link}}`.  
4. Hook public POST handlers to existing outcomes + **calendar write-back** (same triggers as SMS).  
5. Optional: thin **manage** wrapper page (reschedule token + link to cancel token).  
6. Automated tests per checklist above.

---

## 9. Open design choice

**Fourth mode on `AiReschedulerMode` vs separate `appointmentReminders.customerResponseMode` flag**

- Extending **`AiReschedulerMode`** matches the “fourth response option” wording and the existing AI Rescheduler settings screen.  
- A separate workspace flag could decouple link mode from notify/ai plan gates but duplicates mental model.

Pick one before implementation; both can persist through `saveAppointmentPlatformConfig` / `aiRescheduler` patch.

---

## 10. Key file index

| Concern | Path |
|---------|------|
| Mode types | `src/lib/appointment-reminders/ai-rescheduler/types.ts` |
| Mode UI | `src/newui-transplant/connected/appointment-reminders/ar-ai-rescheduler-opus.tsx` |
| Plan gates | `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts` |
| API save mode | `src/app/api/appointment-reminders/ai-rescheduler/route.ts` |
| SMS body + URL strip | `src/lib/appointments/reminder-delivery.ts`, `src/lib/appointment-reminders/message-sanitize.ts` |
| Merge / links | `src/lib/appointment-reminders/template-library/merge-context.ts` |
| Platform template policy | `src/lib/appointment-reminders/platform-template-policy.ts` |
| Public URLs | `src/lib/appointments/settings.ts` (`publicActionUrl`, `resolveManageLinkFromMetadata`) |
| Token lookup | `src/lib/appointments/booking-platform.ts` (`findAppointmentByPublicToken`) |
| Import metadata | `src/lib/calendar/import-sync.ts` (`buildImportMetadata`) |
| Public reschedule API | `src/app/api/public/appointments/reschedule/[token]/route.ts` |
| Public cancel API | `src/app/api/public/appointments/cancel/[token]/route.ts` |
| Public confirm API | `src/app/api/public/appointments/confirm/[token]/route.ts` |
| Calendar write-back trigger | `src/lib/appointment-reminders/calendar-write-back/trigger.ts` |
| Staff request gate | `src/lib/appointment-reminders/public-customer-actions.ts` |

---

*End of investigation report.*
