# Flow Builder certification results (ws_1)

Last full run: **cert-mtbwru9g** — `103 pass / 1 fail / 3 skip` (enrollment-only, **no SMS sent**)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' LIVE_SMS=0 npx tsx scripts/test-flow-builder-full-cert.ts
```

Raw JSON: `artifacts/flow-builder-cert-results.json`

---

## Why you got a burst of SMS texts

The earlier run used `LIVE_SMS=1` (old default) and attached a **Send SMS** step to **every** trigger test (~15+ flows). Several tests **did enroll and partially execute** before the cert harness crashed on a race condition (`AutomationStepExecution` duplicate key). That meant real Telnyx sends fired even though the harness reported FAIL.

**Fixed:** cert now defaults to `LIVE_SMS=0` (enrollment + completion only). To send at most 1–2 smoke texts:

```bash
LIVE_SMS=1 LIVE_SMS_SMOKE=1 npx tsx scripts/test-flow-builder-full-cert.ts
```

(`LIVE_SMS_SMOKE=1` limits live SMS to `manual_enrollment` and `integration_appointment_scheduled` / Calendly only.)

---

## What worked (verified runtime)

### Core triggers — PASS (9/10)

| Block | Result | Notes |
|-------|--------|-------|
| `manual_enrollment` | PASS | Enroll → COMPLETED |
| `customer_added` | PASS | `customer.created` event |
| `tag_added` | PASS | Tag filter match |
| `form_submitted` | PASS | Form slug filter |
| `review_request_created` | PASS | |
| `review_request_sent` | PASS | |
| `review_received` | PASS | |
| `positive_review_received` | PASS | |
| `negative_feedback_received` | PASS | |
| `customer_no_response` | **FAIL** | See fixes below |

### Integration triggers — PASS (all 68 normalized event types)

Enrollment via `dispatchIntegrationAutomationEvent` → `enrollForTrigger` works for every mapped event in `INTEGRATION_EVENT_TO_TRIGGER`, including:

- **Calendly:** `integration_appointment_scheduled`, canceled, rescheduled, starting_soon, completed, no_show, event_type.*
- **Zoho CRM:** contact/lead/company/deal/task/activity/note lifecycle, stage changes, tags, custom fields
- **Forms / marketing:** `integration_form_submitted`, `integration_list_joined`, `integration_tag_added`
- **Commerce / support:** `integration_order_*`, `integration_ticket_*`
- **Consent:** `integration_consent_changed`

**Calendly live path:** Scheduling API book is blocked on free plan (expected). **Webhook fallback** (`appointment.scheduled` normalized event) enrolls and completes — PASS.

### Action blocks — PASS (14/14)

`send_sms`, `send_review_request`, `send_email`, `send_internal_notification`, `add_tag`, `remove_tag`, `update_customer`, `create_task`, `enroll_in_automation`, `start_automation`, `remove_from_automation`, `send_webhook`, `integration_action` (Zoho `note.create`), `wait`, `wait_until_datetime`

*(With `LIVE_SMS=0`, SMS/review actions run in `testMode` — no outbound send.)*

### Logic / condition blocks — PASS (6/6)

All condition block types evaluated via `actions.ts` path.

---

## What failed or was skipped

| Item | Status | Root cause | Fix needed |
|------|--------|------------|------------|
| `customer_no_response` | FAIL | `enrollForTrigger` skips contacts whose `lastReply` is within `withinHours` (default 48h). Test contact on ws_1 has recent activity. | Cert: use `withinHours: 0` in flow config **and** a contact with `lastReply` null or older than window. Product: OK as-is. |
| `calendly_api_book` | SKIP | Calendly Scheduling API requires paid plan on this account. | Use real Calendly webhook on book (works in prod) or upgrade plan for API book smoke. |
| `review_request_clicked` | SKIP | Not yet in cert matrix (needs `review_request.clicked` emitter test). | Add cert emitter. |
| `scheduled_datetime` | SKIP | Time-based cron trigger; not fired in harness. | Add scheduled tick test or document as cron-only. |
| Voice / call triggers | N/A | Hidden unless `AUTOMATION_VOICE_ENABLED=1`. | Separate voice cert matrix. |

---

## Harness bugs fixed (this session)

| Bug | Symptom | Fix |
|-----|---------|-----|
| Race: `scheduleJobDrain` + manual `advanceAutomationExecution` | `AutomationStepExecution` duplicate key; triggers reported FAIL while SMS still sent | Drive execution via `processDueJobs()` only |
| Stale `cert-*` flows on ws_1 | `already_enrolled` / wrong flow matched | Aggressive cleanup at start; delete flow after each test |
| `enrollForTrigger` scanning 50+ stale flows | Integration events didn't enroll | One active cert flow at a time |
| Default `LIVE_SMS=1` on every trigger | SMS spam during cert | Default `LIVE_SMS=0`; optional `LIVE_SMS_SMOKE=1` |
| `prisma-compat` upsert race | Intermittent duplicate key under concurrency | Retry upsert on `P2002` (already in compat layer) |

---

## Connected integrations on ws_1 (cert context)

| Provider | Status | Cert coverage |
|----------|--------|---------------|
| Calendly | connected | Triggers + webhook fallback PASS; API book SKIP (plan) |
| Zoho CRM | connected | All CRM integration triggers + `integration_action` PASS |
| Salesforce | pending_oauth | Not testable until connected |
| Pipedrive | error | Not testable until reconnected |
| Typeform / ActiveCampaign | pending_oauth | Enrollment path works synthetically; no live webhook |

---

## Recommended next steps

1. **Production UI smoke** (one flow, one SMS): Calendly appointment booked → Send SMS — manual test on transovo.ai with `LIVE_SMS_SMOKE=1` or UI only.
2. **Fix `customer_no_response` cert** — test contact without recent `lastReply`.
3. **Add emitters** for `review_request_clicked` and `scheduled_datetime` cron path.
4. **Deploy PR #278** if not on production; re-run Calendly with real webhook after deploy.

---

## Quick re-run (safe — no SMS)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' LIVE_SMS=0 npx tsx scripts/test-flow-builder-full-cert.ts
```
