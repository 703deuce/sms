# Appointments Business Texting — Connection Matrix

Maps canonical Business Texting capabilities to UI, routes, APIs, domain, workers, and consequences.

**Rule:** No UI-only features. Every control is connected or truthfully blocked.

## Campaign list

| Layer | Path / artifact |
|-------|-----------------|
| UI | `KimiCampaignsConnected` → `CampaignsList` |
| Route | `/appointments/campaigns` |
| API | `GET /api/mass-texting/campaigns` |
| Service | `listBroadcastCampaigns()` |
| Model | `Campaign` |
| Worker | — |
| Provider | — |
| Inbox | — |

## Create campaign

| Layer | Path / artifact |
|-------|-----------------|
| UI | `CreateCampaign` |
| Route | `/appointments/campaigns/new` |
| API | `POST /api/mass-texting/campaigns` |
| Service | `saveCampaignDraft()` adapter |
| Model | `Campaign` (DRAFT) |
| Gate | `getBusinessTextingCampaignStatus()` when under Appointments |

## Audience selection

| Layer | Path / artifact |
|-------|-----------------|
| UI | `AudiencePicker` |
| Route | (compose step) |
| API | `POST /api/mass-texting/campaigns/audience-preview` |
| Service | `src/lib/mass-texting/broadcast/audience.ts` |
| Models | `Contact`, `Segment`, `ContactList` (lists contextual) |
| Suppression | `Suppression`, `campaign-guards`, `unified-send-gate` |
| Import link | `/contacts/imports` (canonical) |

## Message composer

| Layer | Path / artifact |
|-------|-----------------|
| UI | `CreateCampaign` + `campaign-compose.tsx` patterns |
| API | Campaign PATCH on draft save |
| Service | `compose-draft.ts`, segment estimate utils |
| Templates | `GET /api/templates` (Campaign/SMS); separate from appointment workflow templates |
| MMS | Existing media picker if enabled in compose |

## Review / attestation

| Layer | Path / artifact |
|-------|-----------------|
| UI | `ReviewDetails` / `campaign-review.tsx` |
| Route | `/appointments/campaigns/new/review` |
| API | `GET .../launch-review`, `POST .../launch` |
| Service | `campaign-launch.ts`, `ListImportAttestation` where required |
| Audit | `CampaignLaunchAudit` |

## Send / schedule

| Layer | Path / artifact |
|-------|-----------------|
| UI | Review launch button |
| API | `POST /api/mass-texting/campaigns/[id]/launch` |
| Service | `campaign-launch.ts`, `campaign-send.ts` |
| Worker | `campaign-processor.ts`, BullMQ / `JobQueue` |
| Provider | Telnyx/Twilio via messaging service |
| Callback | Delivery webhooks → `delivery-status.ts` |
| Results | `CampaignRecipient`, `CampaignMessage` |

## Campaign detail / results

| Layer | Path / artifact |
|-------|-----------------|
| UI | `CampaignDetailView`, `CampaignResultsView` |
| Route | `/appointments/campaigns/[campaignId]` |
| API | `GET /api/mass-texting/campaigns/[id]`, stats, recipients |
| Service | `listBroadcastRecipients()`, analytics helpers |

## Inbox (replies)

| Layer | Path / artifact |
|-------|-----------------|
| UI | `/conversations` (shared) |
| Inbound | `inbound-process.ts` |
| Model | `Conversation`, `ConversationMessage` |
| Source | `ConversationProductSource.MASS_TEXT` (preserved) |

## Contacts

| Layer | Path / artifact |
|-------|-----------------|
| UI | `kimi-contacts-connected.tsx` |
| Routes | `/contacts`, `/contacts/segments`, `/contacts/imports`, `/contacts/fields` |
| API | `/api/contacts/**` |
| Model | `Contact` (single graph) |
| Import | `contact-import-form.tsx`, `/api/contacts/import` |
| Attestation | `ListImportAttestation`, `/api/mass-texting/import-attestation` |

## Segments

| Layer | Path / artifact |
|-------|-----------------|
| UI | `kimi-segments-connected.tsx` |
| Route | `/contacts/segments` |
| Service | `segment-query.ts` |
| Model | `Segment` |
| Campaign use | Audience picker + `audience.ts` |

## Business Texting activation

| Layer | Path / artifact |
|-------|-----------------|
| UI | Settings → `MessagingSettingsConnected`, `BusinessTextingActivationPanel` |
| Route | `/settings/messaging` |
| API | `/api/messaging/registration`, `/api/mass-texting/registration` |
| Gate | `assertMassTextMarketingSendAllowed()` |
| Status API | `GET /api/appointments/business-texting/status` |
| Models | `MessagingRegistration`, `MessagingProductRegistration` (MASS_TEXT_MARKETING) |

## Suppression / STOP

| Layer | Path / artifact |
|-------|-----------------|
| Store | `Suppression` |
| Inbound STOP | `inbound-process.ts`, `subscribe-guard.ts` |
| Send gate | `unified-send-gate.ts`, `campaign-guards.ts` |
| UI | Excluded counts on launch-review; contact messaging status where shown |

## Intentionally not connected (hidden)

| Feature | Status |
|---------|--------|
| SMS Dashboard | Hidden |
| `/send` quick send page | Hidden — use Inbox from Contact |
| Grow, Drips, Playbooks | Hidden |
| `/messaging/links` sidebar | Hidden — link tracking in composer only if enabled |
| MCTB voice path | Isolated — `test-mass-texting-boundary.ts` |
