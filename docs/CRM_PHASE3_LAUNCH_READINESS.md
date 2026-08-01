# Phase 3 — Production Launch Readiness

**Status:** Framework + Phase 2 ops tooling are complete. Phase 3 is customer experience and launch readiness — not new architecture.

## Objective

A customer can connect Salesforce, Zoho CRM/Bigin, or Pipedrive **without support**, configure synchronization, and use Transovo Voice/SMS as part of daily CRM workflows.

## Shipped in product

| Area | Where |
|------|--------|
| Full onboarding wizard | Provider UI after OAuth (`?wizard=1`) |
| Intelligent setup | `POST /api/crm/setup` — users, pipelines, modules, field presets |
| Field mapping UI | Mappings tab + presets (no JSON) |
| Sync preferences (capability-gated) | Settings + wizard; new voicemail / AI summary / activities toggles |
| Sync dashboard | Dashboard tab |
| Duplicate resolution UI | Conflicts tab + remembered decisions |
| CRM Capability Matrix | Features tab + `src/lib/crm/capability.ts` |
| Support pack / download logs | Support tab + `GET /api/crm/support?download=1` |
| Perf samples | `src/lib/crm/metrics.ts` (initial sync / discovery timings) |
| Secret redaction | `src/lib/crm/redact.ts` on audit/sync details |

## Capability matrix (product rule)

| Feature | Salesforce | Zoho | Pipedrive |
|---------|------------|------|-----------|
| Contacts | ✅ | ✅ | ✅ |
| Companies | ✅ | ✅ | ✅ |
| Leads | ✅ | ✅ | ❌ (Person/Deal) |
| Deals / Opportunities | ✅ | ✅ | ✅ |
| Call / SMS logging | ✅ | ✅ | ✅ |
| Recording / Transcript links | ✅ (link) | ✅ (link) | ✅ (link) |
| Custom field mapping | ✅ | ✅ | ✅ |
| Pipeline mapping | ✅ | ✅ | ✅ |

UI disables unsupported preferences automatically.

## Still required (real sandboxes)

No provider is production-ready until the acceptance checklist in `docs/CRM_PRODUCTION_ACCEPTANCE.md` passes against a **live** sandbox for that provider. Cursor cannot create your OAuth apps or run those tests without credentials.

## Security review (code)

- Tokens encrypted at rest when `INTEGRATION_SECRET_KEY` is set  
- Audit/support packs redact token-like keys  
- Workspace-scoped queries on all CRM APIs  
- Least-privilege scopes in `scopes.ts`  
- Connection validation before “Connected”  
- Rotate `INTEGRATION_SECRET_KEY` / OAuth client secrets in ops runbooks (manual)

## Docs for customers & support

- `docs/CRM_CUSTOMER_SETUP.md` — quick start  
- `docs/CRM_TROUBLESHOOTING.md` — recovery  
- `docs/CRM_FIELD_MAPPING_GUIDE.md`  
- `docs/CRM_SYNC_SETTINGS_GUIDE.md`  
- `docs/CRM_FAQ.md`  
- `docs/CRM_SUPPORT_CHECKLIST.md`  
- `docs/CRM_PRODUCTION_ACCEPTANCE.md`  
