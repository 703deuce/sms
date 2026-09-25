# Voice final controlled remediation report

## 1. Executive summary

This pass closes the verified launch gaps from `docs/VOICE-FINAL-GAP-VERIFICATION.md` without expanding Voice V3 runtime scope:

- **Outbound Voice webhooks** are customer-configurable under Integrations → Webhooks, with delivery jobs wired to the existing `executeVoiceWebhookDeliverJob` executor.
- **Legacy `/voice/agents/*`** customer routes redirect to canonical destinations (`/voice/receptionist` or `/integrations`); APIs and models are untouched.
- **`/voice/inbound-routing`** no longer presents as active Voice V3 configuration; it redirects to `/voice/call-handling` with an explanatory compatibility page.
- **Digest** was not implemented; a stale “Morning digest summary” outcome bullet was corrected.

Recording, common-reasons aggregation, generic follow-up SMS, and Voice V3 conversational runtime were not modified.

## 2. Files changed

| Area | Paths |
|------|--------|
| Schema | `prisma/schema.prisma` |
| Outbound webhooks | `src/lib/voice-v3/webhooks/outbound.ts`, `events.ts`, `delivery.ts` |
| API | `src/app/api/integrations/webhooks/voice/route.ts` |
| Integrations UI | `src/components/integrations/webhooks-panel.tsx`, `src/app/(app)/integrations/webhooks/page.tsx` |
| Worker | `src/lib/jobs/job-handlers.ts` |
| Legacy routes | `src/app/(app)/voice/agents/**`, `src/app/(app)/voice/inbound-routing/page.tsx`, `src/app/(app)/voice/call-handling/page.tsx` |
| Nav / discoverability | `src/lib/products/ai-after-hours-nav.ts`, `mctb-nav.ts`, `mctb-bundled-receptionist-paths.ts`, `src/lib/solution-dashboard.ts` |
| Stale claims | `src/lib/outcomes/registry.ts` |
| Tests | `scripts/test-voice-final-remediation.ts` |

## 3. Outbound webhook architecture after remediation

```
Voice post-call (emitVoiceV3PostCallWebhooks)
  → prisma.Webhook (workspace, active, subscribed events)
  → queueVoiceWebhookDelivery
  → enqueueJob(voice_webhook_deliver)
  → job-handlers → executeVoiceWebhookDeliverJob
  → signed HTTPS POST + voice_webhook_deliveries row
  → retries on failure (existing backoff table)
```

Customer configuration uses `POST/GET /api/integrations/webhooks/voice` and persists rows in `Webhook`.

## 4. Incoming vs outbound separation

| Direction | Model | UI section |
|-----------|--------|------------|
| External → Transovo | `IntegrationWebhookEndpoint` | Incoming webhooks (unchanged create flow via `/api/integrations/webhooks`) |
| Transovo Voice → customer | `Webhook` | Outbound webhooks (new editor) |

## 5. Voice event catalog

Canonical constants: `src/lib/voice-v3/webhooks/events.ts` (`VOICE_WEBHOOK_EVENT_TYPES`). Subscription UI excludes `voice.test`; test delivery uses `voice.test` on the real delivery path.

## 6. CRUD/API behavior

- **create**: `url`, `label`, `events[]`, optional `active`; returns endpoint + one-time `signingSecret`
- **update**: `webhookId`, optional `url`, `label`, `events`, `active`
- **delete**: `webhookId`
- **test**: `webhookId` queues `voice.test` through `queueVoiceWebhookDelivery`

## 7. Workspace isolation/security

All outbound routes use `requireSession` and `resolveWorkspaceId`. Mutations scope `webhook.findFirst({ workspaceId })`. URLs pass `assertSafeWebhookUrl` (HTTPS in production, SSRF blocks).

## 8. Delivery job wiring

Added `case "voice_webhook_deliver"` in `src/lib/jobs/job-handlers.ts` calling `executeVoiceWebhookDeliverJob`.

## 9. Retry behavior

Unchanged in `delivery.ts`: attempts increment; backoff seconds `[0, 60, 300, 1800, 7200]`; failed deliveries re-enqueue until max attempts.

## 10. Signature behavior

Headers on delivery:

- `Content-Type: application/json`
- `X-Transovo-Event-Id`
- `X-Transovo-Event-Type`
- `X-Transovo-Timestamp` (unix seconds)
- `X-Transovo-Signature` — HMAC-SHA256 over `{timestamp}.{rawBody}`

Secret resolution order: `metadata.signingSecretEnc` (decrypt) → legacy `metadata.signingSecret` → `INTEGRATION_SECRET_KEY` → dev-only fallback.

## 11. Delivery history/test behavior

`voice_webhook_deliveries` rows updated per attempt (status, httpStatus, errorMessage, responseExcerpt). UI shows Active/Paused per endpoint; no expanded observability UI in this pass. **Send test** queues real delivery for `voice.test`.

## 12. Call Handling discoverability

`/voice/call-handling` compatibility page explains certified V3 path; legacy inbound-routing redirects here. Full Call Handling dependency row on the six-page editor remains on the overview-impl branch.

## 13. Legacy `/voice/agents/*` disposition

Customer pages redirect:

| Route | Target |
|-------|--------|
| `/voice/agents`, `/voice/agents/new`, `…/about`, `…/capabilities`, `…/advanced`, `…/voice-test` | `/voice/receptionist` |
| `…/integrations` | `/integrations` |

AI After Hours nav uses Receptionist instead of Agents subtree.

## 14. `/voice/inbound-routing` disposition

Server redirect to `/voice/call-handling`. Routing APIs/models not deleted.

## 15. Digest stale-claim cleanup

Removed “Morning digest summary” from notifications outcome bullets in `src/lib/outcomes/registry.ts`. No scheduler or Call Handling toggle added.

## 16. Tests run/results

```bash
npx tsx scripts/test-voice-final-remediation.ts
# test-voice-final-remediation: PASS
```

## 17. Runtime/compiler files changed

None in LiveKit, GPT-Live, booking executors, transfer executors, or post-call summary derivation.

## 18. Schema changes

`Webhook` extended to match deployed migration (`signingSecretPrefix`, `signingSecretHash`, `metadata`, timestamps). Added `VoiceWebhookDelivery` mapped to `voice_webhook_deliveries`. **Justification:** delivery code and migration already assumed these structures; Prisma had drifted.

## 19. Deferred items

- Voice morning digest product
- Common-reasons aggregate analytics
- Generic post-call customer follow-up SMS
- Recording PSTN certification (owner)
- Full six-page Call Handling webhook dependency row (overview-impl merge)
- Bulk outcomes registry `launchHref` sweep beyond key dashboard links

## 20. Owner certification remaining

- PSTN: recording, transfers, spam headers, notifications, calendar paths
- Merged-build browser walkthrough across six canonical Voice pages
- Live outbound webhook delivery to a customer endpoint in staging/production

---

**VOICE FINAL REMEDIATION COMPLETE — OWNER CERTIFICATION REMAINS**
