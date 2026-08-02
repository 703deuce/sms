# Calendly Live Integration Acceptance Report

**Date:** 2026-08-02  
**Branch:** `cursor/calendly-live-acceptance-b56f`  
**Production callback:** `https://transovo.ai/api/integrations/native/calendly/callback`  
**Test account plan:** Free (webhooks plan-blocked by Calendly)

Statuses used: Live tested and passed · Failed and fixed · Code implemented but not live tested · Unsupported · Blocked by Calendly plan or permissions

---

## Configuration (from repository)

| Item | Exact value |
|------|-------------|
| Client ID | `CALENDLY_CLIENT_ID` |
| Client secret | `CALENDLY_CLIENT_SECRET` |
| Webhook signing | `CALENDLY_WEBHOOK_SIGNING_KEY` (alias `CALENDLY_WEBHOOK_SECRET`) |
| App URL | `APP_URL` (+ `NEXT_PUBLIC_APP_URL` fallback) |
| Encryption | `INTEGRATION_SECRET_KEY` |
| Database | `DATABASE_URL` |
| OAuth authorize | `https://auth.calendly.com/oauth/authorize` |
| OAuth token | `https://auth.calendly.com/oauth/token` |
| API | `https://api.calendly.com` (v2 only) |
| Callback | `{APP_URL}/api/integrations/native/calendly/callback` |
| Webhook | `{APP_URL}/api/integrations/native/webhooks/calendly?token=…` |
| Queue | `ext-calendly` (drained **in main web process**) |
| Job types | `integration_sync`, `integration_webhook_process`, (+ shared automation/health) |
| Schema | `npm run db:push` |
| Scopes | `users:read` `event_types:read` `scheduled_events:read` `webhooks:read` `webhooks:write` |

### Scope table

| Scope | Feature | Requested | Necessary |
|-------|---------|-----------|-----------|
| `users:read` | Identity `/users/me` | Yes | Yes |
| `event_types:read` | Event types metadata | Yes | Yes |
| `scheduled_events:read` | Events + invitees | Yes | Yes |
| `webhooks:read` | List subscriptions | Yes | Yes |
| `webhooks:write` | Create/delete subscriptions | Yes | Yes (paid plans) |
| `contacts:*` | Contacts API | No | No — unsupported |
| `scheduled_events:write` | Direct book/cancel API | No | No — unsupported |
| `scheduling_links:write` / `shares:write` | Single-use links | No | No — unsupported |
| `event_types:write` / `availability:*` | Manage types/availability | No | No — unsupported |

---

## Issues discovered and fixed

1. **Native OAuth callback + native webhooks returned 401** — middleware did not mark `/api/integrations/native/*/callback` or `/webhooks/` public. **Failed and fixed.**
2. **Empty OAuth scopes** — new Calendly apps grant zero API access without scopes. Now requests least-privilege v2 scopes. **Failed and fixed** (customers must **Reconnect** once after deploy).
3. **Missing `verifyWebhook` on Calendly adapter** — native webhook route never verified signatures. **Failed and fixed.**
4. **Signing key env name** — Coolify/docs may use `CALENDLY_WEBHOOK_SIGNING_KEY`; code only looked at `CALENDLY_WEBHOOK_SECRET` / config. Both accepted. **Failed and fixed.**
5. **Webhook registration body** — user-scoped subscriptions require both `organization` and `user` URIs. **Failed and fixed.**
6. **Capability overclaim** — Contacts API / scheduling-link actions were advertised without implementation. Marked unsupported. **Failed and fixed.**
7. **Free-plan webhooks** — registration errors now surface as plan-blocked; incremental reconcile remains the Free-plan path. **Documented.**
8. **Contact matching** — email match is case-insensitive; phone then email; `autoCreateContacts` honored on appointment sync and webhook events (`createIfMissing`). **Failed and fixed.**
9. **Diagnostics console** — Calendly panel shows callback/webhook URLs, signing-key presence, user/org URIs, plan-blocked webhook state, register-webhooks action. **Failed and fixed.**

---

## Status matrix

### Configuration
| Item | Status |
|------|--------|
| Environment variables | Code implemented but not live tested (agent cannot auth; Diagnostics after deploy) |
| Callback URL | Failed and fixed (prod still 401 until this branch deploys) |
| Webhook URL | Failed and fixed (prod still 401 until this branch deploys) |
| Scopes | Failed and fixed |
| Workers | N/A — main web in-process drain (`ext-calendly`) |
| Migration | `npm run db:push` (schema already covers connections/tokens/mappings/webhooks/sync) |
| Free plan webhooks | Blocked by Calendly plan or permissions |

### OAuth
| Item | Status |
|------|--------|
| Authorization / callback / storage / refresh | Code implemented but not live tested (Reconnect required after scope fix) |
| Disconnect / reconnect | Code implemented but not live tested |

### Reads
| Item | Status |
|------|--------|
| User / organization / event types / scheduled events / invitees | Code implemented but not live tested |
| Members / Contacts API / availability | Unsupported |
| Cancel / reschedule URLs on invitees | Failed and fixed (now persisted from invitee payload) |

### Writes
| Item | Status |
|------|--------|
| Webhook subscription | Blocked by Calendly plan or permissions on Free; code ready for paid |
| Single-use link / direct booking / event-type writes | Unsupported |

### Runtime
| Item | Status |
|------|--------|
| Initial sync / incremental reconcile | Code implemented but not live tested |
| Webhooks + signature validation | Failed and fixed (code); live delivery Blocked by Calendly plan or permissions on Free |
| Contact matching (invitee email/phone) | Failed and fixed (code); live Code implemented but not live tested |
| Idempotency / retries | Code implemented but not live tested |

---

## Operator steps after deploy

1. Redeploy **main web app** from `master`.
2. Confirm Coolify has `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`, and preferably `CALENDLY_WEBHOOK_SIGNING_KEY`.
3. Register callback exactly: `https://transovo.ai/api/integrations/native/calendly/callback`
4. In Calendly developer app, enable the same scopes listed above.
5. In Transovo: **Disconnect** then **Connect Calendly** (required so new scopes are granted).
6. Diagnostics → validate / identify / read / acceptance.
7. Expect webhook registration **Blocked by Calendly plan** on Free; confirm incremental sync still queues.

Do **not** declare Calendly complete on Free merely because OAuth works — webhooks remain plan-gated; reconcile must cover bookings/cancellations until a paid plan is used.
