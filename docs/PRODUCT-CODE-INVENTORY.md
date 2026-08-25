# Product Code Inventory

Generated: 2026-08-25
Source tag: `pre-mctb-extraction-2026-08-25`
Archive repository: https://github.com/703deuce/smsarchive.git

## Classification Legend

- **MCTB_REQUIRED** — Required for Missed Call Text Back production
- **SHARED_REQUIRED** — Shared infrastructure used by MCTB
- **DORMANT_PRODUCT** — Archived to separate repository
- **UNUSED** — No active references
- **UNCERTAIN** — Requires manual trace (resolved before deletion)

## Active Product: Missed Call Text Back

| Area | Classification | Notes |
|------|----------------|-------|
| `src/lib/mctb/` | MCTB_REQUIRED | Core runtime |
| `src/lib/agents/missed-call-text-back/` | MCTB_REQUIRED | Agent + send pipeline |
| `/dashboard`, `/inbox`, `/voice/missed-calls` | MCTB_REQUIRED | Customer UI |
| `/voice/setup`, `/voice/consent-log`, `/voice/schedule` | MCTB_REQUIRED | Setup + compliance |
| `/voice/analytics`, `/voice/numbers` | MCTB_REQUIRED | Analytics + numbers |
| `/compliance` | SHARED_REQUIRED | A2P / messaging compliance |
| `/integrations` (hub) | SHARED_REQUIRED | Webhooks + API keys |
| `/settings`, billing | SHARED_REQUIRED | Account management |
| Auth, Stripe, Telnyx MCTB webhooks | SHARED_REQUIRED | Platform |

## Dormant Products

### smart-routing

