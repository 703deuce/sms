# Appointment Reminders — Customer priority & competitor review

**Date:** 2026-10-11  
**Scope:** Research + validation for Overview hierarchy and conversation UX (complements navigation pass PR #640).  
**Evidence types:** `PUB` = public help/marketing, `CODE` = repository inspection, `ASSUME` = not verified in authenticated UI.

---

## Ranked customer-facing priorities (Transovo)

| Priority | Workflow | Transovo surface | Class |
|----------|----------|------------------|-------|
| 1 | Action required now (replies, reschedule/cancel, failures, pause) | Overview alerts, Responses, Reminders | B/C |
| 2 | Full SMS conversations | Overview panel, Responses thread sheet, conversation APIs | C (presentation improved this pass) |
| 3 | Appointment readiness (phone, reminder scheduled, blocked) | Appointments, Overview needs-attention, upcoming | B |
| 4 | Delivery failures | Overview failed callout, Reminders log | B |
| 5 | Upcoming + confirmation status | Overview upcoming, Appointments engagement tabs | A |
| 6 | Sequences & templates | Reminders submenu | A (nav PR #640) |
| 7 | Calendar sync health | Alert when broken; Integrations settings | B |
| 8 | AI Rescheduler | Dedicated page; appointment drawer actions | A |
| 9 | Analytics | Analytics page; compact Overview stats | A |
| 10 | Admin settings / billing | Settings submenu; Plan & Billing | A (nav PR #640) |

**Elevation rule:** Paused reminders, broken calendar, sender blockers, and delivery failures jump to top when present (implemented on Overview).

---

## Competitor comparison matrix

| Pattern | AppointmentReminder.com | Apptoto | GoReminders | Transovo | Class |
|---------|-------------------------|---------|-------------|----------|-------|
| Unified reply inbox | `PUB` Marketing: unified communications inbox for SMS replies — https://appointmentreminder.com/ | `PUB` Inbox/Outbox tab, filter by appointment — https://www.apptoto.com/apptoto-manual/article/inbox-outbox-tab/ | `ASSUME` No reliable public inbox UI found in this pass | Responses + Overview conversations; thread sheet added | C |
| Full conversation view | `PUB` Two-way SMS; staff can reply — https://appointmentreminder.com/ | `PUB` Conversation view from inbox/appointments — https://www.apptoto.com/apptoto-manual/article/getting-started/reply-to-a-client/ | `ASSUME` | `CODE` `conversationMessage` thread API; bubble UI | C |
| Confirm / cancel / reschedule from SMS | `PUB` Reply-driven workflow — https://appointmentreminder.com/ | `PUB` Auto-replies for 1/2/3 — https://www.apptoto.com/apptoto-manual/article/message-setup/auto-messages/auto-replies-actions/ | `ASSUME` | `CODE` C/R/X + free-text; Responses filters | A |
| Dashboard emphasizes replies | `PUB` Workflow dashboard lists workflows/pending — https://support.appointmentreminder.com/en/articles/2732702-workflow-dashboard | `PUB` Inbox is primary comms hub | `ASSUME` | Overview reordered: conversations before KPI strip | C |
| Reminder send proof | `PUB` Reports/transactions + calendar icons — https://support.appointmentreminder.com/en/articles/2732698-confirm-a-appointment-reminder-has-been-sent | `PUB` Outbox folder | `ASSUME` | Reminders activity log + appointment timeline | A |
| Failed send alerts | `ASSUME` | `PUB` Settings > Notifications failures — https://www.apptoto.com/apptoto-manual/article/handling-replies/confirmations-cancellations-reschedule-requests/ | `ASSUME` | Overview failed-7d callout + Reminders log | B |
| Calendar sync | `PUB` Google setup — https://support.appointmentreminder.com/en/articles/2732703-getting-started-with-google-calendar | `ASSUME` | `ASSUME` | Integrations tab; Overview alert when unhealthy | B |
| Manual staff SMS reply | `PUB` Supported — https://appointmentreminder.com/ | `PUB` Compose + reply | `ASSUME` | **Out of scope** — platform-sender model; no freeform outbound | E |

**GoReminders / Appointment-Reminders.com:** Not enough source-backed authenticated UI evidence in this pass; rows marked `ASSUME` should be revisited with screenshots or trials.

---

## Overview — before vs after (this pass)

| Order | Before | After |
|-------|--------|-------|
| 1 | Pause callout | Pause callout |
| 2 | Upcoming appointments (hero) | Calendar broken alert (when applicable) |
| 3 | Four KPI stats | Failed delivery alert (when applicable) |
| 4 | Customer replies | **Customer replies & conversations** |
| 5 | Product status cards | **Needs attention** |
| 6 | Needs attention table | **Upcoming appointments** |
| 7 | Calendar alert | **Compact KPI strip** |
| 8 | Activity + calendars grid | Product status + activity grid (unchanged content, lower) |

---

## Responses — before vs after

| Before | After |
|--------|-------|
| Table only; preview snippet in row | Row click / **Read conversation** opens thread sheet |
| Overview drawer used list-style bubbles | Shared **SMS bubble thread** (left/right) |
| No deep link | `?appointment=` opens thread on Responses |

---

## Files changed (conversation + overview pass)

- `ar-sms-conversation-thread.tsx` (new)
- `ar-conversation-thread-sheet.tsx` (new)
- `ar-overview-conversations-panel.tsx`
- `overview-page.tsx`
- `ar-responses-opus.tsx`
- This document

---

## Verification gaps

- No live browser screenshots in Cloud VM this pass (`CODE` + unit nav tests only).
- Thread content is limited to messages stored on `conversationMessage` (does not merge separate reminder timeline rows unless also persisted as messages).
- Competitor authenticated dashboards not inspected.
