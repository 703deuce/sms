# Transovo Observability Catalog

**Last updated:** 2026-08-23  
**Scope:** MCTB, Smart Routing, platform billing, add-ons

## Structured log sources

| Source | Event / field | Purpose |
|--------|----------------|---------|
| `mctb-event-only` | `mctb_sms_sent` | Recovery SMS accepted (workspaceId, missedCallEventId, callerE164) |
| `transovo-web` | `internal_voice_request_received` | Python voice worker → web bridge actions |
| `mctb-sip-production` | `mctb_direct_dial_forward_early` | Direct dial forward configured on SIP ingress |
| `smart-routing` | `immediate forward answer failed` | Carrier-forward leg latency failures |
| `stripe/webhook` | subscription + checkout processing | Platform product grant/deactivate |

## Database audit tables

| Table | Use |
|-------|-----|
| `missed_call_events` | Canonical MCTB recovery attempts |
| `missed_call_text_traces` | Per-run trace steps |
| `link_click_events` | Tracked URL clicks (`missedCallEventId` when from recovery SMS) |
| `mctb_request_form_submissions` | Public lead-capture form submissions |
| `smart_routing_call_sessions` | SR session outcomes incl. MCTB fallback |
| `smart_routing_sms_consent_events` | Press-1 / SMS consent |
| `provider_webhook_events` | Stripe idempotency + webhook replay protection |
| `workspace_product_features` | Entitlement state (`ACTIVE` / `TRIAL` / `INACTIVE`) |

## APIs for dashboards

| Endpoint | Data |
|----------|------|
| `GET /api/platform/dashboard-summary` | Multi-product cards + 30d counts |
| `GET /api/platform/activity` | Unified activity feed |
| `GET /api/mctb/analytics` | MCTB recovery KPIs |
| `GET /api/smart-routing/analytics` | SR routing KPIs |
| `GET /api/admin/workspace/[workspaceId]` | Admin support snapshot |

## Alerts (recommended)

- Stripe webhook `status=failed` on `provider_webhook_events`
- MCTB send suppressed with `MESSAGING_NOT_APPROVED` spike
- SR publish blocked by `ROUTING_LOOP` validation
- Zero `link_click_events` with non-null `missedCallEventId` after tracked SMS campaign (sanity)

## Trace correlation

- MCTB recovery SMS idempotency key: `mctb-recovery:{missedCallEventId}`
- Link click attribution: parse idempotency key from `messages.idempotencyKey` on `/r/{token}` redirect
- Voice SIP: `providerCallId` / `telnyxCallControlId` in `mctb_voice_bridge_call_events`