- **Status:** DORMANT_PRODUCT
- **Description:** IVR / call routing / business callback product
- **Files:** 158
- **Routes:** /smart-routing/**, /api/smart-routing/**

<details><summary>Archived paths</summary>

- `docs/smart-routing-ai-assistant-report.md`
- `docs/smart-routing-dual-numbers-report.md`
- `docs/smart-routing-forwarding-metadata-audit.md`
- `docs/smart-routing-standalone-v1-report.md`
- `docs/smart-routing-ui-coverage-matrix.md`
- `public/smart-routing-audio/cmst4zsjk70382w2d09634571.mp3`
- `public/smart-routing-audio/cmt3o8tyd1o5r0o4k3e4n5v2l.mp3`
- `public/smart-routing-audio/cmt8pz72y1o096i6y3c24383j.mp3`
- `public/smart-routing-audio/system/hold-ambient.mp3`
- `public/smart-routing-audio/system/hold-calm-acoustic.mp3`
- `public/smart-routing-audio/system/hold-classic.mp3`
- `public/smart-routing-audio/system/hold-light-jazz.mp3`
- `public/smart-routing-audio/system/hold-minimal.mp3`
- `public/smart-routing-audio/system/hold-modern-corporate.mp3`
- `public/smart-routing-audio/system/hold-soft-electronic.mp3`
- `public/smart-routing-audio/system/hold-soft-piano.mp3`
- `public/smart-routing-audio/system/hold-upbeat-business.mp3`
- `public/smart-routing-audio/system/hold-warm-lounge.mp3`
- `public/smart-routing-audio/system/manifest.json`
- `src/app/(app)/smart-routing/[flowId]/activity/page.tsx`
- `src/app/(app)/smart-routing/[flowId]/page.tsx`
- `src/app/(app)/smart-routing/[flowId]/test/page.tsx`
- `src/app/(app)/smart-routing/activity/page.tsx`
- `src/app/(app)/smart-routing/ai/page.tsx`
- `src/app/(app)/smart-routing/analytics/page.tsx`
- `src/app/(app)/smart-routing/audio/page.tsx`
- `src/app/(app)/smart-routing/callback/page.tsx`
- `src/app/(app)/smart-routing/destinations/page.tsx`
- `src/app/(app)/smart-routing/flows/page.tsx`
- `src/app/(app)/smart-routing/hours/page.tsx`
- `src/app/(app)/smart-routing/layout.tsx`
- `src/app/(app)/smart-routing/new/page.tsx`
- `src/app/(app)/smart-routing/page.tsx`
- `src/app/(app)/smart-routing/setup/page.tsx`
- `src/app/api/public/smart-routing-audio/[assetId]/route.ts`
- `src/app/api/smart-routing/ai/proposals/[id]/apply/route.ts`
- `src/app/api/smart-routing/ai/proposals/[id]/reject/route.ts`
- `src/app/api/smart-routing/ai/proposals/[id]/route.ts`
- `src/app/api/smart-routing/ai/proposals/[id]/undo/route.ts`
- `src/app/api/smart-routing/ai/proposals/route.ts`
- `src/app/api/smart-routing/ai/propose/route.ts`
- `src/app/api/smart-routing/ai/recommendations/dismiss/route.ts`
- `src/app/api/smart-routing/analytics/route.ts`
- `src/app/api/smart-routing/audio/generate/route.ts`
- `src/app/api/smart-routing/audio/route.ts`
- `src/app/api/smart-routing/audio/upload/route.ts`
- `src/app/api/smart-routing/authorized-callers/route.ts`
- `src/app/api/smart-routing/availability/route.ts`
- `src/app/api/smart-routing/blocked-callers/route.ts`
- `src/app/api/smart-routing/business-callback/route.ts`
- `src/app/api/smart-routing/caller-id-verification/route.ts`
- `src/app/api/smart-routing/destinations/route.ts`
- `src/app/api/smart-routing/employee-links/route.ts`
- `src/app/api/smart-routing/flows/[id]/activity/route.ts`
- `src/app/api/smart-routing/flows/[id]/duplicate/route.ts`
- `src/app/api/smart-routing/flows/[id]/forwarding/route.ts`
- `src/app/api/smart-routing/flows/[id]/pause/route.ts`
- `src/app/api/smart-routing/flows/[id]/publish/route.ts`
- `src/app/api/smart-routing/flows/[id]/route.ts`
- `src/app/api/smart-routing/flows/[id]/simulate/route.ts`
- `src/app/api/smart-routing/flows/[id]/test-call/route.ts`
- `src/app/api/smart-routing/flows/[id]/validate/route.ts`
- `src/app/api/smart-routing/flows/route.ts`
- `src/app/api/smart-routing/hold-music/route.ts`
- `src/app/api/smart-routing/outbound-calls/[id]/route.ts`
- `src/app/api/smart-routing/outbound-calls/route.ts`
- `src/app/api/smart-routing/record-by-phone/route.ts`
- `src/app/api/smart-routing/sessions/[id]/route.ts`
- `src/app/api/smart-routing/setup/route.ts`
- `src/app/api/smart-routing/templates/route.ts`
- `src/app/api/webhooks/twilio/voice/smart-routing/route.ts`
- `src/lib/smart-routing/access-detection.ts`
- `src/lib/smart-routing/ai/analytics.ts`
- `src/lib/smart-routing/ai/capabilities.ts`
- `src/lib/smart-routing/ai/compare.ts`
- `src/lib/smart-routing/ai/config-summary.ts`
- `src/lib/smart-routing/ai/context-builder.ts`
- `src/lib/smart-routing/ai/draft-helpers.ts`
- `src/lib/smart-routing/ai/llm-loop.ts`
- `src/lib/smart-routing/ai/model-config.ts`
- `src/lib/smart-routing/ai/prompt.ts`
- `src/lib/smart-routing/ai/recommendations.ts`
- `src/lib/smart-routing/ai/service.ts`
- `src/lib/smart-routing/ai/tools.ts`
- `src/lib/smart-routing/ai/types.ts`
- `src/lib/smart-routing/authorized-callers.ts`
- `src/lib/smart-routing/blocked-callers.ts`
- `src/lib/smart-routing/business-callback-service.ts`
- `src/lib/smart-routing/business-callback-status.ts`
- `src/lib/smart-routing/business-callback-types.ts`
- `src/lib/smart-routing/call-control-service.ts`
- `src/lib/smart-routing/call-recording-pipeline.ts`
- `src/lib/smart-routing/call-recording-service.ts`
- `src/lib/smart-routing/call-recording-storage.ts`
- `src/lib/smart-routing/callback-code-service.ts`
- `src/lib/smart-routing/callback-destination-policy.ts`
- `src/lib/smart-routing/caller-id-resolver.ts`
- `src/lib/smart-routing/caller-id-verification.ts`
- `src/lib/smart-routing/consent-service.ts`
- `src/lib/smart-routing/conversation-minute-math.ts`
- `src/lib/smart-routing/conversation-minutes.ts`
- `src/lib/smart-routing/customer-errors.ts`
- `src/lib/smart-routing/dashboard-outbound-bridge.ts`
- `src/lib/smart-routing/destination-availability.ts`
- `src/lib/smart-routing/destination-resolver.ts`
- `src/lib/smart-routing/display.ts`
- `src/lib/smart-routing/employee-access-runtime.ts`
- `src/lib/smart-routing/employee-access-state.ts`
- `src/lib/smart-routing/employee-access-token-service.ts`
- `src/lib/smart-routing/employee-auth-mode.ts`
- `src/lib/smart-routing/employee-sms-commands.ts`
- `src/lib/smart-routing/events.ts`
- `src/lib/smart-routing/flow-compiler.ts`
- `src/lib/smart-routing/flow-kind.ts`
- `src/lib/smart-routing/flow-runtime.ts`
- `src/lib/smart-routing/flow-service.ts`
- `src/lib/smart-routing/flow-validator.ts`
- `src/lib/smart-routing/forwarding-service.ts`
- `src/lib/smart-routing/hold-audio-resolver.ts`
- `src/lib/smart-routing/hold-music-library.ts`
- `src/lib/smart-routing/human-call-bridge.ts`
- `src/lib/smart-routing/ingress-router.ts`
- `src/lib/smart-routing/internal-numbers.ts`
- `src/lib/smart-routing/last-caller-for-employee.ts`
- `src/lib/smart-routing/last-caller-heuristics.ts`
- `src/lib/smart-routing/loop-validation.ts`
- `src/lib/smart-routing/media-service.ts`
- `src/lib/smart-routing/menu-behaviors.ts`
- `src/lib/smart-routing/nav-children.ts`
- `src/lib/smart-routing/number-provisioning.ts`
- `src/lib/smart-routing/outbound-bridge.ts`
- `src/lib/smart-routing/outcome-labels.ts`
- `src/lib/smart-routing/platform-consent-fast-path.ts`
- `src/lib/smart-routing/prompt-playback.ts`
- `src/lib/smart-routing/recent-callers-for-employee.ts`
- `src/lib/smart-routing/record-by-phone-service.ts`
- `src/lib/smart-routing/recording-announcement.ts`
- `src/lib/smart-routing/ring-group-service.ts`
- `src/lib/smart-routing/route-override.ts`
- `src/lib/smart-routing/schedule-engine.ts`
- `src/lib/smart-routing/session-store.ts`
- `src/lib/smart-routing/setup-readiness.ts`
- `src/lib/smart-routing/telnyx-provider.ts`
- `src/lib/smart-routing/templates.ts`
- `src/lib/smart-routing/test-service.ts`
- `src/lib/smart-routing/twilio-ai-handoff.ts`
- `src/lib/smart-routing/twilio-flow-runtime.ts`
- `src/lib/smart-routing/twilio-webhook-handler.ts`
- `src/lib/smart-routing/twilio-whisper-service.ts`
- `src/lib/smart-routing/types.ts`
- `src/lib/smart-routing/user-destination.ts`
- `src/lib/smart-routing/voice-readiness.ts`
- `src/lib/smart-routing/voicemail-notify.ts`
- `src/lib/smart-routing/webhook-handler.ts`
- `src/lib/smart-routing/whisper-service.ts`
- `src/lib/smart-routing/whisper-text-builder.ts`
- `src/lib/smart-routing/wireframe-demo.ts`
- `src/lib/smart-routing/workspace-settings.ts`

</details>

### realtor

- **Status:** DORMANT_PRODUCT
- **Description:** Real-estate vertical (Front Desk, Speed-to-Lead, leads)
- **Files:** 52
- **Routes:** /realtor/**

<details><summary>Archived paths</summary>

- `src/app/(app)/realtor/agents/activity/page.tsx`
- `src/app/(app)/realtor/agents/front-desk/page.tsx`
- `src/app/(app)/realtor/agents/knowledge/page.tsx`
- `src/app/(app)/realtor/agents/speed-to-lead/page.tsx`
- `src/app/(app)/realtor/appointments/page.tsx`
- `src/app/(app)/realtor/appointments/types/page.tsx`
- `src/app/(app)/realtor/dashboard/page.tsx`
- `src/app/(app)/realtor/layout.tsx`
- `src/app/(app)/realtor/leads/[id]/page.tsx`
- `src/app/(app)/realtor/leads/page.tsx`
- `src/app/(app)/realtor/leads/sources/page.tsx`
- `src/app/(app)/realtor/messages/page.tsx`
- `src/app/(app)/realtor/needs-attention/page.tsx`
- `src/app/(app)/realtor/onboarding/page.tsx`
- `src/app/(app)/realtor/page.tsx`
- `src/app/(app)/realtor/realtor-theme.css`
- `src/app/(app)/realtor/settings/business/page.tsx`
- `src/app/(app)/realtor/setup/page.tsx`
- `src/app/(app)/realtor/test/page.tsx`
- `src/components/realtor/agent-status-panel.tsx`
- `src/components/realtor/dashboard-command-center.tsx`
- `src/components/realtor/front-desk-config-client.tsx`
- `src/components/realtor/intent-field-editor.tsx`
- `src/components/realtor/lead-detail-tabs.tsx`
- `src/components/realtor/lead-detail.tsx`
- `src/components/realtor/leads-export-button.tsx`
- `src/components/realtor/leads-list.tsx`
- `src/components/realtor/onboarding-wizard.tsx`
- `src/components/realtor/realtor-agent-detail-client.tsx`
- `src/components/realtor/realtor-header.tsx`
- `src/components/realtor/setup-home.tsx`
- `src/components/realtor/test-client.tsx`
- `src/components/realtor/workflow-preview.tsx`
- `src/lib/realtor/boot-verification.ts`
- `src/lib/realtor/dashboard.ts`
- `src/lib/realtor/deploy-speed-to-lead.ts`
- `src/lib/realtor/field-editor.ts`
- `src/lib/realtor/layout-guards.ts`
- `src/lib/realtor/lead-detail-data.ts`
- `src/lib/realtor/merge-config.ts`
- `src/lib/realtor/nav.ts`
- `src/lib/realtor/setup-home.ts`
- `src/lib/realtor/types.ts`
- `src/lib/realtor/verification/_read.ts`
- `src/lib/realtor/verification/index.ts`
- `src/lib/realtor/verification/verify-compile.ts`
- `src/lib/realtor/verification/verify-edge-cases.ts`
- `src/lib/realtor/verification/verify-frontdesk.ts`
- `src/lib/realtor/verification/verify-integration.ts`
- `src/lib/realtor/verification/verify-product.ts`
- `src/lib/realtor/wizard-steps.ts`
- `src/lib/realtor/workspace-config.ts`

</details>

### personal-numbers

- **Status:** DORMANT_PRODUCT
- **Description:** Personal line / vault / personal forwarding
- **Files:** 17
- **Routes:** /personal/**

<details><summary>Archived paths</summary>

- `src/app/(app)/personal/activity/page.tsx`
- `src/app/(app)/personal/analytics/page.tsx`
- `src/app/(app)/personal/billing/page.tsx`
- `src/app/(app)/personal/blocked/page.tsx`
- `src/app/(app)/personal/forwarding/page.tsx`
- `src/app/(app)/personal/layout.tsx`
- `src/app/(app)/personal/numbers/[numberId]/page.tsx`
- `src/app/(app)/personal/numbers/find/page.tsx`
- `src/app/(app)/personal/numbers/page.tsx`
- `src/app/(app)/personal/numbers/premium/page.tsx`
- `src/app/(app)/personal/page.tsx`
- `src/app/(app)/personal/porting/page.tsx`
- `src/app/(app)/personal/usage/page.tsx`
- `src/app/(app)/personal/vault/page.tsx`
- `src/app/(app)/personal/voicemail/page.tsx`
- `src/lib/personal/client-actions.ts`
- `src/lib/personal/voicemail-mappers.ts`

</details>

### number-marketplace

- **Status:** DORMANT_PRODUCT
- **Description:** Vanity / premium number search and marketplace
- **Files:** 65
- **Routes:** /numbers/**, /my-numbers/**

<details><summary>Archived paths</summary>

- `src/app/(app)/my-numbers/page.tsx`
- `src/app/(app)/numbers/[numberId]/page.tsx`
- `src/app/(app)/numbers/buy/page.tsx`
- `src/app/(app)/numbers/page.tsx`
- `src/app/(app)/numbers/pools/page.tsx`
- `src/app/(app)/numbers/port/page.tsx`
- `src/app/(app)/numbers/premium/page.tsx`
- `src/app/api/numbers/[numberId]/call-handling/route.ts`
- `src/app/api/numbers/[numberId]/move-workspace/route.ts`
- `src/app/api/numbers/[numberId]/provision/route.ts`
- `src/app/api/numbers/[numberId]/route.ts`
- `src/app/api/numbers/ai/message/route.ts`
- `src/app/api/numbers/pools/route.ts`
- `src/app/api/numbers/port/[id]/route.ts`
- `src/app/api/numbers/port/route.ts`
- `src/app/api/numbers/premium/checkout/route.ts`
- `src/app/api/numbers/premium/complete/route.ts`
- `src/app/api/numbers/premium/reservation/[id]/claim/route.ts`
- `src/app/api/numbers/premium/reservation/[id]/route.ts`
- `src/app/api/numbers/premium/reserve/route.ts`
- `src/app/api/numbers/premium/search/route.ts`
- `src/app/api/numbers/premium/suggest-keywords/route.ts`
- `src/app/api/numbers/route.ts`
- `src/app/api/numbers/sync-telnyx/route.ts`
- `src/app/api/numbers/sync-twilio/route.ts`
- `src/app/api/numbers/telnyx-inbound-repair/route.ts`
- `src/app/api/numbers/telnyx-outbound-repair/route.ts`
- `src/lib/premium-numbers/ai-number-search/chips.ts`
- `src/lib/premium-numbers/ai-number-search/controller.ts`
- `src/lib/premium-numbers/ai-number-search/customer-context.ts`
- `src/lib/premium-numbers/ai-number-search/explain.ts`
- `src/lib/premium-numbers/ai-number-search/intent.ts`
- `src/lib/premium-numbers/ai-number-search/output-sanitizer.ts`
- `src/lib/premium-numbers/ai-number-search/session.ts`
- `src/lib/premium-numbers/ai-number-search/state.ts`
- `src/lib/premium-numbers/ai-number-search/types.ts`
- `src/lib/premium-numbers/business-keyword-llm.ts`
- `src/lib/premium-numbers/business-name-keywords.ts`
- `src/lib/premium-numbers/combined-inventory-search.ts`
- `src/lib/premium-numbers/commercial-semantic.ts`
- `src/lib/premium-numbers/execute-premium-search.ts`
- `src/lib/premium-numbers/find-number-analytics.ts`
- `src/lib/premium-numbers/find-number-client-search.ts`
- `src/lib/premium-numbers/find-number-search-bridge.ts`
- `src/lib/premium-numbers/industry-keywords.ts`
- `src/lib/premium-numbers/keypad.ts`
- `src/lib/premium-numbers/landing-analytics.ts`
- `src/lib/premium-numbers/launch-pricing.ts`
- `src/lib/premium-numbers/pattern-detect.ts`
- `src/lib/premium-numbers/personal-search.ts`
- `src/lib/premium-numbers/popular-inventory.ts`
- `src/lib/premium-numbers/premium-number-search.ts`
- `src/lib/premium-numbers/premium-pricing.ts`
- `src/lib/premium-numbers/product-api.ts`
- `src/lib/premium-numbers/public-find-number-client-search.ts`
- `src/lib/premium-numbers/public-landing-context.ts`
- `src/lib/premium-numbers/reservation-service.ts`
- `src/lib/premium-numbers/scarcity.ts`
- `src/lib/premium-numbers/scoring-config.ts`
- `src/lib/premium-numbers/scoring.ts`
- `src/lib/premium-numbers/search-observability.ts`
- `src/lib/premium-numbers/telnyx-inventory-search.ts`
- `src/lib/premium-numbers/toll-free.ts`
- `src/lib/premium-numbers/types.ts`
- `src/lib/premium-numbers/vanity-display.ts`

</details>

### phone-pbx

- **Status:** DORMANT_PRODUCT
- **Description:** Softphone, queues, IVR admin, dialer
- **Files:** 55
- **Routes:** /phone/**, /api/phone/**

<details><summary>Archived paths</summary>

- `src/app/(app)/phone/calls/[id]/page.tsx`
- `src/app/(app)/phone/calls/page.tsx`
- `src/app/(app)/phone/ivr/page.tsx`
- `src/app/(app)/phone/page.tsx`
- `src/app/(app)/phone/queues/page.tsx`
- `src/app/(app)/phone/readiness/page.tsx`
- `src/app/(app)/phone/settings/page.tsx`
- `src/app/(app)/phone/settings/phone-settings-client.tsx`
- `src/app/api/phone/admin/route.ts`
- `src/app/api/phone/calls/[id]/crm/route.ts`
- `src/app/api/phone/calls/[id]/events/route.ts`
- `src/app/api/phone/calls/[id]/recording/route.ts`
- `src/app/api/phone/calls/[id]/route.ts`
- `src/app/api/phone/calls/route.ts`
- `src/app/api/phone/conference/route.ts`
- `src/app/api/phone/devices/ack/route.ts`
- `src/app/api/phone/devices/route.ts`
- `src/app/api/phone/forwarding/route.ts`
- `src/app/api/phone/ivr/[id]/route.ts`
- `src/app/api/phone/ivr/route.ts`
- `src/app/api/phone/numbers/route.ts`
- `src/app/api/phone/park/route.ts`
- `src/app/api/phone/presence/route.ts`
- `src/app/api/phone/queues/[id]/route.ts`
- `src/app/api/phone/queues/route.ts`
- `src/app/api/phone/readiness/route.ts`
- `src/app/api/phone/settings/route.ts`
- `src/app/api/phone/voicemail/[id]/recording/route.ts`
- `src/app/api/phone/voicemail/route.ts`
- `src/app/api/phone/webrtc-token/route.ts`
- `src/lib/phone/call-events.ts`
- `src/lib/phone/conference-service.ts`
- `src/lib/phone/device-service.ts`
- `src/lib/phone/forwarding-service.ts`
- `src/lib/phone/human-call-service.ts`
- `src/lib/phone/hunt-service.ts`
- `src/lib/phone/inbound-runtime.ts`
- `src/lib/phone/incoming-notify.ts`
- `src/lib/phone/ivr-service.ts`
- `src/lib/phone/park-service.ts`
- `src/lib/phone/presence-service.ts`
- `src/lib/phone/queue-runtime.ts`
- `src/lib/phone/queue-service.ts`
- `src/lib/phone/settings.ts`
- `src/lib/phone/softphone-permissions.ts`
- `src/lib/phone/supervisor-service.ts`
- `src/lib/phone/telnyx-dual-provision.ts`
- `src/lib/phone/telnyx-outbound-voice.ts`
- `src/lib/phone/telnyx-voice-connection.ts`
- `src/lib/phone/twilio-voicemail-pipeline.ts`
- `src/lib/phone/voicemail-greeting-playback.ts`
- `src/lib/phone/voicemail-post-process.ts`
- `src/lib/phone/voicemail-service.ts`
- `src/lib/phone/voicemail-transcribe.ts`
- `src/lib/phone/webrtc-token.ts`

</details>

### call-forwarding

- **Status:** DORMANT_PRODUCT
- **Description:** Standalone call forwarding product (not MCTB forwarding setup)
- **Files:** 26
- **Routes:** /call-forwarding/**, /get/call-forwarding

<details><summary>Archived paths</summary>

- `scripts/test-call-forwarding-mode-switch.ts`
- `scripts/test-call-forwarding-purchase-apply.ts`
- `scripts/test-call-forwarding-setup-persistence.ts`
- `scripts/test-call-forwarding-sms-extract.ts`
- `scripts/test-call-forwarding-sms-pipeline.ts`
- `src/app/(app)/call-forwarding/hours/page.tsx`
- `src/app/(app)/call-forwarding/layout.tsx`
- `src/app/(app)/call-forwarding/outbound/page.tsx`
- `src/app/(app)/call-forwarding/page.tsx`
- `src/app/(app)/call-forwarding/setup/page.tsx`
- `src/app/e/call/[token]/page.tsx`
- `src/app/e/call/layout.tsx`
- `src/app/get/call-forwarding/page.tsx`
- `src/lib/call-forwarding/access-state.ts`
- `src/lib/call-forwarding/authorized-callers.ts`
- `src/lib/call-forwarding/caller-id.ts`
- `src/lib/call-forwarding/outbound-bridge.ts`
- `src/lib/call-forwarding/outbound-runtime.ts`
- `src/lib/call-forwarding/service.ts`
- `src/lib/call-forwarding/setup-service.ts`
- `src/lib/call-forwarding/sms-extract-llm.ts`
- `src/lib/call-forwarding/sms-extract.ts`
- `src/lib/call-forwarding/sms-outbound.ts`
- `src/lib/call-forwarding/usage.ts`
- `src/lib/call-forwarding/webhook-handler.ts`
- `src/lib/call-forwarding/workspace-settings.ts`

</details>

### ai-receptionist

- **Status:** DORMANT_PRODUCT
- **Description:** AI voice agents, Caller Amy, LiveKit receptionist runtime
- **Files:** 293
- **Routes:** /voice/agents/**, /voice/receptionist, /voice/ai-platform/**, /hire/**, /agents/**

<details><summary>Archived paths</summary>

- `docs/ai-receptionist-runtime-implementation.md`
- `docs/caller-amy-realtime-architecture.md`
- `src/app/(app)/agents/[id]/page.tsx`
- `src/app/(app)/agents/john/page.tsx`
- `src/app/(app)/agents/page.tsx`
- `src/app/(app)/company-brain/page.tsx`
- `src/app/(app)/hire/amy/page.tsx`
- `src/app/(app)/hire/brain/page.tsx`
- `src/app/(app)/hire/page.tsx`
- `src/app/(app)/voice/agents/[id]/about/page.tsx`
- `src/app/(app)/voice/agents/[id]/advanced/page.tsx`
- `src/app/(app)/voice/agents/[id]/capabilities/page.tsx`
- `src/app/(app)/voice/agents/[id]/integrations/page.tsx`
- `src/app/(app)/voice/agents/[id]/page.tsx`
- `src/app/(app)/voice/agents/[id]/voice-test/page.tsx`
- `src/app/(app)/voice/agents/new/page.tsx`
- `src/app/(app)/voice/agents/page.tsx`
- `src/app/(app)/voice/ai-platform/page.tsx`
- `src/app/(app)/voice/billing/page.tsx`
- `src/app/(app)/voice/calendars/page.tsx`
- `src/app/(app)/voice/calls/[id]/page.tsx`
- `src/app/(app)/voice/calls/page.tsx`
- `src/app/(app)/voice/campaigns/page.tsx`
- `src/app/(app)/voice/conversations/page.tsx`
- `src/app/(app)/voice/inbound-routing/page.tsx`
- `src/app/(app)/voice/knowledge/page.tsx`
- `src/app/(app)/voice/needs-attention/page.tsx`
- `src/app/(app)/voice/overview/page.tsx`
- `src/app/(app)/voice/receptionist/page.tsx`
- `src/app/(app)/voice/reports/page.tsx`
- `src/app/(app)/voice/settings/page.tsx`
- `src/app/(app)/voice/testing/page.tsx`
- `src/app/(app)/voice/tools/page.tsx`
- `src/app/api/internal/voice-runtime/route.ts`
- `src/app/api/solutions/appointment-receptionist/route.ts`
- `src/app/api/telnyx/voice/tools/route.ts`
- `src/app/api/voice/agents/[id]/flows/generate/route.ts`
- `src/app/api/voice/agents/[id]/flows/optimize/route.ts`
- `src/app/api/voice/agents/[id]/flows/route.ts`
- `src/app/api/voice/agents/[id]/knowledge/route.ts`
- `src/app/api/voice/agents/[id]/latency-profile/route.ts`
- `src/app/api/voice/agents/[id]/route.ts`
- `src/app/api/voice/agents/[id]/test-session/route.ts`
- `src/app/api/voice/agents/[id]/test/route.ts`
- `src/app/api/voice/agents/[id]/tools/route.ts`
- `src/app/api/voice/agents/route.ts`
- `src/app/api/voice/calendars/availability/route.ts`
- `src/app/api/voice/calendars/oauth/google/callback/route.ts`
- `src/app/api/voice/calendars/oauth/google/route.ts`
- `src/app/api/voice/calendars/oauth/microsoft/callback/route.ts`
- `src/app/api/voice/calendars/oauth/microsoft/route.ts`
- `src/app/api/voice/calendars/route.ts`
- `src/app/api/voice/calls/[id]/route.ts`
- `src/app/api/voice/calls/route.ts`
- `src/app/api/voice/campaigns/[id]/route.ts`
- `src/app/api/voice/campaigns/route.ts`
- `src/app/api/voice/flows/generate/route.ts`
- `src/app/api/voice/knowledge/[id]/route.ts`
- `src/app/api/voice/knowledge/[id]/search/route.ts`
- `src/app/api/voice/knowledge/[id]/sources/[sourceId]/route.ts`
- `src/app/api/voice/knowledge/[id]/sources/route.ts`
- `src/app/api/voice/knowledge/[id]/upload/route.ts`
- `src/app/api/voice/knowledge/route.ts`
- `src/app/api/voice/livekit/readiness/route.ts`
- `src/app/api/voice/needs-attention/route.ts`
- `src/app/api/voice/outbound/qualification/test/route.ts`
- `src/app/api/voice/recordings/[id]/stream/route.ts`
- `src/app/api/voice/recordings/[id]/url/route.ts`
- `src/app/api/voice/routing/[id]/route.ts`
- `src/app/api/voice/routing/route.ts`
- `src/app/api/voice/routing/simulate/route.ts`
- `src/app/api/voice/services/[id]/route.ts`
- `src/app/api/voice/services/route.ts`
- `src/app/api/voice/staff/[id]/route.ts`
- `src/app/api/voice/staff/route.ts`
- `src/app/api/voice/telnyx-official-baseline/route.ts`
- `src/app/api/voice/templates/route.ts`
- `src/app/api/voice/templates/test-session/route.ts`
- `src/app/api/voice/tools/[id]/test/route.ts`
- `src/app/api/voice/tools/route.ts`
- `src/app/api/voice/tts-preview/route.ts`
- `src/app/api/voice/voices/route.ts`
- `src/lib/agents/appointment-booking/attention.ts`
- `src/lib/agents/appointment-booking/autonomy-policy.ts`
- `src/lib/agents/appointment-booking/autonomy.ts`
- `src/lib/agents/appointment-booking/booking-state.ts`
- `src/lib/agents/appointment-booking/business-brain.ts`
- `src/lib/agents/appointment-booking/change-proposals.ts`
- `src/lib/agents/appointment-booking/collection-fields.ts`
- `src/lib/agents/appointment-booking/control.ts`
- `src/lib/agents/appointment-booking/deploy.ts`
- `src/lib/agents/appointment-booking/deployment-drift.ts`
- `src/lib/agents/appointment-booking/employee-timeline.ts`
- `src/lib/agents/appointment-booking/execution-trace.ts`
- `src/lib/agents/appointment-booking/field-ownership.ts`
- `src/lib/agents/appointment-booking/handoffs.ts`
- `src/lib/agents/appointment-booking/health.ts`
- `src/lib/agents/appointment-booking/identity.ts`
- `src/lib/agents/appointment-booking/index.ts`
- `src/lib/agents/appointment-booking/intelligence/acceptance-tests.ts`
- `src/lib/agents/appointment-booking/intelligence/amy-livekit-prompt.ts`
- `src/lib/agents/appointment-booking/intelligence/caller-constitution.ts`
- `src/lib/agents/appointment-booking/intelligence/caller-prompt.ts`
- `src/lib/agents/appointment-booking/intelligence/caller-tool-playbook.ts`
- `src/lib/agents/appointment-booking/intelligence/capability-catalog.ts`
- `src/lib/agents/appointment-booking/intelligence/context-policy.ts`
- `src/lib/agents/appointment-booking/intelligence/delegation.ts`
- `src/lib/agents/appointment-booking/intelligence/diagnostic-runtime.ts`
- `src/lib/agents/appointment-booking/intelligence/index.ts`
- `src/lib/agents/appointment-booking/intelligence/owner-confirmation.ts`
- `src/lib/agents/appointment-booking/intelligence/owner-conversation.ts`
- `src/lib/agents/appointment-booking/intelligence/owner-llm-loop.ts`
- `src/lib/agents/appointment-booking/intelligence/owner-model-config.ts`
- `src/lib/agents/appointment-booking/intelligence/owner-runtime.ts`
- `src/lib/agents/appointment-booking/intelligence/owner-tool-executor.ts`
- `src/lib/agents/appointment-booking/intelligence/prompt-modules.ts`
- `src/lib/agents/appointment-booking/intelligence/prompt-versioning.ts`
- `src/lib/agents/appointment-booking/intelligence/request-router.ts`
- `src/lib/agents/appointment-booking/intelligence/tool-descriptions.ts`
- `src/lib/agents/appointment-booking/intelligence/tool-result.ts`
- `src/lib/agents/appointment-booking/intelligence/types.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-architect-invariants.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-architect-llm-loop.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-architect-prompt.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-architect-runtime.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-architect-tools.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-block-catalog.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-patch.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-semantic-validator.ts`
- `src/lib/agents/appointment-booking/intelligence/workflow-test-plan.ts`
- `src/lib/agents/appointment-booking/lifecycle.ts`
- `src/lib/agents/appointment-booking/load-agent.ts`
- `src/lib/agents/appointment-booking/metrics.ts`
- `src/lib/agents/appointment-booking/missed-call-handoff.ts`
- `src/lib/agents/appointment-booking/owner-chat.ts`
- `src/lib/agents/appointment-booking/profile.ts`
- `src/lib/agents/appointment-booking/readiness.ts`
- `src/lib/agents/appointment-booking/reports.ts`
- `src/lib/agents/appointment-booking/responsibility.ts`
- `src/lib/agents/appointment-booking/runtime-registry.ts`
- `src/lib/agents/appointment-booking/setup-commands.ts`
- `src/lib/agents/appointment-booking/simulation.ts`
- `src/lib/agents/appointment-booking/sync-company-brain-from-wizard.ts`
- `src/lib/agents/appointment-booking/sync-policy.ts`
- `src/lib/agents/appointment-booking/test-suite.ts`
- `src/lib/agents/appointment-booking/types.ts`
- `src/lib/agents/appointment-booking/verify-booking.ts`
- `src/lib/agents/appointment-booking/workflow-architect.ts`
- `src/lib/agents/appointment-booking/workflow-blocks.ts`
- `src/lib/agents/appointment-booking/workflow-promote.ts`
- `src/lib/agents/appointment-booking/workflow-validator.ts`
- `src/lib/agents/architecture.ts`
- `src/lib/agents/backfill-appointment-workflows.ts`
- `src/lib/agents/catalog.ts`
- `src/lib/agents/compile-workflow.ts`
- `src/lib/agents/types.ts`
- `src/lib/agents/workflows.ts`
- `src/lib/receptionist-wizard/advanced-defaults.ts`
- `src/lib/receptionist-wizard/advanced-types.ts`
- `src/lib/receptionist-wizard/build-config.ts`
- `src/lib/receptionist-wizard/caller-field-editor.ts`
- `src/lib/receptionist-wizard/defaults.ts`
- `src/lib/receptionist-wizard/harbor-home-demo-config.ts`
- `src/lib/receptionist-wizard/load-advanced.ts`
- `src/lib/receptionist-wizard/load-config.ts`
- `src/lib/receptionist-wizard/types.ts`
- `voice-runtime/ARCHIVED.md`
- `voice-runtime/package.json`
- `voice-runtime/src/amy-receptionist-agent.ts`
- `voice-runtime/src/booking-completion-messages.ts`
- `voice-runtime/src/booking-error.ts`
- `voice-runtime/src/call-context.ts`
- `voice-runtime/src/call-identity.ts`
- `voice-runtime/src/env-aliases.ts`
- `voice-runtime/src/frontdesk-realtime-turn-handling.ts`
- `voice-runtime/src/frontdesk/appointment-lookup.ts`
- `voice-runtime/src/frontdesk/booking-chat-context.ts`
- `voice-runtime/src/frontdesk/booking-email-inline.ts`
- `voice-runtime/src/frontdesk/booking-email-state.ts`
- `voice-runtime/src/frontdesk/booking-field-coherence.ts`
- `voice-runtime/src/frontdesk/booking-field-validation.ts`
- `voice-runtime/src/frontdesk/booking-intake-lifecycle.ts`
- `voice-runtime/src/frontdesk/booking-intake-task.ts`
- `voice-runtime/src/frontdesk/booking-intake-telemetry.ts`
- `voice-runtime/src/frontdesk/booking-operation-guard.ts`
- `voice-runtime/src/frontdesk/booking-operation.ts`
- `voice-runtime/src/frontdesk/booking-prefill.ts`
- `voice-runtime/src/frontdesk/booking-prerequisites.ts`
- `voice-runtime/src/frontdesk/booking-provider-write.ts`
- `voice-runtime/src/frontdesk/booking-recovery.ts`
- `voice-runtime/src/frontdesk/booking-sms.ts`
- `voice-runtime/src/frontdesk/booking-speech.ts`
- `voice-runtime/src/frontdesk/booking-state.ts`
- `voice-runtime/src/frontdesk/booking-tools.ts`
- `voice-runtime/src/frontdesk/calendly-calendar.ts`
- `voice-runtime/src/frontdesk/cancel-appointment-tool.ts`
- `voice-runtime/src/frontdesk/cancel-provider-write.ts`
- `voice-runtime/src/frontdesk/check-booking-status-tool.ts`
- `voice-runtime/src/frontdesk/email-collection-task.ts`
- `voice-runtime/src/frontdesk/email-collection-tools.ts`
- … and 93 more

</details>

### sms-marketing

- **Status:** DORMANT_PRODUCT
- **Description:** Campaigns, bulk send, contacts CRM, automations, growth tools
- **Files:** 142
- **Routes:** /campaigns/**, /contacts/**, /automations/**, /grow/**, /surveys/**, /send/**, /templates/**, /messaging/**

<details><summary>Archived paths</summary>

- `scripts/test-automation-builder.ts`
- `scripts/test-automation-e2e.ts`
- `scripts/test-campaign-catalog.ts`
- `scripts/test-forms-e2e.ts`
- `src/app/(app)/automations/[flowId]/edit/page.tsx`
- `src/app/(app)/automations/[flowId]/executions/[executionId]/page.tsx`
- `src/app/(app)/automations/[flowId]/page.tsx`
- `src/app/(app)/automations/logs/page.tsx`
- `src/app/(app)/automations/new/page.tsx`
- `src/app/(app)/automations/page.tsx`
- `src/app/(app)/automations/templates/page.tsx`
- `src/app/(app)/campaigns/[campaignId]/page.tsx`
- `src/app/(app)/campaigns/all/page.tsx`
- `src/app/(app)/campaigns/calendar/page.tsx`
- `src/app/(app)/campaigns/completed/page.tsx`
- `src/app/(app)/campaigns/drafts/page.tsx`
- `src/app/(app)/campaigns/failed/page.tsx`
- `src/app/(app)/campaigns/new/[category]/page.tsx`
- `src/app/(app)/campaigns/page.tsx`
- `src/app/(app)/campaigns/recurring/page.tsx`
- `src/app/(app)/campaigns/scheduled/page.tsx`
- `src/app/(app)/contacts/[id]/page.tsx`
- `src/app/(app)/contacts/blocked/page.tsx`
- `src/app/(app)/contacts/fields/page.tsx`
- `src/app/(app)/contacts/imports/page.tsx`
- `src/app/(app)/contacts/invalid/page.tsx`
- `src/app/(app)/contacts/lists/page.tsx`
- `src/app/(app)/contacts/page.tsx`
- `src/app/(app)/contacts/segments/page.tsx`
- `src/app/(app)/contacts/tags/page.tsx`
- `src/app/(app)/contacts/unsubscribed/page.tsx`
- `src/app/(app)/contacts/validation/page.tsx`
- `src/app/(app)/grow/click-to-text/page.tsx`
- `src/app/(app)/grow/contact-cards/page.tsx`
- `src/app/(app)/grow/contests/page.tsx`
- `src/app/(app)/grow/forms/[id]/page.tsx`
- `src/app/(app)/grow/forms/page.tsx`
- `src/app/(app)/grow/keywords/page.tsx`
- `src/app/(app)/grow/pages/page.tsx`
- `src/app/(app)/grow/popups/page.tsx`
- `src/app/(app)/grow/qr-codes/page.tsx`
- `src/app/(app)/grow/sources/page.tsx`
- `src/app/(app)/messaging/links/page.tsx`
- `src/app/(app)/messaging/media/page.tsx`
- `src/app/(app)/messaging/payments/page.tsx`
- `src/app/(app)/reports/audit-log/page.tsx`
- `src/app/(app)/reports/automations/page.tsx`
- `src/app/(app)/reports/campaigns/page.tsx`
- `src/app/(app)/reports/contacts/page.tsx`
- `src/app/(app)/reports/inbox/page.tsx`
- `src/app/(app)/reports/integrations/page.tsx`
- `src/app/(app)/reports/integrations/reports-client.tsx`
- `src/app/(app)/reports/links/page.tsx`
- `src/app/(app)/reports/messages/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/reports/usage/page.tsx`
- `src/app/(app)/send/ai/page.tsx`
- `src/app/(app)/send/page.tsx`
- `src/app/(app)/send/quick/page.tsx`
- `src/app/(app)/send/test/page.tsx`
- `src/app/(app)/surveys/[id]/page.tsx`
- `src/app/(app)/surveys/page.tsx`
- `src/app/(app)/templates/ai/page.tsx`
- `src/app/(app)/templates/new/page.tsx`
- `src/app/(app)/templates/page.tsx`
- `src/app/api/automations/[id]/diagnostics/route.ts`
- `src/app/api/automations/[id]/executions/[executionId]/route.ts`
- `src/app/api/automations/[id]/executions/route.ts`
- `src/app/api/automations/[id]/publish/route.ts`
- `src/app/api/automations/[id]/route.ts`
- `src/app/api/automations/[id]/test-sms/route.ts`
- `src/app/api/automations/[id]/test/route.ts`
- `src/app/api/automations/capabilities/route.ts`
- `src/app/api/automations/route.ts`
- `src/app/api/campaigns/[id]/enroll/route.ts`
- `src/app/api/campaigns/[id]/route.ts`
- `src/app/api/campaigns/route.ts`
- `src/app/api/contacts/[id]/activity/route.ts`
- `src/app/api/contacts/[id]/crm-context/route.ts`
- `src/app/api/contacts/[id]/integrations/actions/route.ts`
- `src/app/api/contacts/[id]/integrations/route.ts`
- `src/app/api/contacts/[id]/review/route.ts`
- `src/app/api/contacts/[id]/route.ts`
- `src/app/api/contacts/cleanup/route.ts`
- `src/app/api/contacts/export/route.ts`
- `src/app/api/contacts/fields/route.ts`
- `src/app/api/contacts/import/route.ts`
- `src/app/api/contacts/lists/route.ts`
- `src/app/api/contacts/route.ts`
- `src/app/api/contacts/segments/preview/route.ts`
- `src/app/api/contacts/segments/route.ts`
- `src/app/api/contacts/tags/route.ts`
- `src/app/api/contacts/validate/route.ts`
- `src/app/api/grow/contests/[id]/draw/route.ts`
- `src/app/api/grow/contests/[id]/route.ts`
- `src/app/api/grow/contests/route.ts`
- `src/app/api/grow/widgets/[id]/route.ts`
- `src/app/api/grow/widgets/route.ts`
- `src/app/api/surveys/[id]/route.ts`
- `src/app/api/surveys/route.ts`
- `src/app/api/templates/route.ts`
- `src/app/sms-marketing/page.tsx`
- `src/app/sms-opt-in/page.tsx`
- `src/lib/automations/actions.ts`
- `src/lib/automations/agent-invoke.ts`
- `src/lib/automations/capabilities.ts`
- `src/lib/automations/catalog.ts`
- `src/lib/automations/deployment-diagnostics.ts`
- `src/lib/automations/enroll.ts`
- `src/lib/automations/events.ts`
- `src/lib/automations/execution-detail.ts`
- `src/lib/automations/inbound-trigger-enroll.ts`
- `src/lib/automations/integration-templates.ts`
- `src/lib/automations/metadata.ts`
- `src/lib/automations/processor.ts`
- `src/lib/automations/reviews.ts`
- `src/lib/automations/runner.ts`
- `src/lib/automations/trigger-deployments.ts`
- `src/lib/automations/types.ts`
- `src/lib/automations/validation.ts`
- `src/lib/campaign-tabs.ts`
- `src/lib/campaigns/campaign-message-send.ts`
- `src/lib/campaigns/campaign-processor.ts`
- `src/lib/campaigns/catalog.ts`
- `src/lib/campaigns/enroll-campaign.ts`
- `src/lib/campaigns/recurrence.ts`
- `src/lib/campaigns/sequence-engine.ts`
- `src/lib/campaigns/sequence-runner.ts`
- `src/lib/contact-cards/vcard.ts`
- `src/lib/contact-tabs.ts`
- `src/lib/contacts/activity-timeline.ts`
- `src/lib/contacts/cleanup-list.ts`
- `src/lib/contacts/custom-fields.ts`
- `src/lib/contacts/segment-query.ts`
- `src/lib/contacts/validate-list.ts`
- `src/lib/forms/submit-opt-in.ts`
- `src/lib/forms/types.ts`
- `src/lib/grow-tabs.ts`
- `src/lib/growth/click-to-text.ts`
- `src/lib/growth/keywords.ts`
- `src/lib/links/click-events.ts`
- `src/lib/links/url-safety.ts`

</details>

### solutions-outcomes

- **Status:** DORMANT_PRODUCT
- **Description:** Legacy solutions catalog, outcomes launcher, multi-product dashboards
- **Files:** 64
- **Routes:** /outcomes/**, /solutions/**, /getting-started, /systems/**, /app/**

<details><summary>Archived paths</summary>

- `scripts/test-multi-product-architecture.ts`
- `scripts/test-nav-crosswalk.ts`
- `src/app/(app)/app/page.tsx`
- `src/app/(app)/app/receptionist/page.tsx`
- `src/app/(app)/getting-started/page.tsx`
- `src/app/(app)/onboarding/add-business/page.tsx`
- `src/app/(app)/onboarding/add-personal/page.tsx`
- `src/app/(app)/outcomes/[solution]/[[...section]]/page.tsx`
- `src/app/(app)/outcomes/page.tsx`
- `src/app/(app)/solutions/[category]/[solution]/page.tsx`
- `src/app/(app)/solutions/[category]/page.tsx`
- `src/app/(app)/solutions/ai-call-handling/appointment-assistant/page.tsx`
- `src/app/(app)/solutions/ai-call-handling/appointment-assistant/setup/page.tsx`
- `src/app/(app)/solutions/missed-call-text-back/setup/page.tsx`
- `src/app/(app)/solutions/page.tsx`
- `src/app/(app)/systems/page.tsx`
- `src/lib/outcomes/dashboard-data.ts`
- `src/lib/outcomes/instances.ts`
- `src/lib/outcomes/operational-dashboard-types.ts`
- `src/lib/outcomes/operational-dashboard.ts`
- `src/lib/outcomes/phone-solutions.ts`
- `src/lib/outcomes/registry.ts`
- `src/lib/solution-dashboard.ts`
- `src/lib/solutions-catalog.ts`
- `src/lib/solutions-nav.ts`
- `src/lib/solutions/appointment-receptionist/activate-hooks.ts`
- `src/lib/solutions/appointment-receptionist/build-agent-config.ts`
- `src/lib/solutions/appointment-receptionist/capability-checklist.ts`
- `src/lib/solutions/appointment-receptionist/defaults.ts`
- `src/lib/solutions/appointment-receptionist/hydrate-from-brain.ts`
- `src/lib/solutions/appointment-receptionist/live-calendar.ts`
- `src/lib/solutions/appointment-receptionist/notice-utils.ts`
- `src/lib/solutions/appointment-receptionist/promote-scheduled.ts`
- `src/lib/solutions/appointment-receptionist/required-fields.ts`
- `src/lib/solutions/appointment-receptionist/routing-mode.ts`
- `src/lib/solutions/appointment-receptionist/save-setup.ts`
- `src/lib/solutions/appointment-receptionist/sync-routing.ts`
- `src/lib/solutions/appointment-receptionist/sync-transfer.ts`
- `src/lib/solutions/appointment-receptionist/transfer-utils.ts`
- `src/lib/solutions/appointment-receptionist/types.ts`
- `src/lib/solutions/appointment-receptionist/wizard-presets.ts`
- `src/lib/solutions/generator.ts`
- `src/lib/solutions/hooks/after-hours.ts`
- `src/lib/solutions/hooks/campaigns.ts`
- `src/lib/solutions/hooks/customer-support.ts`
- `src/lib/solutions/hooks/index.ts`
- `src/lib/solutions/hooks/lead-qualification.ts`
- `src/lib/solutions/hooks/legal.ts`
- `src/lib/solutions/hooks/mark-capability.ts`
- `src/lib/solutions/hooks/medical.ts`
- `src/lib/solutions/hooks/missed-call.ts`
- `src/lib/solutions/hooks/outbound.ts`
- `src/lib/solutions/hooks/overflow.ts`
- `src/lib/solutions/hooks/payments.ts`
- `src/lib/solutions/hooks/property-management.ts`
- `src/lib/solutions/hooks/reminders.ts`
- `src/lib/solutions/hooks/reviews.ts`
- `src/lib/solutions/hooks/shared-receptionist.ts`
- `src/lib/solutions/hooks/surveys.ts`
- `src/lib/solutions/hooks/types.ts`
- `src/lib/solutions/missed-call-text-back/graph.ts`
- `src/lib/solutions/missed-call-text-back/save.ts`
- `src/lib/solutions/missed-call-text-back/sync.ts`
- `src/lib/solutions/missed-call-text-back/types.ts`

</details>

### visual-voicemail

- **Status:** DORMANT_PRODUCT
- **Description:** Visual voicemail add-on (not required for core MCTB)
- **Files:** 2
- **Routes:** /voice/voicemail/**

<details><summary>Archived paths</summary>

- `scripts/test-transovo-voicemail.ts`
- `src/app/(app)/voice/voicemail/page.tsx`

</details>

### ai-transcription

- **Status:** DORMANT_PRODUCT
- **Description:** AI transcription add-on for voicemail/SR recordings
- **Files:** 7
- **Routes:** /voice/transcription/**

<details><summary>Archived paths</summary>

- `scripts/test-ai-transcription.ts`
- `src/app/(app)/voice/transcription/page.tsx`
- `src/lib/transcription/deepgram-prerecorded.ts`
- `src/lib/transcription/entitlement.ts`
- `src/lib/transcription/minute-math.ts`
- `src/lib/transcription/service.ts`
- `src/lib/transcription/usage.ts`

</details>

### callback-requests

- **Status:** DORMANT_PRODUCT
- **Description:** Callback requests add-on
- **Files:** 4
- **Routes:** /voice/callback-requests/**

<details><summary>Archived paths</summary>

- `scripts/test-transovo-callback.ts`
- `src/app/(app)/voice/callback-requests/layout.tsx`
- `src/app/(app)/voice/callback-requests/page.tsx`
- `src/lib/callback-requests/service.ts`

</details>

### integrations-heavy

- **Status:** DORMANT_PRODUCT
- **Description:** Deep CRM/native integration wizards (keep top-level integrations hub)
- **Files:** 106
- **Routes:** /integrations/crm/**, /integrations/native/**

<details><summary>Archived paths</summary>

- `src/app/(app)/integrations/crm/[provider]/crm-onboarding-wizard.tsx`
- `src/app/(app)/integrations/crm/[provider]/crm-provider-client.tsx`
- `src/app/(app)/integrations/crm/[provider]/page.tsx`
- `src/app/(app)/integrations/crm/crm-integrations-client.tsx`
- `src/app/(app)/integrations/crm/page.tsx`
- `src/app/(app)/integrations/crm/pipeline/page.tsx`
- `src/app/(app)/integrations/crm/pipeline/pipeline-client.tsx`
- `src/app/(app)/integrations/native/[provider]/native-provider-client.tsx`
- `src/app/(app)/integrations/native/[provider]/page.tsx`
- `src/app/(app)/integrations/native/ai-policy/ai-policy-client.tsx`
- `src/app/(app)/integrations/native/ai-policy/page.tsx`
- `src/app/(app)/integrations/native/appointments/appointments-client.tsx`
- `src/app/(app)/integrations/native/appointments/page.tsx`
- `src/app/(app)/integrations/native/audit/audit-client.tsx`
- `src/app/(app)/integrations/native/audit/page.tsx`
- `src/app/(app)/integrations/native/leads/lead-inbox-client.tsx`
- `src/app/(app)/integrations/native/leads/page.tsx`
- `src/app/(app)/integrations/native/native-integrations-client.tsx`
- `src/app/(app)/integrations/native/orders/orders-client.tsx`
- `src/app/(app)/integrations/native/orders/page.tsx`
- `src/app/(app)/integrations/native/page.tsx`
- `src/app/(app)/integrations/native/tasks/page.tsx`
- `src/app/(app)/integrations/native/tasks/tasks-client.tsx`
- `src/app/api/crm/[provider]/callback/route.ts`
- `src/app/api/crm/conflicts/route.ts`
- `src/app/api/crm/diagnostics/route.ts`
- `src/app/api/crm/env/route.ts`
- `src/app/api/crm/features/route.ts`
- `src/app/api/crm/health/route.ts`
- `src/app/api/crm/logs/route.ts`
- `src/app/api/crm/mappings/route.ts`
- `src/app/api/crm/oauth/callback/route.ts`
- `src/app/api/crm/oauth/start/route.ts`
- `src/app/api/crm/providers/route.ts`
- `src/app/api/crm/runtime/route.ts`
- `src/app/api/crm/settings/route.ts`
- `src/app/api/crm/setup/route.ts`
- `src/app/api/crm/support/route.ts`
- `src/app/api/crm/sync/route.ts`
- `src/app/api/crm/webhooks/[provider]/route.ts`
- `src/app/api/integrations/crm/pipeline/route.ts`
- `src/app/api/integrations/native/[provider]/callback/route.ts`
- `src/app/api/integrations/native/ai/route.ts`
- `src/app/api/integrations/native/appointments/route.ts`
- `src/app/api/integrations/native/audit/route.ts`
- `src/app/api/integrations/native/env/route.ts`
- `src/app/api/integrations/native/leads/route.ts`
- `src/app/api/integrations/native/orders/route.ts`
- `src/app/api/integrations/native/route.ts`
- `src/app/api/integrations/native/tasks/route.ts`
- `src/app/api/integrations/native/webhooks/[provider]/route.ts`
- `src/lib/crm/acceptance.ts`
- `src/lib/crm/adapters/pipedrive.ts`
- `src/lib/crm/adapters/salesforce.ts`
- `src/lib/crm/adapters/zoho.ts`
- `src/lib/crm/automation-actions.ts`
- `src/lib/crm/automation-bridge.ts`
- `src/lib/crm/call-lifecycle.ts`
- `src/lib/crm/capability.ts`
- `src/lib/crm/circuit-breaker.ts`
- `src/lib/crm/conflict.ts`
- `src/lib/crm/conflicts-ui.ts`
- `src/lib/crm/connector.ts`
- `src/lib/crm/db-check.ts`
- `src/lib/crm/diagnostics.ts`
- `src/lib/crm/env-check.ts`
- `src/lib/crm/events.ts`
- `src/lib/crm/feature-matrix.ts`
- `src/lib/crm/field-presets.ts`
- `src/lib/crm/field-validate.ts`
- `src/lib/crm/http.ts`
- `src/lib/crm/human-errors.ts`
- `src/lib/crm/idempotency.ts`
- `src/lib/crm/index.ts`
- `src/lib/crm/logging.ts`
- `src/lib/crm/mappings.ts`
- `src/lib/crm/metrics.ts`
- `src/lib/crm/oauth-callback-handler.ts`
- `src/lib/crm/oauth.ts`
- `src/lib/crm/payloads.ts`
- `src/lib/crm/permissions.ts`
- `src/lib/crm/push.ts`
- `src/lib/crm/redact.ts`
- `src/lib/crm/registry.ts`
- `src/lib/crm/runtime/bulk-sync.ts`
- `src/lib/crm/runtime/event-bus.ts`
- `src/lib/crm/runtime/index.ts`
- `src/lib/crm/runtime/job-types.ts`
- `src/lib/crm/runtime/metadata-refresh.ts`
- `src/lib/crm/runtime/metrics-runtime.ts`
- `src/lib/crm/runtime/priority.ts`
- `src/lib/crm/runtime/rate-limit.ts`
- `src/lib/crm/runtime/rules.ts`
- `src/lib/crm/runtime/subscriptions.ts`
- `src/lib/crm/runtime/webhooks.ts`
- `src/lib/crm/scheduled-sync.ts`
- `src/lib/crm/scopes.ts`
- `src/lib/crm/sdk.ts`
- `src/lib/crm/secrets.ts`
- `src/lib/crm/settings.ts`
- `src/lib/crm/setup.ts`
- `src/lib/crm/sync-engine.ts`
- `src/lib/crm/sync-publish.ts`
- `src/lib/crm/task-due-scan.ts`
- `src/lib/crm/types.ts`
- `src/lib/crm/validate.ts`

</details>

### dev-demo

- **Status:** DORMANT_PRODUCT
- **Description:** Internal dev/demo routes
- **Files:** 5
- **Routes:** /dev/**

<details><summary>Archived paths</summary>

- `src/app/(public)/messaging/payments/mock/[linkId]/page.tsx`
- `src/app/dev/appointment-wizard/layout.tsx`
- `src/app/dev/appointment-wizard/page.tsx`
- `src/app/dev/premium-number-search/page.tsx`
- `src/app/dev/premium-number-search/premium-number-search-client.tsx`

</details>

## MCTB Public Routes (post-extraction target)

- `/`
- `/login`
- `/dashboard`
- `/inbox/**`
- `/voice/missed-calls/**`
- `/voice/consent-log`
- `/voice/setup/**`
- `/voice/schedule`
- `/voice/try-it`
- `/voice/analytics`
- `/voice/numbers/**`
- `/compliance/**`
- `/integrations`
- `/integrations/webhooks`
- `/integrations/api`
- `/integrations/logs`
- `/settings/**`
- `/onboarding/mctb`
- `/privacy`
- `/terms`
- `/contact/**`
