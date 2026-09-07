# Route & API Classification

**Source:** `docs/.generated/appointments-mctb-route-inventory.json`  
**Generated:** 2026-09-07

## Summary

| Classification | Count |
|----------------|-------|
| canonical-customer | 143 |
| contextual | 2 |
| internal-admin | 2 |
| legacy-redirect | 93 |
| provider-runtime | 6 |
| public | 12 |
| **Total** | **258** |

## Rules

- **canonical-customer** / **public** → must have certification test ID(s)
- **legacy-redirect** → redirect/compatibility certification
- **provider-runtime** → fixture-based runtime tests (not blind HTTP spam)
- **orphan-dead** → report; do not fake coverage

## Orphan / dead routes (0)

_None_

## Legacy routes (93)

- `/voice/agents` → requires redirect to /mctb/*
- `/voice/agents` → requires redirect to /mctb/*
- `/voice/agents/:id` → requires redirect to /mctb/*
- `/voice/agents/:id` → requires redirect to /mctb/*
- `/voice/agents/:id/about` → requires redirect to /mctb/*
- `/voice/agents/:id/advanced` → requires redirect to /mctb/*
- `/voice/agents/:id/capabilities` → requires redirect to /mctb/*
- `/voice/agents/:id/flows` → requires redirect to /mctb/*
- `/voice/agents/:id/flows/generate` → requires redirect to /mctb/*
- `/voice/agents/:id/flows/optimize` → requires redirect to /mctb/*
- `/voice/agents/:id/integrations` → requires redirect to /mctb/*
- `/voice/agents/:id/knowledge` → requires redirect to /mctb/*
- `/voice/agents/:id/latency-profile` → requires redirect to /mctb/*
- `/voice/agents/:id/test` → requires redirect to /mctb/*
- `/voice/agents/:id/test-session` → requires redirect to /mctb/*
- `/voice/agents/:id/tools` → requires redirect to /mctb/*
- `/voice/agents/:id/voice-test` → requires redirect to /mctb/*
- `/voice/agents/new` → requires redirect to /mctb/*
- `/voice/ai` → requires redirect to /mctb/*
- `/voice/ai-platform` → requires redirect to /mctb/*
- `/voice/analytics` → requires redirect to /mctb/*
- `/voice/analytics` → requires redirect to /mctb/*
- `/voice/analytics/export` → requires redirect to /mctb/*
- `/voice/billing` → requires redirect to /mctb/*
- `/voice/billing` → requires redirect to /mctb/*
- `/voice/calendars` → requires redirect to /mctb/*
- `/voice/calendars` → requires redirect to /mctb/*
- `/voice/calendars/availability` → requires redirect to /mctb/*
- `/voice/calendars/oauth/google` → requires redirect to /mctb/*
- `/voice/calendars/oauth/google/callback` → requires redirect to /mctb/*

_…and 63 more_

## Full classification

| Path | Kind | Product | Classification | File |
|------|------|---------|----------------|------|
| /admin/mctb/:workspaceId | api | mctb | internal-admin | src/app/api/admin/mctb/[workspaceId]/route.ts |
| /analytics/mctb | page | mctb | canonical-customer | src/app/(app)/analytics/mctb/page.tsx |
| /appointments | page | appointments | canonical-customer | src/app/(app)/appointments/page.tsx |
| /appointments | api | appointments | canonical-customer | src/app/api/appointments/route.ts |
| /appointments/:id | page | appointments | canonical-customer | src/app/(app)/appointments/[id]/page.tsx |
| /appointments/:id | api | appointments | canonical-customer | src/app/api/appointments/[id]/route.ts |
| /appointments/:id/meetings | api | appointments | canonical-customer | src/app/api/appointments/[id]/meetings/route.ts |
| /appointments/:id/reminder-timeline | api | appointments | canonical-customer | src/app/api/appointments/[id]/reminder-timeline/route.ts |
| /appointments/:id/video | api | appointments | canonical-customer | src/app/api/appointments/[id]/video/route.ts |
| /appointments/:id/video/host | page | appointments | canonical-customer | src/app/(app)/appointments/[id]/video/host/page.tsx |
| /appointments/:id/video/join | api | appointments | canonical-customer | src/app/api/appointments/[id]/video/join/route.ts |
| /appointments/ai-booking | page | appointments | canonical-customer | src/app/(app)/appointments/ai-booking/page.tsx |
| /appointments/ai-booking | api | appointments | canonical-customer | src/app/api/appointments/ai-booking/route.ts |
| /appointments/ai-booking/channels | api | appointments | canonical-customer | src/app/api/appointments/ai-booking/channels/route.ts |
| /appointments/analytics | page | appointments | canonical-customer | src/app/(app)/appointments/analytics/page.tsx |
| /appointments/analytics | api | appointments | canonical-customer | src/app/api/appointments/analytics/route.ts |
| /appointments/analytics/automations | page | appointments | canonical-customer | src/app/(app)/appointments/analytics/automations/page.tsx |
| /appointments/analytics/booking | page | appointments | canonical-customer | src/app/(app)/appointments/analytics/booking/page.tsx |
| /appointments/analytics/export | api | appointments | canonical-customer | src/app/api/appointments/analytics/export/route.ts |
| /appointments/analytics/reminders | page | appointments | canonical-customer | src/app/(app)/appointments/analytics/reminders/page.tsx |
| /appointments/analytics/reports | page | appointments | canonical-customer | src/app/(app)/appointments/analytics/reports/page.tsx |
| /appointments/automations/activity | page | appointments | canonical-customer | src/app/(app)/appointments/automations/activity/page.tsx |
| /appointments/automations/templates | page | appointments | canonical-customer | src/app/(app)/appointments/automations/templates/page.tsx |
| /appointments/availability | page | appointments | canonical-customer | src/app/(app)/appointments/availability/page.tsx |
| /appointments/availability | api | appointments | canonical-customer | src/app/api/appointments/availability/route.ts |
| /appointments/booking | page | appointments | canonical-customer | src/app/(app)/appointments/booking/page.tsx |
| /appointments/booking-links | api | appointments | canonical-customer | src/app/api/appointments/booking-links/route.ts |
| /appointments/booking/approval | api | appointments | canonical-customer | src/app/api/appointments/booking/approval/route.ts |
| /appointments/calendar | page | appointments | canonical-customer | src/app/(app)/appointments/calendar/page.tsx |
| /appointments/cancel/:token | page | appointments | canonical-customer | src/app/(public)/appointments/cancel/[token]/page.tsx |
| /appointments/confirm/:token | page | appointments | canonical-customer | src/app/(public)/appointments/confirm/[token]/page.tsx |
| /appointments/diagnostics/slots | api | appointments | internal-admin | src/app/api/appointments/diagnostics/slots/route.ts |
| /appointments/enterprise | page | appointments | canonical-customer | src/app/(app)/appointments/enterprise/page.tsx |
| /appointments/integrations | page | appointments | canonical-customer | src/app/(app)/appointments/integrations/page.tsx |
| /appointments/integrations/status | api | appointments | canonical-customer | src/app/api/appointments/integrations/status/route.ts |
| /appointments/locations | page | appointments | canonical-customer | src/app/(app)/appointments/locations/page.tsx |
| /appointments/meeting-indicators | api | appointments | canonical-customer | src/app/api/appointments/meeting-indicators/route.ts |
| /appointments/meeting-polls | api | appointments | canonical-customer | src/app/api/appointments/meeting-polls/route.ts |
| /appointments/new | page | appointments | canonical-customer | src/app/(app)/appointments/new/page.tsx |
| /appointments/no-show-recovery | page | appointments | canonical-customer | src/app/(app)/appointments/no-show-recovery/page.tsx |
| /appointments/no-show-recovery | api | appointments | canonical-customer | src/app/api/appointments/no-show-recovery/route.ts |
| /appointments/org | api | appointments | canonical-customer | src/app/api/appointments/org/route.ts |
| /appointments/overview | page | appointments | canonical-customer | src/app/(app)/appointments/overview/page.tsx |
| /appointments/overview | api | appointments | canonical-customer | src/app/api/appointments/overview/route.ts |
| /appointments/polls | page | appointments | canonical-customer | src/app/(app)/appointments/polls/page.tsx |
| /appointments/recall-campaigns | page | appointments | canonical-customer | src/app/(app)/appointments/recall-campaigns/page.tsx |
| /appointments/recall-campaigns | api | appointments | canonical-customer | src/app/api/appointments/recall-campaigns/route.ts |
| /appointments/recalls | page | appointments | canonical-customer | src/app/(app)/appointments/recalls/page.tsx |
| /appointments/recalls/hub | api | appointments | canonical-customer | src/app/api/appointments/recalls/hub/route.ts |
| /appointments/reminders | page | appointments | canonical-customer | src/app/(app)/appointments/reminders/page.tsx |
| /appointments/reminders/test | api | appointments | canonical-customer | src/app/api/appointments/reminders/test/route.ts |
| /appointments/reminders/track/click | api | appointments | canonical-customer | src/app/api/appointments/reminders/track/click/route.ts |
| /appointments/reminders/track/open | api | appointments | canonical-customer | src/app/api/appointments/reminders/track/open/route.ts |
| /appointments/reschedule/:token | page | appointments | canonical-customer | src/app/(public)/appointments/reschedule/[token]/page.tsx |
| /appointments/routing | page | appointments | canonical-customer | src/app/(app)/appointments/routing/page.tsx |
| /appointments/routing-forms | page | appointments | canonical-customer | src/app/(app)/appointments/routing-forms/page.tsx |
| /appointments/routing-forms | api | appointments | canonical-customer | src/app/api/appointments/routing-forms/route.ts |
| /appointments/settings | api | appointments | canonical-customer | src/app/api/appointments/settings/route.ts |
| /appointments/setup | page | appointments | canonical-customer | src/app/(app)/appointments/setup/page.tsx |
| /appointments/staff | page | appointments | canonical-customer | src/app/(app)/appointments/staff/page.tsx |
| /appointments/team-pages | page | appointments | canonical-customer | src/app/(app)/appointments/team-pages/page.tsx |
| /appointments/team-pages | api | appointments | canonical-customer | src/app/api/appointments/team-pages/route.ts |
| /appointments/types | page | appointments | canonical-customer | src/app/(app)/appointments/types/page.tsx |
| /appointments/types | api | appointments | canonical-customer | src/app/api/appointments/types/route.ts |
| /appointments/types/:id | api | appointments | canonical-customer | src/app/api/appointments/types/[id]/route.ts |
| /appointments/types/bulk | api | appointments | canonical-customer | src/app/api/appointments/types/bulk/route.ts |
| /appointments/voice-reminders | page | appointments | canonical-customer | src/app/(app)/appointments/voice-reminders/page.tsx |
| /appointments/voice-reminders | api | appointments | canonical-customer | src/app/api/appointments/voice-reminders/route.ts |
| /appointments/voice-reminders/caller-id | api | appointments | canonical-customer | src/app/api/appointments/voice-reminders/caller-id/route.ts |
| /appointments/waitlist | page | appointments | canonical-customer | src/app/(app)/appointments/waitlist/page.tsx |
| /appointments/waitlist | api | appointments | canonical-customer | src/app/api/appointments/waitlist/route.ts |
| /appointments/workflows | page | appointments | canonical-customer | src/app/(app)/appointments/workflows/page.tsx |
| /appointments/workflows | api | appointments | canonical-customer | src/app/api/appointments/workflows/route.ts |
| /appointments/workflows/:id | api | appointments | canonical-customer | src/app/api/appointments/workflows/[id]/route.ts |
| /appointments/workflows/:id/edit | page | appointments | canonical-customer | src/app/(app)/appointments/workflows/[id]/edit/page.tsx |
| /appointments/workflows/:id/test | api | appointments | canonical-customer | src/app/api/appointments/workflows/[id]/test/route.ts |
| /appointments/workflows/logs | api | appointments | canonical-customer | src/app/api/appointments/workflows/logs/route.ts |
| /appointments/workflows/new | page | appointments | canonical-customer | src/app/(app)/appointments/workflows/new/page.tsx |
| /appointments/workflows/preview | api | appointments | canonical-customer | src/app/api/appointments/workflows/preview/route.ts |
| /appointments/workflows/setup/:templateId | page | appointments | canonical-customer | src/app/(app)/appointments/workflows/setup/[templateId]/page.tsx |
| /appointments/workflows/unknown-replies | api | appointments | canonical-customer | src/app/api/appointments/workflows/unknown-replies/route.ts |
| /book/:slug | page | appointments | public | src/app/(public)/book/[slug]/page.tsx |
| /book/:slug/:serviceId | page | appointments | public | src/app/(public)/book/[slug]/[serviceId]/page.tsx |
| /book/:slug/reminders | page | appointments | public | src/app/(public)/book/[slug]/reminders/page.tsx |
| /book/payment/canceled | page | appointments | public | src/app/(public)/book/payment/canceled/page.tsx |
| /book/payment/success | page | appointments | public | src/app/(public)/book/payment/success/page.tsx |
| /f/mctb/:token | page | mctb | public | src/app/f/mctb/[token]/page.tsx |
| /mctb | page | mctb | canonical-customer | src/app/(app)/mctb/page.tsx |
| /mctb/admin-test/bootstrap | api | mctb | canonical-customer | src/app/api/mctb/admin-test/bootstrap/route.ts |
| /mctb/analytics | page | mctb | canonical-customer | src/app/(app)/mctb/analytics/page.tsx |
| /mctb/analytics | api | mctb | canonical-customer | src/app/api/mctb/analytics/route.ts |
| /mctb/compliance/consent | page | mctb | contextual | src/app/(app)/mctb/compliance/consent/page.tsx |
| /mctb/consent-log | api | mctb | canonical-customer | src/app/api/mctb/consent-log/route.ts |
| /mctb/consent-prompt | api | mctb | canonical-customer | src/app/api/mctb/consent-prompt/route.ts |
| /mctb/conversations | page | mctb | canonical-customer | src/app/(app)/mctb/conversations/page.tsx |
| /mctb/debug/log | api | mctb | canonical-customer | src/app/api/mctb/debug/log/route.ts |
| /mctb/exclusions | api | mctb | canonical-customer | src/app/api/mctb/exclusions/route.ts |
| /mctb/handoff | api | mctb | canonical-customer | src/app/api/mctb/handoff/route.ts |
| /mctb/handoff/actions | api | mctb | canonical-customer | src/app/api/mctb/handoff/actions/route.ts |
| /mctb/handoff/context | api | mctb | canonical-customer | src/app/api/mctb/handoff/context/route.ts |
| /mctb/live-test | api | mctb | canonical-customer | src/app/api/mctb/live-test/route.ts |
| /mctb/missed-calls | page | mctb | canonical-customer | src/app/(app)/mctb/missed-calls/page.tsx |
| /mctb/missed-calls | api | mctb | canonical-customer | src/app/api/mctb/missed-calls/route.ts |
| /mctb/missed-calls/:id | page | mctb | canonical-customer | src/app/(app)/mctb/missed-calls/[id]/page.tsx |
| /mctb/missed-calls/:id | api | mctb | canonical-customer | src/app/api/mctb/missed-calls/[id]/route.ts |
| /mctb/numbers | page | mctb | canonical-customer | src/app/(app)/mctb/numbers/page.tsx |
| /mctb/onboarding | api | mctb | canonical-customer | src/app/api/mctb/onboarding/route.ts |
| /mctb/overview | api | mctb | canonical-customer | src/app/api/mctb/overview/route.ts |
| /mctb/setup | page | mctb | canonical-customer | src/app/(app)/mctb/setup/page.tsx |
| /mctb/setup | api | mctb | canonical-customer | src/app/api/mctb/setup/route.ts |
| /mctb/setup-test | api | mctb | canonical-customer | src/app/api/mctb/setup-test/route.ts |
| /mctb/setup/consent | page | mctb | canonical-customer | src/app/(app)/mctb/setup/consent/page.tsx |
| /mctb/setup/exclusions | page | mctb | canonical-customer | src/app/(app)/mctb/setup/exclusions/page.tsx |
| /mctb/setup/missed-call-rules | page | mctb | canonical-customer | src/app/(app)/mctb/setup/missed-call-rules/page.tsx |
| /mctb/setup/notifications | page | mctb | canonical-customer | src/app/(app)/mctb/setup/notifications/page.tsx |
| /mctb/setup/phone | page | mctb | canonical-customer | src/app/(app)/mctb/setup/phone/page.tsx |
| /mctb/setup/recovery | page | mctb | canonical-customer | src/app/(app)/mctb/setup/recovery/page.tsx |
| /mctb/setup/start | page | mctb | canonical-customer | src/app/(app)/mctb/setup/start/page.tsx |
| /mctb/setup/test | page | mctb | canonical-customer | src/app/(app)/mctb/setup/test/page.tsx |
| /mctb/setup/text-back | page | mctb | canonical-customer | src/app/(app)/mctb/setup/text-back/page.tsx |
| /mctb/setup/voicemail | page | mctb | canonical-customer | src/app/(app)/mctb/setup/voicemail/page.tsx |
| /mctb/tfv | api | mctb | canonical-customer | src/app/api/mctb/tfv/route.ts |
| /mctb/try-it | api | mctb | canonical-customer | src/app/api/mctb/try-it/route.ts |
| /mctb/voicemail | page | mctb | canonical-customer | src/app/(app)/mctb/voicemail/page.tsx |
| /meetings | page | appointments | canonical-customer | src/app/(app)/meetings/page.tsx |
| /meetings | api | appointments | canonical-customer | src/app/api/meetings/route.ts |
| /meetings/:id | page | appointments | canonical-customer | src/app/(app)/meetings/[id]/page.tsx |
| /meetings/:id | api | appointments | canonical-customer | src/app/api/meetings/[id]/route.ts |
| /meetings/:id/recording | api | appointments | canonical-customer | src/app/api/meetings/[id]/recording/route.ts |
| /meetings/:id/transcript | api | appointments | canonical-customer | src/app/api/meetings/[id]/transcript/route.ts |
| /meetings/enable | api | appointments | canonical-customer | src/app/api/meetings/enable/route.ts |
| /meetings/overview | api | appointments | canonical-customer | src/app/api/meetings/overview/route.ts |
| /meetings/settings | api | appointments | canonical-customer | src/app/api/meetings/settings/route.ts |
| /meetings/standalone | api | appointments | canonical-customer | src/app/api/meetings/standalone/route.ts |
| /onboarding/mctb | page | mctb | contextual | src/app/(app)/onboarding/mctb/page.tsx |
| /public/mctb-request-form | api | mctb | canonical-customer | src/app/api/public/mctb-request-form/route.ts |
| /recap/:token | page | appointments | public | src/app/(public)/recap/[token]/page.tsx |
| /recap/:token | api | appointments | public | src/app/api/recap/[token]/route.ts |
| /recap/:token/unlock | api | appointments | public | src/app/api/recap/[token]/unlock/route.ts |
| /routing/:slug/:formSlug | page | appointments | public | src/app/(public)/routing/[slug]/[formSlug]/page.tsx |
| /team | api | appointments | canonical-customer | src/app/api/team/route.ts |
| /team/:slug/:pageSlug | page | appointments | public | src/app/(public)/team/[slug]/[pageSlug]/page.tsx |
| /telnyx/voice/mctb-call-control | api | mctb | provider-runtime | src/app/api/telnyx/voice/mctb-call-control/route.ts |
| /telnyx/voice/mctb-consent | api | mctb | provider-runtime | src/app/api/telnyx/voice/mctb-consent/route.ts |
| /telnyx/voice/mctb-entry | api | mctb | provider-runtime | src/app/api/telnyx/voice/mctb-entry/route.ts |
| /telnyx/voice/mctb-press-1 | api | mctb | provider-runtime | src/app/api/telnyx/voice/mctb-press-1/route.ts |
| /telnyx/voice/mctb-texml-voicemail | api | mctb | provider-runtime | src/app/api/telnyx/voice/mctb-texml-voicemail/route.ts |
| /telnyx/voice/mctb-voicemail | api | mctb | provider-runtime | src/app/api/telnyx/voice/mctb-voicemail/route.ts |
| /video | page | appointments | canonical-customer | src/app/(app)/video/page.tsx |
| /video/:token | page | appointments | canonical-customer | src/app/(public)/video/[token]/page.tsx |
| /video/meetings | api | appointments | canonical-customer | src/app/api/video/meetings/route.ts |
| /video/meetings/:id | api | appointments | canonical-customer | src/app/api/video/meetings/[id]/route.ts |
| /video/meetings/:id/invite | api | appointments | canonical-customer | src/app/api/video/meetings/[id]/invite/route.ts |
| /video/meetings/:id/join | api | appointments | canonical-customer | src/app/api/video/meetings/[id]/join/route.ts |
| /video/overview | api | appointments | canonical-customer | src/app/api/video/overview/route.ts |
| /video/public/:token | api | appointments | canonical-customer | src/app/api/video/public/[token]/route.ts |
| /video/public/:token/chat | api | appointments | canonical-customer | src/app/api/video/public/[token]/chat/route.ts |
| /video/public/:token/connected | api | appointments | canonical-customer | src/app/api/video/public/[token]/connected/route.ts |
| /video/public/:token/join | api | appointments | canonical-customer | src/app/api/video/public/[token]/join/route.ts |
| /video/public/:token/left | api | appointments | canonical-customer | src/app/api/video/public/[token]/left/route.ts |
| /video/public/:token/moderate | api | appointments | canonical-customer | src/app/api/video/public/[token]/moderate/route.ts |
| /video/public/:token/participants | api | appointments | canonical-customer | src/app/api/video/public/[token]/participants/route.ts |
| /video/rooms/:id/host | page | appointments | canonical-customer | src/app/(app)/video/rooms/[id]/host/page.tsx |
| /video/settings | api | appointments | canonical-customer | src/app/api/video/settings/route.ts |
| /voice/agents | page | mctb | legacy-redirect | src/app/(app)/voice/agents/page.tsx |
| /voice/agents | api | mctb | legacy-redirect | src/app/api/voice/agents/route.ts |
| /voice/agents/:id | page | mctb | legacy-redirect | src/app/(app)/voice/agents/[id]/page.tsx |
| /voice/agents/:id | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/route.ts |
| /voice/agents/:id/about | page | mctb | legacy-redirect | src/app/(app)/voice/agents/[id]/about/page.tsx |
| /voice/agents/:id/advanced | page | mctb | legacy-redirect | src/app/(app)/voice/agents/[id]/advanced/page.tsx |
| /voice/agents/:id/capabilities | page | mctb | legacy-redirect | src/app/(app)/voice/agents/[id]/capabilities/page.tsx |
| /voice/agents/:id/flows | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/flows/route.ts |
| /voice/agents/:id/flows/generate | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/flows/generate/route.ts |
| /voice/agents/:id/flows/optimize | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/flows/optimize/route.ts |
| /voice/agents/:id/integrations | page | mctb | legacy-redirect | src/app/(app)/voice/agents/[id]/integrations/page.tsx |
| /voice/agents/:id/knowledge | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/knowledge/route.ts |
| /voice/agents/:id/latency-profile | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/latency-profile/route.ts |
| /voice/agents/:id/test | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/test/route.ts |
| /voice/agents/:id/test-session | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/test-session/route.ts |
| /voice/agents/:id/tools | api | mctb | legacy-redirect | src/app/api/voice/agents/[id]/tools/route.ts |
| /voice/agents/:id/voice-test | page | mctb | legacy-redirect | src/app/(app)/voice/agents/[id]/voice-test/page.tsx |
| /voice/agents/new | page | mctb | legacy-redirect | src/app/(app)/voice/agents/new/page.tsx |
| /voice/ai | api | mctb | legacy-redirect | src/app/api/voice/ai/route.ts |
| /voice/ai-platform | page | mctb | legacy-redirect | src/app/(app)/voice/ai-platform/page.tsx |
| /voice/analytics | page | mctb | legacy-redirect | src/app/(app)/voice/analytics/page.tsx |
| /voice/analytics | api | mctb | legacy-redirect | src/app/api/voice/analytics/route.ts |
| /voice/analytics/export | api | mctb | legacy-redirect | src/app/api/voice/analytics/export/route.ts |
| /voice/billing | page | mctb | legacy-redirect | src/app/(app)/voice/billing/page.tsx |
| /voice/billing | api | mctb | legacy-redirect | src/app/api/voice/billing/route.ts |
| /voice/calendars | page | mctb | legacy-redirect | src/app/(app)/voice/calendars/page.tsx |
| /voice/calendars | api | mctb | legacy-redirect | src/app/api/voice/calendars/route.ts |
| /voice/calendars/availability | api | mctb | legacy-redirect | src/app/api/voice/calendars/availability/route.ts |
| /voice/calendars/oauth/google | api | mctb | legacy-redirect | src/app/api/voice/calendars/oauth/google/route.ts |
| /voice/calendars/oauth/google/callback | api | mctb | legacy-redirect | src/app/api/voice/calendars/oauth/google/callback/route.ts |
| /voice/calendars/oauth/microsoft | api | mctb | legacy-redirect | src/app/api/voice/calendars/oauth/microsoft/route.ts |
| /voice/calendars/oauth/microsoft/callback | api | mctb | legacy-redirect | src/app/api/voice/calendars/oauth/microsoft/callback/route.ts |
| /voice/callback-requests | page | mctb | legacy-redirect | src/app/(app)/voice/callback-requests/page.tsx |
| /voice/caller-history | api | mctb | legacy-redirect | src/app/api/voice/caller-history/route.ts |
| /voice/calls | page | mctb | legacy-redirect | src/app/(app)/voice/calls/page.tsx |
| /voice/calls | api | mctb | legacy-redirect | src/app/api/voice/calls/route.ts |
| /voice/calls/:id | page | mctb | legacy-redirect | src/app/(app)/voice/calls/[id]/page.tsx |
| /voice/calls/:id | api | mctb | legacy-redirect | src/app/api/voice/calls/[id]/route.ts |
| /voice/campaigns | page | mctb | legacy-redirect | src/app/(app)/voice/campaigns/page.tsx |
| /voice/campaigns | api | mctb | legacy-redirect | src/app/api/voice/campaigns/route.ts |
| /voice/campaigns/:id | api | mctb | legacy-redirect | src/app/api/voice/campaigns/[id]/route.ts |
| /voice/consent-log | page | mctb | legacy-redirect | src/app/(app)/voice/consent-log/page.tsx |
| /voice/conversations | page | mctb | legacy-redirect | src/app/(app)/voice/conversations/page.tsx |
| /voice/conversations | api | mctb | legacy-redirect | src/app/api/voice/conversations/route.ts |
| /voice/conversations/:id | api | mctb | legacy-redirect | src/app/api/voice/conversations/[id]/route.ts |
| /voice/flows/generate | api | mctb | legacy-redirect | src/app/api/voice/flows/generate/route.ts |
| /voice/inbound-routing | page | mctb | legacy-redirect | src/app/(app)/voice/inbound-routing/page.tsx |
| /voice/knowledge | page | mctb | legacy-redirect | src/app/(app)/voice/knowledge/page.tsx |
| /voice/knowledge | api | mctb | legacy-redirect | src/app/api/voice/knowledge/route.ts |
| /voice/knowledge/:id | api | mctb | legacy-redirect | src/app/api/voice/knowledge/[id]/route.ts |
| /voice/knowledge/:id/search | api | mctb | legacy-redirect | src/app/api/voice/knowledge/[id]/search/route.ts |
| /voice/knowledge/:id/sources | api | mctb | legacy-redirect | src/app/api/voice/knowledge/[id]/sources/route.ts |
| /voice/knowledge/:id/sources/:sourceId | api | mctb | legacy-redirect | src/app/api/voice/knowledge/[id]/sources/[sourceId]/route.ts |
| /voice/knowledge/:id/upload | api | mctb | legacy-redirect | src/app/api/voice/knowledge/[id]/upload/route.ts |
| /voice/livekit/readiness | api | mctb | legacy-redirect | src/app/api/voice/livekit/readiness/route.ts |
| /voice/missed-calls | page | mctb | legacy-redirect | src/app/(app)/voice/missed-calls/page.tsx |
| /voice/missed-calls/:id | page | mctb | legacy-redirect | src/app/(app)/voice/missed-calls/[id]/page.tsx |
| /voice/needs-attention | page | mctb | legacy-redirect | src/app/(app)/voice/needs-attention/page.tsx |
| /voice/needs-attention | api | mctb | legacy-redirect | src/app/api/voice/needs-attention/route.ts |
| /voice/numbers | page | mctb | legacy-redirect | src/app/(app)/voice/numbers/page.tsx |
| /voice/numbers/buy | page | mctb | legacy-redirect | src/app/(app)/voice/numbers/buy/page.tsx |
| /voice/outbound/qualification/test | api | mctb | legacy-redirect | src/app/api/voice/outbound/qualification/test/route.ts |
| /voice/overview | page | mctb | legacy-redirect | src/app/(app)/voice/overview/page.tsx |
| /voice/overview | api | mctb | legacy-redirect | src/app/api/voice/overview/route.ts |
| /voice/receptionist | page | mctb | legacy-redirect | src/app/(app)/voice/receptionist/page.tsx |
| /voice/recordings/:id/stream | api | mctb | legacy-redirect | src/app/api/voice/recordings/[id]/stream/route.ts |
| /voice/recordings/:id/url | api | mctb | legacy-redirect | src/app/api/voice/recordings/[id]/url/route.ts |
| /voice/reports | page | mctb | legacy-redirect | src/app/(app)/voice/reports/page.tsx |
| /voice/routing | api | mctb | legacy-redirect | src/app/api/voice/routing/route.ts |
| /voice/routing/:id | api | mctb | legacy-redirect | src/app/api/voice/routing/[id]/route.ts |
| /voice/routing/simulate | api | mctb | legacy-redirect | src/app/api/voice/routing/simulate/route.ts |
| /voice/schedule | page | mctb | legacy-redirect | src/app/(app)/voice/schedule/page.tsx |
| /voice/services | api | mctb | legacy-redirect | src/app/api/voice/services/route.ts |
| /voice/services/:id | api | mctb | legacy-redirect | src/app/api/voice/services/[id]/route.ts |
| /voice/settings | page | mctb | legacy-redirect | src/app/(app)/voice/settings/page.tsx |
| /voice/settings | api | mctb | legacy-redirect | src/app/api/voice/settings/route.ts |
| /voice/setup | page | mctb | legacy-redirect | src/app/(app)/voice/setup/page.tsx |
| /voice/staff | api | mctb | legacy-redirect | src/app/api/voice/staff/route.ts |
| /voice/staff/:id | api | mctb | legacy-redirect | src/app/api/voice/staff/[id]/route.ts |
| /voice/telnyx-official-baseline | api | mctb | legacy-redirect | src/app/api/voice/telnyx-official-baseline/route.ts |
| /voice/templates | api | mctb | legacy-redirect | src/app/api/voice/templates/route.ts |
| /voice/templates/test-session | api | mctb | legacy-redirect | src/app/api/voice/templates/test-session/route.ts |
| /voice/testing | page | mctb | legacy-redirect | src/app/(app)/voice/testing/page.tsx |
| /voice/tools | page | mctb | legacy-redirect | src/app/(app)/voice/tools/page.tsx |
| /voice/tools | api | mctb | legacy-redirect | src/app/api/voice/tools/route.ts |
| /voice/tools/:id/test | api | mctb | legacy-redirect | src/app/api/voice/tools/[id]/test/route.ts |
| /voice/tools/search-details | api | mctb | legacy-redirect | src/app/api/voice/tools/search-details/route.ts |
| /voice/tools/send-resource | api | mctb | legacy-redirect | src/app/api/voice/tools/send-resource/route.ts |
| /voice/transcription | page | mctb | legacy-redirect | src/app/(app)/voice/transcription/page.tsx |
| /voice/try-it | page | mctb | legacy-redirect | src/app/(app)/voice/try-it/page.tsx |
| /voice/tts-preview | api | mctb | legacy-redirect | src/app/api/voice/tts-preview/route.ts |
| /voice/voicemail | page | mctb | legacy-redirect | src/app/(app)/voice/voicemail/page.tsx |
| /voice/voices | api | mctb | legacy-redirect | src/app/api/voice/voices/route.ts |
| /waitlist/accept/:token | page | appointments | public | src/app/(public)/waitlist/accept/[token]/page.tsx |
