# Four products — customer E2E audit (2026-10-15)

**Scope:** MCTB · Appointment Reminders · Mass Texting (Campaigns) · Review Requests  
**Excluded:** AI Receptionist  
**Environment:** https://transovo.ai (cert browser account via dev-bypass)

## How this audit was run

1. Production route smoke: `UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/audit-three-products-production-routes.ts` → `four-products-route-audit.json`
2. Authenticated API probe: `npx tsx scripts/probe-prod-four-product-apis.ts`
3. Manual browser pass (computer use) on primary journeys
4. Production web logs for `/reviews/requests` SSR errors

## Findings (before fix)

| ID | Product | Step | Severity | Issue | Root cause |
|----|---------|------|----------|-------|------------|
| F1 | Reviews | Open `/reviews/requests` | **P0** | Error boundary / “page couldn’t load” | `ReferenceError: OPUS_CARDTitle is not defined` in review request components (token used but never exported/imported) |
| F2 | Reviews | Route smoke false negative | P2 | Playwright reported LOAD_OK while SSR threw | Error copy uses “couldn’t” not “could not”; audit patterns missed it |
| F3 | MCTB | Recovery / Text Back tabs | P3 | Brief “Loading…” during audit | Transient `/api/mctb/setup` fetch; API returns 200 on probe — not a hang |
| F4 | All | Live PSTN/SMS | N/A | Not exercised | Requires real phones; cert script guards prevent duplicate live sends |

## Findings (after fix — expected)

| ID | Fix |
|----|-----|
| F1 | Export `OPUS_CARDTitle` from `opus-surfaces.ts`; import in review-requests panel/send/bulk/campaigns |
| F2 | Extend `ERROR_PATTERNS` in route audit script |

## API probe results (production, pre-deploy fix)

| API | Status |
|-----|--------|
| `GET /api/mctb/setup` | 200 |
| `GET /api/appointment-reminders/reminders/workspace` | 200 |
| `GET /api/appointment-reminders/ai-rescheduler/operations` | 200 |
| `GET /api/templates/unified` | 200 |
| `GET /api/reputation/contacts?businessId=ws_1` | 200 |
| `GET /api/mass-texting/campaigns` | 200 |

## Customer journey verdict (UI + API, cert workspace)

| Product | Can open product & core configure/send UI? | API backing | Live delivery |
|---------|---------------------------------------------|-------------|---------------|
| MCTB | Yes | Setup API OK | Human PSTN cert |
| Appointment Reminders | Yes | Workspace + test previews OK | M365 + appointment with phone |
| Campaigns | Yes | List + unified templates OK | Entitlement + launch |
| Review Requests | **No until F1 deployed** | Contacts/stats OK | Campaign/drip after F1 |

## Re-run after deploy

```bash
UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/audit-three-products-production-routes.ts
UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/probe-prod-four-product-apis.ts
```

Confirm `/reviews/requests` shows “Review Requests” header (not error shell) and no `OPUS_CARDTitle` in web container logs.
