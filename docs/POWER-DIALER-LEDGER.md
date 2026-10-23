# Power Dialer — completion ledger

Last updated: Phase 7 acceptance fixes (2026-10-23).

## Production deploy

| Item | Value |
|------|--------|
| **Final `commitSha`** | _(pending deploy — see Phase 7 row below)_ |
| **Prior Phase 6b SHA** | `c262991e007541f827ce2507890ffe34bd87fd11` |
| **Phase 6 migration** | `20261023180000_power_dialer_phase6` — verify script requires `phase6Applied: true` + DNC/sync/audit tables |
| **Build** | `@supabase/supabase-js` not in `new-app` (Storage REST) |
| **Disk (Coolify)** | ~52% on `/` at deploy verify |

## Phase 6b delivered

| Item | Status |
|------|--------|
| CRM list import UI | `CrmImportDialog` + `import-crm` API; button hidden unless CRM connected |
| Integration detail | `/app/power-dialer/integrations/[provider]` + PATCH settings/mappings |
| Sync history retry | `POST …/sync-history/[id]/retry` |
| Call history CRM chip | `metadata.crmSync` on list + detail |
| Analytics subroutes | campaigns, representatives, numbers, screening, usage + shared nav |
| DNC CSV import | compliance API + UI |
| Team | PATCH campaign access + activity visibility |
| Auth tests | `test:power-dialer-authorization` |
| Metrics consistency | `test:power-dialer-metrics-consistency` |

## Self-QA (transovo.ai) — summary

| Page / control | Verified | Notes |
|----------------|----------|-------|
| PD Overview | Yes | Screenshots in artifacts |
| PD Dialer | Yes | No live call placed |
| PD Campaigns | Yes | |
| PD Calling Lists | Yes | Import from CRM hidden (no CRM connected) — correct |
| PD Callbacks | Yes | |
| PD Call History | Yes | CRM chip when logs exist |
| PD Number Health | Yes | |
| PD Analytics + 5 subpages | Yes | |
| PD Integrations + detail + sync history | Yes | |
| PD Settings (incl. compliance, team, usage) | Yes | DNC add/remove exercised |
| Global Phone / Contacts / Integrations | Yes | |
| Global Billing `/app/billing` | No | 404 — route not in new-app (pre-existing; not PD) |

Artifacts: `/opt/cursor/artifacts/overview.png`, `analytics-nav.png`, `integrations.png`, `compliance-tab.png`, `calling-lists.png`, `power-dialer-phase-6b-qa-report.md`

## Tests (VM)

| Script | Result |
|--------|--------|
| `test:power-dialer-phase4` | PASS |
| `test:power-dialer-phase6` | PASS |
| `test:power-dialer-metrics-consistency` | PASS |
| `test:power-dialer-authorization` | PASS |

## Phase 7 (acceptance defect list)

| # | Defect | Implementation | Tests | Browser verify |
|---|--------|----------------|-------|----------------|
| 1 | Integration detail crash when disconnected | Normalized API connection; `IntegrationDetailContent` + error boundary | `test:power-dialer-phase7` shape check | Pending deploy |
| 2 | CSV preview auto-run + labels | `guessCsvColumnMapping` + debounced preview; `SimpleSelect` visible labels | `test:power-dialer-phase7` | Pending deploy |
| 3 | Scripts library CRUD | `scripts/[id]` PATCH/DELETE; UI edit/preview/clone/archive/delete/default | Manual/API | Pending deploy |
| 4 | Dialer session setup controls | Pre-session campaign detail, caller ID, mode, phone fields, readouts, eligible count | — | Pending deploy |
| 5 | Remove debug copy | Settings, callbacks, call history, integrations labels | — | Pending deploy |
| 6 | Settings tabs spec | 11 tabs; VM opt-in under Voicemail drops; merged Compliance | — | Pending deploy |
| 7 | Dispositions UX | Delete confirm; add outcome focus + toast; sort order field | — | Pending deploy |
| 8 | Campaign drawer | Inline field errors; tab overflow; empty list link | — | Pending deploy |
| 9 | URL state | Callbacks `?tab=`; Analytics `?tab=` + path redirects | — | Pending deploy |
| 10 | Vercel insights 404 | Analytics only when `VERCEL=1` | — | Pending deploy |
| 11 | During hours undefined | `routing-summary` fallback | — | Pending deploy |
| 12 | ZZ-TEST cleanup | Via app APIs on prod workspace | — | Pending auth |

## Could not verify

- Live CRM import/writeback (no connected CRM on QA workspace)
- SMS worker `crm_push_event` end-to-end on prod
- Billing page (404 at `/app/billing`)
- Independent Phase 7 acceptance (awaiting John)
