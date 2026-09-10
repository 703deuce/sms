# Appointments Business Texting — Implementation Pass

**Date:** 2026-09-10  
**Scope:** Texting only — no Booking Types / Meetings / Services / Classes / Workshops IA changes

## Objective

Absorb the **existing working** Mass SMS Campaigns experience into Appointments without rebuilding messaging infrastructure. One contact database, one inbox, one send pipeline.

## What was implemented

### Navigation
- `BUSINESS_TEXTING_CAMPAIGNS_IN_V1_NAV = true` in `v1-launch-nav.ts`
- Appointments sidebar: **Messages → Inbox, Campaigns**
- Contacts unchanged: Contacts, Segments, Import, Fields
- Settings → Messaging (existing)

### Canonical routes
- `/appointments/campaigns` — list, filters, create, review, detail
- Legacy `/campaigns/*` preserved (hidden from Appointments nav)
- Route helpers: `src/lib/products/business-texting-routes.ts`, `useCampaignsBasePath()`

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
| UI primitives | `campaign-ui-primitives.tsx` |

### Reused runtime (no new workers/models)
- `src/lib/mass-texting/broadcast/service.ts`
- `src/lib/mass-texting/broadcast/audience.ts` (+ `appointment_preset`)
- `src/lib/mass-texting/campaign-launch.ts` / `campaign-send.ts`
- `src/lib/campaigns/campaign-processor.ts`
- APIs: `src/app/api/mass-texting/campaigns/**`

### Business Texting sender gate
- Server: `getBusinessTextingCampaignStatus()` → `assertMassTextMarketingSendAllowed()`
- UI: `BusinessTextingActivationPanel`

### Completion pass additions (2026-09-10)
- **Contact Detail → Message** — `ContactMessageAction` → `/conversations?contactId=`
- **Appointment-aware audiences** — `appointment_preset` in picker + `resolveAppointmentSegment`
- **Template picker** — `/api/templates` in Create Campaign; manage → `/templates`
- **Visual migration phase 1** — design-system primitives on list, create, audience
- **Internal route cleanup** — Appointments calendar/category/import/segments/detail links use `useCampaignsPath`

### Visual integration
- Appointments layout + Geist pilot chrome
- `campaign-ui-primitives.tsx` — primary migration path
- `appointments-campaigns-overrides.css` — fallback for unmigrated Kimi classes only

## Remaining gaps

See `APPOINTMENTS-BUSINESS-TEXTING-COMPLETION.md` — live provider smokes, inbox reply, full visual migration on review/recurring, browser equivalence proof.

## Red flags avoided

- No new `Campaign` model, worker, inbox, or Contact model
- No `MASS_MESSAGING_IN_V1_NAV` re-enable

## Related docs

- `APPOINTMENTS-BUSINESS-TEXTING-COMPLETION.md`
- `APPOINTMENTS-BUSINESS-TEXTING-TEST-MATRIX.md`
- `APPOINTMENTS-BUSINESS-TEXTING-VISUAL-AUDIT.md`
- `APPOINTMENTS-BUSINESS-TEXTING-TEMPLATE-OWNERSHIP.md`
- `APPOINTMENTS-BUSINESS-TEXTING-ABSORPTION-AUDIT.md`
- `APPOINTMENTS-BUSINESS-TEXTING-CONNECTION-MATRIX.md`
- `APPOINTMENTS-BUSINESS-TEXTING-ROUTE-MAP.md`
