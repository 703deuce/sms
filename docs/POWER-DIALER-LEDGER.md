# Power Dialer — completion ledger

Last updated: Phase 6 integrations, compliance, team, usage, analytics (batch 1).

## Production deploy

| Item | Value |
|------|--------|
| `master` HEAD | Phase 6 commits (after push) |
| VM upload | Supabase Storage **REST** — `@supabase/supabase-js` **not** in `new-app/package.json` (deterministic build; see `power-dialer-audio-storage.ts`) |
| Failed build | `41cdad126` (missing supabase-js) — fixed in `ae7e55bac` |

## Phase 6 (in progress / batch 1)

| Area | Status |
|------|--------|
| CRM integrations (SF/Zoho/Pipedrive) | Reuse `lib/crm` + `integration_connections`; disposition `triggerCrmUpdate` → `crm-sync-bridge` |
| Sync history | `power_dialer_integration_sync_logs` + `/integrations/sync-history` |
| Internal DNC + audit | Tables + eligibility + compliance API/UI |
| Compliance ack before session | `startSessionWithRep` gate |
| Usage limits | `usage-limits.ts` + workspace_limits; block when configured |
| Analytics | `/api/phone/power-dialer/analytics` + shared `metrics-definitions.ts` |
| Team | `/api/phone/power-dialer/team` + settings tab (read-only summary) |
| Workspace defaults → campaigns | `resolveCampaignRules(campaign, wsSettings)` in session runtime |

## Tests (local)

| Script | Result |
|--------|--------|
| `test:power-dialer-phase4` | PASS |
| `test:power-dialer-phase5` | PASS |
| `test:power-dialer-phase6` | PASS |

## Could not verify

- Production `commitSha` for `05cde2dd2` until Coolify finishes
- Browser UI for compliance/integrations/analytics tabs
- Live CRM OAuth writeback on connected tenant
- External DNC registry (honestly not connected)
- Full analytics subpages (campaign/rep/number/screening split routes) — API aggregates exist; dedicated subroutes pending
