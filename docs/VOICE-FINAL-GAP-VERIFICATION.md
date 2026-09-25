# Voice — Final Gap Verification (pre-remediation)

**Date:** 2026-09-25  
**Mode:** READ ONLY — no implementation  
**Builds on:** `docs/VOICE-FINAL-CROSS-PAGE-FEATURE-CERTIFICATION.md` (PR #517)

**Evidence branches:** Voice six-page UI primarily on `origin/cursor/voice-overview-impl-2304`; nav on `cursor/voice-nav-reconciliation-2304` (#516). Runtime/libs on `master`.

---

## 1. Corrected executive verdict

The cross-page certification was **directionally correct**: the major Voice V3 after-hours capability set **is exposed** in the new IA (especially on the overview-impl branch). **Feature-exposure P1s reduce to one primary gap:**

- **Outbound Voice webhook self-service** (configuration/delivery chain incomplete for customers).

**Recording is not a UI exposure P1.** Config, runtime path, persistence, and Call Detail player exist; remaining work is **owner PSTN E2E certification**.

**Voice “morning/daily digest”** is **not** a missing settings row on Call Handling. Repository trace shows **no Voice call-aggregation digest** was implemented end-to-end. What exists is:

1. **Per-event after-hours notifications** (immediate email/SMS on Call Handling) — fully implemented.  
2. **Generic workspace notification digest** (`processNotificationDigests`) — unrelated to `VoiceCall` rollup.

Classification: **DIGEST-D** (new product capability if desired; not UI remediation).

**Secondary (P2):** legacy `/voice/agents/*` IA competition; `/voice/inbound-routing` likely **inactive** for Voice V3 PSTN (dangerous if left as faux controls).

---

## 2. Recording reclassification

| Item | Finding |
|------|---------|
| `RecordingConfigCard` | `/voice/call-handling` (impl branch) |
| Save path | `appointment-receptionist` API → compiled agent / recording flags |
| Runtime | `maybeStartVoiceV3TelnyxRecording`, ingest in `call-recording-ingest.ts` |
| Result UI | `WaveformRecordingPlayer` on `/voice/calls/[id]` |
| Processing states | `recordingPipelineState` in `customer-activity-feed.ts` |

**Classification:** `IMPLEMENTED — OWNER PSTN CERTIFICATION REQUIRED`  
**Severity:** Owner cert checklist (not P1 UI exposure).  
**Action:** PSTN proof only; no software change in remediation pass unless cert finds a broken path.

---

## 3. Digest — repository search results

Searches across `src/`, `scripts/`, `prisma/`, `docs/` for: daily/morning/after-hours digest, call digest, voice digest, post-call digest, `processNotificationDigests`, `digestFrequency`, VoiceCall aggregation emails, etc.

### Hits that matter

| Location | What it is |
|----------|------------|
| `src/lib/notifications/digest.ts` | **Generic** email of unread `inAppNotification` rows (max 25), per user `WorkspaceNotificationPrefs.digestFrequency` |
| `src/lib/jobs/job-handlers.ts` | Cron enqueues `notification_digest` → `processNotificationDigests("daily")` |
| `src/components/settings/notifications-settings-form.tsx` | UI: “Email digest” daily/weekly/off |
| `src/lib/voice-v3/notifications/*` | **Immediate** per-call email/SMS (Brevo / `sendQuickSms`), not periodic rollup |
| `src/lib/outcomes/registry.ts` | Marketing/outcomes bullet: “Morning digest summary” under after-hours **Notifications** — **not wired to code** |
| `docs/VOICE-V3-GAP-RECONCILIATION-PLAN.md` | Groups “digest email” with post-call webhooks as **Deferred** optional follow-up |
| `docs/FEATURE_INVENTORY.md` | `notification_digest` job = workspace partial |
| `docs/VOICE-V3-AFTER-HOURS-FEATURE-AUDIT-2026-09-25.md` | Already noted no Voice-specific morning digest |

### No hits found

- No module aggregating `VoiceCall` rows into a scheduled email/SMS digest.  
- No `voice-v3` digest scheduler, template, or recipient config.  
- No Call Handling / wizard control for “morning call summary.”  
- Voice V3 notifications **do not** write `inAppNotification` (grep clean) — so even the generic digest would **not** include Voice call summaries unless some other subsystem creates in-app notifications for calls (not found on Voice path).

### Contradiction resolution (earlier inventory vs this audit)

Earlier materials **conflated three different things**:

1. **Immediate after-hours notifications** (implemented; Call Handling editor).  
2. **Generic workspace notification digest** (implemented; Settings).  
3. **Voice call-summary morning digest** (listed in outcomes/registry and gap plan as **deferred / aspirational** — **never built** as VoiceCall aggregation).

The line in `VOICE-V3-GAP-RECONCILIATION-PLAN.md` (“Post-call webhooks / knowledge gaps / **digest email** | Deferred”) describes a **planned** follow-up bucket, not a shipped Voice digest.

---

## 4. Digest — execution trace (what actually runs)

### Generic `notification_digest` job

```
Cron (job-handlers maintenance tick)
  → jobType: notification_digest, payload: { frequency: "daily" }
  → processNotificationDigests("daily")
  → WorkspaceNotificationPrefs where digestFrequency = "daily"
  → inAppNotification (unread, last 24h, per user)
  → sendTransactionalEmail (Brevo) — list of notification titles/bodies
```

**Not involved:** `VoiceCall`, call outcomes, transcripts, after-hours window, Voice config.

### Voice immediate notifications (separate product behavior)

```
Post-call / transfer / appointment hooks
  → loadVoiceV3NotificationsConfigForCall (compiled from wizard / Call Handling state)
  → dispatchVoiceV3Notification
  → Brevo email and/or sendQuickSms per event (callback, emergency, transfer.*, appointment.*, call.completed)
```

**Schedule:** event-driven, not morning rollup.  
**Recipients:** `afterHoursNotificationRecipients` on Call Handling.  
**Timezone:** not used for scheduling (immediate).  
**UI:** `AfterHoursNotificationsEditor` on `/voice/call-handling`.

---

## 5. Digest — answers A–J

| Q | Answer |
|---|--------|
| A. Aggregates Voice calls into periodic email/SMS? | **No** |
| B. Aggregates `VoiceCall` records? | **No** |
| C. Aggregates in-app notifications from Voice? | **No** — Voice path does not populate `inAppNotification` for digest |
| D. Call-specific fields in digest? | **N/A** — no Voice digest |
| E. Morning/daily scheduled? | Generic digest: daily job; **not** Voice-specific |
| F. Timezone for delivery? | **Not explicit** — cron UTC maintenance tick; email says “daily digest” |
| G. Recipients? | Generic: per workspace **user** prefs; Voice immediate: Call Handling recipients |
| H. Customer enable/disable? | Generic: Settings; Voice immediate: per-event toggles on Call Handling |
| I. Permanent customer UI for Voice call digest? | **No** |
| J. Orphaned prior UI? | **No** orphaned Voice digest UI found — only outcomes registry bullet |

**Classification: DIGEST-D — GENERIC NOTIFICATION DIGEST ONLY**

A Voice morning/after-hours **call-summary digest** is a **new product capability** (scheduler + aggregation + template + config), not moving a missing toggle onto Call Handling.

---

## 6. Outbound Voice webhooks — execution trace

### Event types (repository constants only)

From `src/lib/voice-v3/webhooks/events.ts`:

- `voice.call.completed`
- `voice.callback.requested`
- `voice.message.received`
- `voice.appointment.booked`
- `voice.appointment.rescheduled`
- `voice.appointment.cancelled`
- `voice.transfer.connected`
- `voice.transfer.failed`
- `voice.emergency.escalated`
- `voice.test`

(Note: audit prose “transfer.completed” is **not** a constant — use `voice.transfer.connected`.)

### Emit path

```
runVoiceV3CallHistoryPostProcess / post-call side effects
  → emitVoiceV3PostCallWebhooks({ callId, workspaceId, summaryText })
  → prisma.webhook.findMany({ workspaceId, active: true })
  → filter hook.events includes mapped event OR voice.call.completed OR *
  → queueVoiceWebhookDelivery(...)
  → enqueueJob jobType: voice_webhook_deliver (queue voice-calls)
  → executeVoiceWebhookDeliverJob (in delivery.ts)
      → POST hook.url with HMAC headers (X-Transovo-Signature, etc.)
      → voice_webhook_deliveries row updates, retries with backoff
```

### Storage model

| Concept | Model / table | Purpose |
|---------|---------------|---------|
| Outbound URL subscriptions | `Webhook` (`url`, `events[]`, `active`) | Voice post-call emitter reads this |
| Inbound automation | `IntegrationWebhookEndpoint` (+ token) | Zapier/campaign enroll — **different** |
| Delivery log | `voice_webhook_deliveries` (migration SQL) | Per-event delivery attempts |

Prisma `Webhook` model in `schema.prisma` is minimal (no `metadata` field); `delivery.ts` references `webhook.metadata.signingSecret` — **schema/code drift risk** (signing falls back to env `INTEGRATION_SECRET_KEY`).

### Gaps in chain (read-only findings)

1. **No customer API/UI creates `Webhook` rows** — grep shows only `emit-post-call-webhooks.ts` reads `prisma.webhook`; appointments use separate `appointmentWebhookEndpoint` with full CRUD in `service-booking/webhooks.ts`.  
2. **`voice_webhook_deliver` is not registered in `handleJob` switch** (`job-handlers.ts`) — jobs are enqueued but **no handler case** invokes `executeVoiceWebhookDeliverJob`. (Delivery function exists but may never run unless another worker registers it — **not found**.)  
3. **`VoiceWebhookDelivery` Prisma model** — migration exists; **not present in current `schema.prisma` snippet** (compat layer may still map — verify at deploy).  
4. **Test webhook** — `voice.test` in constants; **no UI test button** found.  
5. **Delivery history UI** — appointments have delivery rows; Voice deliveries **no customer UI** found.  
6. **Secret rotation** — pattern exists for appointments; **not exposed for `Webhook`**.

### Incoming vs outbound (do not merge UI)

- **IntegrationWebhookEndpoint:** create via `/integrations/webhooks` panel → `createIntegrationWebhook` → incoming URL token for automations.  
- **Webhook (outbound):** intended for Voice event POST to customer URL — **same word “webhook”, different tables and semantics**.

---

## 7. Existing webhook UI architecture

| Surface | What it manages |
|---------|-----------------|
| `/integrations/webhooks` | Lists integration incoming endpoints + **displays** existing `Webhook` outbound rows if any |
| `WebhooksPanel` create form | **Only** incoming automation endpoints |
| `/integrations` home | Directory link to Webhooks |
| Appointments | Separate `/api/appointments/service-booking/webhooks` — **reference pattern** for outbound CRUD |

Voice discoverability today: **Integrations directory** only; no Call Handling row; Receptionist links **Integrations** for calendars, not webhooks.

---

## 8. Minimum webhook remediation (recommendation only — do not implement here)

Smallest legitimate fix aligned with backend:

1. Add **outbound subscription CRUD** (mirror appointments pattern) against `Webhook` + `VOICE_WEBHOOK_EVENT_TYPES`, on `/integrations/webhooks` — separate section from incoming automation.  
2. Wire **`voice_webhook_deliver` in `handleJob`** → `executeVoiceWebhookDeliverJob`.  
3. Align **Prisma schema** with `voice_webhook_deliveries` + optional `Webhook.metadata` for signing secrets.  
4. Optional: **Call Handling dependency row** — “Outbound webhooks” status + link “Manage in Integrations →” (no second editor).  
5. Optional: delivery log read-only table (if `voice_webhook_deliveries` query exists).

Do **not** attach outbound event pickers to the incoming Zapier endpoint creator.

---

## 9. `/voice/agents/*` route trace

| Route | Role |
|-------|------|
| `/voice/agents` | Legacy agent list |
| `/voice/agents/new`, `/voice/agents/[id]/about|capabilities|integrations|advanced|voice-test` | Legacy multi-page agent builder |
| APIs | `/api/voice/agents/*` still used for agent records, tests, publish |

**Still links here from:** `voice-nav.ts` (VoiceSubNav “Agents”), `outcomes/registry.ts` (many `launchHref`), `solutions-nav.ts`, `solution-dashboard.ts`, wizard post-save URLs, `product-shell` path resolution (`/voice/agents` → `ai_after_hours` shell).

**vs `/voice/receptionist`:** Permanent six-page editor (impl) covers identity, goals, intake, booking, test/publish — **functional superset for customers**; agents routes are **parallel legacy shell**.

**APIs:** Agent id/version concepts remain valid — redirect pages only, **do not delete** backend.

**Recommendation:** Compatibility redirects (e.g. `/voice/agents` → `/voice/receptionist`, `/voice/agents/[id]/*` → receptionist or wizard) + remove Agents from **global** VoiceSubNav if contextual only. **P2** navigation cleanup.

---

## 10. `/voice/inbound-routing` runtime-consumer trace

| Layer | Uses `voiceRoutingRule`? |
|-------|---------------------------|
| `/voice/inbound-routing` UI | CRUD via `/api/voice/routing` |
| `sync-routing.ts` (wizard save) | Writes wizard-managed rules |
| `lib/voice/routing.ts` | `simulateRouting` — **only** imported by `/api/voice/routing/simulate` |
| Voice V3 PSTN entry `startAppointmentReceptionistVoiceV3OnCall` | **No** |
| `agent-routing.ts` / Telnyx ingress | Resolves agent via phone + canonical workspace agent — **No rule table evaluation** |

**Answer:** Editing `/voice/inbound-routing` in the UI **does not** appear to change Voice V3 production call handling on the certified PSTN path. Rules may matter for **legacy/simulation/smart-routing** contexts only.

**Classification:** **LEGACY/INACTIVE UI** for Voice V3 (risk: visible controls with no effect).

**Recommendation:** Hide from primary nav (already done); link from Call Handling as “Advanced routing (legacy)” only if product confirms smart-routing overlap — or redirect with warning. **Do not delete** until smart-routing/product audit says safe.

---

## 11. Corrected gap table

| ID | Capability | Runtime exists? | Customer UI? | Result UI? | Owner cert only? | Classification | Severity | Required action |
|----|------------|-------------------|--------------|------------|------------------|----------------|----------|-----------------|
| VOICE-GAP-001 | Outbound Voice webhooks | Partial (emit + delivery code; job handler gap) | No create/configure | N/A | No | **F** (+ backend wiring) | **P1** | Outbound CRUD on Integrations + job handler + schema alignment |
| VOICE-GAP-002 | Voice morning/daily **call** digest | No | No | N/A | No | **DIGEST-D** (new capability) | **P3** (product) | Separate product/runtime design — **not** UI cleanup |
| VOICE-GAP-003 | Generic notification digest | Yes | Yes (`/settings`) | Email | No | **E** shared | P3 | Clarify copy ≠ Voice call digest |
| VOICE-GAP-004 | Immediate after-hours notifications | Yes | Yes (Call Handling) | Email/SMS | PSTN for content | **A** | — | Owner cert |
| VOICE-GAP-005 | Recording | Yes | Yes | Yes (player) | **Yes (PSTN E2E)** | **IMPLEMENTED — OWNER PSTN CERT** | Cert | Owner PSTN only |
| VOICE-GAP-006 | `/voice/agents/*` | Yes (legacy UI) | Yes (legacy) | — | No | **H** | **P2** | Redirects + nav cleanup |
| VOICE-GAP-007 | `/voice/inbound-routing` | DB yes; V3 consume **no** | Yes | simulate only | No | **LEGACY/INACTIVE** | **P2** | Hide/redirect; document |
| VOICE-GAP-008 | Common reasons aggregate | Partial per-call only | Detail only | No analytics | No | **J** intentional | P3 | None for launch |
| VOICE-GAP-009 | Generic post-call customer SMS | Optional recovery SMS path | No generic product | — | No | **J** future | P3 | Do not conflate with MCTB/booking SMS |

---

## 12. Corrected P0 / P1 / P2 / P3

| Severity | Count | Items |
|----------|-------|-------|
| **P0** | 0 | — (on intended merge baseline) |
| **P1** | **1** | Outbound Voice webhook self-service + delivery job wiring |
| **P2** | 2 | Legacy `/voice/agents/*`; inactive `/voice/inbound-routing` exposure |
| **P3** | 3 | Voice call-summary digest (new product); common reasons aggregate; generic follow-up SMS |

**Removed from P1:** recording (moved to owner cert); Voice digest (reclassified to P3 new capability).

---

## 13. Exact remediation scope (next pass)

### Tiny remediation pass (approved direction)

- Outbound Voice webhooks UI + API (Integrations) + `voice_webhook_deliver` handler + schema check.  
- Optional Call Handling link row to Integrations.  
- Legacy route redirects (`/voice/agents/*`, consider inbound-routing).

### Explicitly out of scope for “tiny” pass

- **Voice call-summary digest** — requires new aggregation job, template, recipients, timezone policy.  
- Recording code changes.  
- Voice V3 / LiveKit / transfer runtime.  
- Six-page redesign.

---

## 14. Owner-only certification items

- PSTN recording ingest → playback on Call Detail  
- Transfer direct/warm/waterfall  
- Google live book (if enabled)  
- Spam SCREEN on real carrier headers  
- End-to-end immediate notification email/SMS on real calls  
- Browser walkthrough of six-page IA on merged build  

---

## 15. Update to prior certification doc

`docs/VOICE-FINAL-CROSS-PAGE-FEATURE-CERTIFICATION.md` should be read with these corrections:

- VOICE-EXP-002 → **DIGEST-D / P3**, not UI P1.  
- VOICE-EXP-003 → **owner cert**, not UI P1.  
- Webhooks may need **runtime** fix (job handler), not UI alone.

---

VOICE FINAL GAP VERIFICATION COMPLETE — READY FOR REMEDIATION DECISION
