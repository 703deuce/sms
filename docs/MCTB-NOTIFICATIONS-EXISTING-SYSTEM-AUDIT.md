# MCTB Notifications & Handoff — existing system audit

Date: 2026-09-12. Route: `/mctb/setup/notifications`.

## Route & API

| Item | Location |
|------|----------|
| Page | `src/app/(app)/mctb/setup/notifications/page.tsx` → `MctbSetupNotificationsView` |
| API | `GET/POST /api/mctb/handoff` |
| Test action | `POST { action: "test_notification" }` → `deliverMctbHandoffNotifications` |
| Runtime | `src/lib/mctb/handoff/process-inbound-reply.ts`, `notifications.ts` |

## Config (`MctbHandoffConfigDto`)

- `responseMode` — notify_only | guided_collection | ai_conversation | immediate_handoff
- `fieldSchema` — guided collection requirements
- `emergencyDetectionEnabled`, `emergencyCriteria`, `emergencyAction`, `emergencyUncertainBehavior`
- `bookingBehavior` — appointment booking in MCTB SMS thread
- `routingMatrix` — per-event channel prefs (sms, email, in_app)
- `quietHours` — enabled, start, end, emergencyBypass, nonUrgentSmsDelay

## Recipients (`MctbNotificationRecipientDto`)

- name, email, mobileE164, roleDescription, enabled, sortOrder
- `eventChannels` (per-recipient overrides in DB; workspace routing matrix is primary for delivery today)

## Events (`MctbHandoffEventType`)

missed_call_detected, caller_replied, lead_captured, callback_requested, urgent_detected, human_required, appointment_booked, voicemail_received, recovery_failure.

Default routing matrix keys (UI-editable): caller_replied, lead_captured, callback_requested, urgent_detected, human_required, appointment_booked.

## Prior UI (preserved + extended)

- Four response modes
- Guided collection field requirements
- Emergency block + actions
- Team recipients + add recipient
- Quiet hours + emergency bypass
- Test notification + static preview samples
- **Added in premium pass:** routing matrix table, recipient enabled toggles, bookingBehavior, emergencyUncertainBehavior, nonUrgentSmsDelay

## Not on this page (by design)

- Voicemail box email/SMS (`/api/phone/voicemail`) — operational voicemail alerts
- Recovery message copy — Recovery / Text back setup
- Customer recovery SMS consent — Consent setup
