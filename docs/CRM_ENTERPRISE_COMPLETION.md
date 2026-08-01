# CRM Enterprise Completion Pass

This document tracks the enterprise completion work against the Phase 1–20 definition. Architecture (OAuth, adapters, workers, mappings UI, diagnostics, event bus) is preserved — this pass fills **production functionality**.

## What is complete in code (wired)

| Area | Status |
| --- | --- |
| Provider contracts documented | Done (`CRM_PROVIDER_CONTRACTS.md`) |
| External ID mapping fields | Done (`CrmObjectMapping` hash/version/deletion/timestamps) |
| Contact create **and update** (mapped Id) | Done (`push.ts` + adapter upsert) |
| Field mappings → API payloads | Done (`payloads.buildMappedPayload`) |
| findContactByEmail (all 3) | Done |
| One call activity lifecycle | Done (`call-lifecycle.ts` + logCall update-by-id) |
| Zoho Calls module + Task fallback | Done |
| SMS lifecycle + MMS URL links | Done |
| True incremental checkpoints | Done (modified-since + `syncCheckpoints`) |
| Rate limit on sync reads + push writes | Done |
| Task create/update idempotency | Done (object mapping) |
| Deletion policy handling | Done (`markExternalDeleted` + webhook delete events) |
| Sync pause / disable reads / disable writes | Done (preferences enforced) |
| Capability matrix honesty | Done (beta / fallback / unsupported) |
| Companies / leads / deals ingest | Done when prefs enabled |
| Automated contract unit tests | Done (`scripts/test-crm-enterprise.ts`) |
| Real sandbox acceptance | **Pending** — requires live OAuth apps |

## Intentionally not claimed yet

- “Supported and sandbox-proven” for any provider feature until Phase 18 checklist passes
- Native Pipedrive Leads inbox
- Salesforce Change Data Capture subscription
- Zoho/Pipedrive webhook channel auto-registration
- Full conversation-history sync / MMS binary upload into CRM
- Marketing automations / workflow builders

## Sandbox acceptance checklist (per provider)

1. OAuth connect + token refresh  
2. Import contacts / companies / leads (if supported) / deals (if enabled)  
3. Import users, pipelines, stages, custom fields  
4. Create then **update** same contact from Transovo  
5. CRM→Transovo contact change  
6. Create/update company, lead (if supported), deal (if enabled)  
7. Create/update task; create/link note  
8. Log inbound/outbound/missed call; update **same** activity with duration, disposition, recording, transcript, AI summary  
9. Log inbound/outbound SMS + MMS links  
10. Duplicate webhook / retry does not duplicate activities  
11. Token expiry recovery; rate-limit backoff  
12. Deleted CRM record + ownership/pipeline change  
13. Custom-field validation error surfaces in diagnostics  
14. Disconnect → credential cleanup → reconnect without duplicate mappings  

Store evidence under ops notes; flip matrix cells from **Beta** to **Supported and sandbox-proven** only after the checklist passes.

## Ops after merge

1. Create Salesforce / Zoho / Bigin / Pipedrive OAuth apps  
2. Set env vars (`SALESFORCE_*`, `ZOHO_*`, `PIPEDRIVE_*`, optional `*_WEBHOOK_SECRET`)  
3. `npx prisma db push` (mapping columns)  
4. Run workers (`npm run worker:all`)  
5. Run `npm run test:crm-enterprise`  
6. Execute sandbox checklist; update matrix  

## Definition of done (enterprise)

Complete when sandbox acceptance passes for Salesforce, Zoho CRM/Bigin, and Pipedrive, customer-facing claims match verified capabilities, and ordinary call/SMS CRM workflows do not require Zapier.
