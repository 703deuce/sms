# Appointments Business Texting — Implementation Pass

**Date:** 2026-09-10  
**Scope:** Texting only — no Booking Types / Meetings / Services / Classes / Workshops IA changes

## Objective

Absorb the **existing working** Mass SMS Campaigns experience into Appointments without rebuilding messaging infrastructure. One contact database, one inbox, one send pipeline.

## What was implemented (this pass)

### Navigation
- `BUSINESS_TEXTING_CAMPAIGNS_IN_V1_NAV = true` in `v1-launch-nav.ts`
- Appointments sidebar: **Messages → Inbox, Campaigns**
- Contacts unchanged: Contacts, Segments, Import, Fields
- Settings → Messaging (existing)

### Canonical routes
- `/appointments/campaigns` — list, filters, create, review, detail
- Legacy `/campaigns/*` preserved (hidden from Appointments nav)
- Route helpers: `src/lib/products/business-texting-routes.ts`

### Reused components (no new campaign product)
| Surface | Component |
|---------|-----------|
| List glue | `kimi-campaigns-connected.tsx` |
| List UI | `kimi/campaigns/components/CampaignsList.tsx` |
| Create | `kimi/campaigns/components/CreateCampaign.tsx` |
| Review | `kimi/campaigns/components/ReviewDetails.tsx` |
| Audience | `kimi/campaigns/components/AudiencePicker.tsx` |
| Detail | `campaign-detail-view.tsx` |
| Results | `broadcast/campaign-results.tsx` |

### Reused runtime (no new workers/models)
- `src/lib/mass-texting/broadcast/service.ts`
- `src/lib/mass-texting/broadcast/audience.ts`
- `src/lib/mass-texting/campaign-launch.ts` / `campaign-send.ts`
- `src/lib/campaigns/campaign-processor.ts`
- `src/lib/campaigns/campaign-message-send.ts`
- APIs: `src/app/api/mass-texting/campaigns/**`

### Business Texting sender gate
- Server: `getBusinessTextingCampaignStatus()` → `assertMassTextMarketingSendAllowed()`
- API: `GET /api/appointments/business-texting/status`
- UI: `BusinessTextingActivationPanel` — discoverable Campaigns, blocked send until approved sender
- Settings CTA: `/settings/messaging`

### Visual integration
- Campaign routes under `/appointments/*` inherit Appointments layout (Geist, pilot chrome)
- `appointments-campaigns-overrides.css` — scoped teal/charcoal token remap for `.kimi-campaigns`
- Layout preserved; purple SMS tokens overridden under Appointments pilot only

### Contacts integration
- Audience picker links to canonical **Contacts → Import**
- Segments/lists/contacts resolved via existing `audience.ts` + `kimi-campaigns-adapter`
- No second Contacts database or nav entry

## What was NOT implemented (remaining gaps)

| Gap | Notes |
|-----|-------|
| Full component token migration | Some Kimi campaign classes still use legacy `btn-primary` / indigo utilities; overrides handle most under pilot |
| Contact detail → Message action | Planned (BT-19) |
| Campaign activity on Contact detail | Defer unless activity architecture ready |
| Template ownership merge | Audit: prefer Automations → Templates; not wired in composer yet |
| Appointment-aware segment presets in Campaign picker | Backend exists; UI promotion pending |
| Legacy `/campaigns` redirect | Intentionally kept parallel until equivalence proven |
| Focused live send / Inbox reply smokes | Require provider test environment |

## Red flags avoided

- No new `Campaign` model
- No new campaign worker
- No new inbox
- No new Contact model
- No `MASS_MESSAGING_IN_V1_NAV` re-enable

## Related docs

- `APPOINTMENTS-BUSINESS-TEXTING-ABSORPTION-AUDIT.md`
- `APPOINTMENTS-BUSINESS-TEXTING-CONNECTION-MATRIX.md`
- `APPOINTMENTS-BUSINESS-TEXTING-ROUTE-MAP.md`
- `APPOINTMENTS-BUSINESS-TEXTING-V1-SCOPE.md`
- `APPOINTMENTS-BUSINESS-TEXTING-CERTIFICATION-PAUSE.md`
