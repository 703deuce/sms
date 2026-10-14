# Transovo Business Messaging — route preservation matrix

Unified nav flag: `BUSINESS_MESSAGING_UNIFIED_NAV` (default `true` in `platform-launch.ts`; set env `BUSINESS_MESSAGING_UNIFIED_NAV=0` to disable).

## Global sidebar (8 links — always visible)

The same eight links render on every authenticated page. Entitlements do not remove items; inactive services show an **Activate** badge and still link to the service workspace (upgrade/activation UI on the destination).

| Label | Route |
|-------|--------|
| Overview | `/overview` |
| Inbox | `/conversations` (+ tabs: missed calls, voicemail, held replies) |
| Contacts | `/contacts` |
| Missed Call Text Back | `/mctb` |
| Appointment Reminders | `/appointment-reminders` |
| Campaigns | `/campaigns` |
| Integrations | `/integrations` |
| Settings | `/settings` |

## MCTB service tabs

| Tab | Route |
|-----|--------|
| Activity | `/mctb` |
| Recovery Rules | `/mctb/missed-call-recovery` |
| Text Back | `/mctb/text-back` |
| AI Recovery | `/mctb/ai-recovery` |
| Phone Setup | `/mctb/phone` |
| Analytics | `/mctb/analytics` |

Setup, onboarding, compliance, notifications, and legacy `/mctb/setup/*`, `/voice/*` redirects remain unchanged.

## Appointment Reminders service tabs

| Tab | Route |
|-----|--------|
| Calendar | `/appointment-reminders` |
| Appointments | `/appointment-reminders/appointments` |
| Reminders | `/appointment-reminders/reminders` |
| Sequences | `/appointment-reminders/reminders/sequences` |
| AI Rescheduler | `/appointment-reminders/ai-rescheduler` |
| Analytics | `/appointment-reminders/analytics` |

Booking submodule routes preserved but hidden from nav when unified (`appointmentRemindersHideBookingNav`).

## Campaigns service tabs

| Tab | Route |
|-----|--------|
| All Campaigns | `/campaigns` |
| Drafts | `/campaigns/drafts` |
| Scheduled | `/campaigns/scheduled` |
| Completed | `/campaigns/completed` |
| Templates | `/templates` |
| Analytics | `/sms/analytics` |

## Inbox tabs

| Tab | Route |
|-----|--------|
| Conversations | `/conversations` |
| Missed Calls | `/mctb/missed-calls` |
| Voicemail | `/mctb/voicemail` |
| Held Replies | `/appointment-reminders/responses?view=held` |

## Contacts workspace tabs

| Tab | Route |
|-----|--------|
| All Contacts | `/contacts` |
| Lists | `/contacts/lists` |
| Imports | `/contacts/imports` |
| Consent | `/mctb/compliance/consent` |
