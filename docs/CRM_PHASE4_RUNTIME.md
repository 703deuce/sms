# Phase 4 — CRM Integration Runtime & Automation Engine

**Status:** Framework, UI, and diagnostics are complete. Phase 4 is the runtime layer only — no redesign of onboarding, mapping, or adapters’ business logic.

## Objective

Every Transovo event flows through one centralized bus. Providers receive only supported events. Rate limits, priorities, rules, webhooks, and bulk sync keep the system reliable and extensible. A fourth CRM should require **only** a new adapter via the SDK.

## Architecture

```
Product call sites
       ↓
emitPlatformEvent / publish* helpers   (event bus)
       ↓
Subscription engine (supported | optional | unsupported)
       ↓
Rules engine → actions (log_call, create_task, …)
       ↓
Provider-isolated queues (crm-salesforce | crm-zoho | crm-pipedrive)
  + priority (high / medium / low)
       ↓
Rate limiter (per provider token bucket + cooldown)
       ↓
pushCrmEventJob / sync / metadata / bulk / webhook jobs
```

## Parts

| Part | Code |
|------|------|
| Unified event bus | `src/lib/crm/runtime/event-bus.ts`, `events.ts` |
| Event subscriptions | `src/lib/crm/runtime/subscriptions.ts` |
| Rules engine | `src/lib/crm/runtime/rules.ts` (override via `configJson.crmRules`) |
| Prioritization | `src/lib/crm/runtime/priority.ts` + `JobQueue.priority` |
| Rate limits | `src/lib/crm/runtime/rate-limit.ts` |
| Metadata refresh | `crm_metadata_refresh` job |
| Webhooks | `POST /api/crm/webhooks/[provider]?workspaceId=` |
| Bulk sync | `crm_bulk_sync` + checkpoints |
| Workers | BullMQ queues `crm-*` + DB claim by priority |
| Metrics | `GET /api/crm/runtime` |
| SDK | `src/lib/crm/sdk.ts` → `defineCrmProvider` |

## Event types

Includes calls, voicemail, recording/transcript/AI summary, SMS (sent/delivered/failed/received), contacts, leads, tasks, callbacks, appointments, users.

Unsupported events (e.g. Pipedrive `lead.created`) are skipped gracefully — never crash the bus.

## Priority

| Band | Score | Examples |
|------|-------|----------|
| High | 10 | Calls, SMS, callbacks, tasks |
| Medium | 50 | Recordings, contacts, leads |
| Low | 90 | Initial/bulk/historical sync |

## Rate limits (defaults)

Isolated per provider workspace bucket: Salesforce ~80 rpm, Zoho ~60, Pipedrive ~100. 429 → exponential cooldown; other providers unaffected.

## Webhooks

- Signature HMAC (`CRM_WEBHOOK_SECRET` or `{PROVIDER}_WEBHOOK_SECRET`)
- Replay freshness (`x-crm-timestamp`)
- Dedup by `externalId` / body fingerprint
- Async process job with retry → dead after max attempts

## Adding a fourth CRM

1. Implement adapter methods listed in `CRM_SDK_CHECKLIST`
2. Add capability rows + event subscription
3. `defineCrmProvider({ adapter })` + register in `registry.ts`
4. Add BullMQ queue name `crm-{id}` (optional; DB drain still works)

Do **not** fork the event bus, rules, or onboarding.

## Acceptance

- [x] Events enter the bus  
- [x] Providers receive only supported events  
- [x] Unsupported fail gracefully  
- [x] Per-provider rate limit isolation  
- [x] Bulk/metadata jobs + checkpoint hook  
- [x] Retries / dead letters / deferred 429  
- [x] SDK surface for new adapters  
- [ ] Live sandbox soak (ops — same as prior phases)

## After Phase 4

CRM **v1 is complete**. Prefer softphone, SMS, billing, permissions, IVR, analytics, and mobile over adding Dynamics/Close/Monday until customers ask.
