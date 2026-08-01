# CRM Enterprise Completion Pass

This document tracks the enterprise completion work against the Phase 1–20 definition. Architecture (OAuth, adapters, workers, mappings UI, diagnostics, event bus) is preserved — this pass fills **production functionality**.

## Implemented in code (wired)

| Area | Status |
| --- | --- |
| Provider contracts documented | Done |
| External ID mapping fields | Done |
| Contact create **and update** (mapped Id) | Done |
| Field mappings → API payloads + coercion | Done |
| findContactByEmail (all 3) | Done |
| One call/SMS activity lifecycle | Done |
| Zoho Calls module + Task fallback | Done |
| True incremental checkpoints | Done |
| Rate limit on sync reads + push writes | Done |
| Task/note create/update idempotency | Done |
| Deletion policy handling | Done |
| Sync pause / disable reads / disable writes | Done |
| Conflict policy (both-sides-changed) | Done |
| Capability matrix honesty | Done (beta until sandbox) |
| Companies / leads / deals ingest + outbound | Done when prefs enabled |
| Product→CRM event publishers (SMS/Voice/contacts) | Done |
| Inbound tasks/notes/activities sync | Done when prefs / historical import enabled |
| Bigin API root + scopes + Leads disabled | Done |
| Tags: outbound + list where supported; SF unsupported | Done |
| CRM RBAC | Done |
| Circuit breaker + clear quarantine + alerts | Done |
| Scheduled hourly incremental reconcile | Done |
| Maintenance gate on CRM sync jobs | Done |
| Diagnostics call lifecycle (update same probe) | Done |
| Settings enforcement (missed call log vs task, notes, MMS, direction outbound, historical activities) | Done |
| Automated contract unit tests | Done (`npm run test:crm-enterprise`) |
| Real sandbox acceptance | **Pending** — requires live OAuth apps |

## Intentionally not claimed / out of scope

- “Supported and sandbox-proven” until Phase 18 checklist passes
- Native Pipedrive Leads inbox
- Salesforce Change Data Capture auto-subscribe
- Zoho/Pipedrive webhook channel auto-registration in their admin UIs
- MMS binary upload into CRM (URL links only)
- Marketing automations / workflow builders

## Ops after merge

1. Create OAuth apps + env vars  
2. `npx prisma db push`  
3. Run workers  
4. `npm run test:crm-enterprise`  
5. Sandbox checklist → flip matrix cells only with evidence  

## Definition of done (enterprise)

Code wiring for the communications CRM project is complete when ordinary call/SMS/contact workflows flow through adapter → sync/push → mappings → settings → diagnostics without Zapier, and remaining work is sandbox validation — not discovering unwired product paths.
