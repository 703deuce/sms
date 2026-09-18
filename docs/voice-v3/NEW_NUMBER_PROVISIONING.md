# Voice V3 — New number provisioning (GPT-Live-1 + GPT-6 Astra direct SIP)

**Status:** Frozen recipe from the first **known-good** PSTN line **`+1 571-749-1060`** (certified March 2026).  
**Do not re-run setup against that number** when updating this doc — inventory only.

**Machine-readable config:** `src/lib/voice-v3/provisioning/`  
**Runtime (unchanged paths):** `src/lib/voice-v3-basic/`, `src/lib/voice-v3/`

---

## Architecture (what actually works)

```
PSTN caller
  → Telnyx DID (+E.164)
  → Telnyx **Call Control Application** (webhook)
  → answer + **transfer** (TLS/SRTP) to OpenAI SIP
  → OpenAI emits **live.transport.incoming** webhook
  → Transovo **POST /api/openai/live/incoming**
  → **live.sessions.accept** (gpt-live-1 + delegation → gpt-6-astra)
  → GPT-Live speaks (sideband greeting + conversation)
```

**Not used for Voice V3 Basic PSTN:**

- Telnyx **FQDN connection** aimed at `sip.api.openai.com` (PSTN “unavailable” / mis-route)
- TeXML / MCTB ingress on the same line
- Telnyx media WebSocket bridge
- LiveKit voice worker
- `<Say>` / prerecorded Telnyx greeting (GPT-Live is the only voice)

---

## Known-good reference (571-749-1060)

| Item | Value |
|------|--------|
| E.164 | `+15717491060` |
| Telnyx connection type | **Call Control Application** |
| Call Control app name | `Transovo Voice V3 Basic OpenAI SIP` |
| Call Control app ID | `3051313082853754271` |
| Outbound Voice Profile ID (on app) | `3015630367940937537` |
| Failed legacy FQDN connection ID | `3051306325762901074` (do not use) |
| OpenAI SIP host | `sip.api.openai.com` |
| OpenAI SIP port | `5061` |
| OpenAI SIP transport | `TLS` |
| SIP URI format | `sip:{OPENAI_PROJECT_ID}@sip.api.openai.com;transport=tls` |
| Telnyx transfer `sip_transport_protocol` | `TLS` |
| Telnyx transfer `media_encryption` | `SRTP` |
| Telnyx transfer `timeout_secs` | `45` |
| OpenAI webhook event (subscribe) | **`live.transport.incoming`** |
| OpenAI webhook URL | `{APP_URL}/api/openai/live/incoming` (production: transovo.ai) |
| Telnyx webhook URL | `{APP_URL}/api/telnyx/voice/v3-basic` |
| Telnyx webhook API version | `2` |
| Live frontend model | **`gpt-live-1`** |
| Delegated backend model | **`gpt-6-astra`** |
| Live voice | `marin` |

Setup script (reference only — do not run on certified line unless intentionally reprovisioning):

`NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/setup-voice-v3-basic-5717491060.ts`

Diagnostics (read-only): `npx tsx scripts/diag-voice-v3-basic-telnyx.ts`

---

## Telnyx configuration (required)

### 1. Connection type

Use a **Call Control Application**, not an FQDN/SIP connection, for PSTN → programmable answer → transfer.

- **Wrong:** FQDN connection with `sip.api.openai.com` as registration target → callers hear **number unavailable** / fast fail.
- **Right:** Call Control app → `call.initiated` webhook → `answer` → `transfer` to `sip:proj_…@sip.api.openai.com;transport=tls`.

### 2. Phone number assignment

Patch the DID’s `connection_id` to the **Call Control application ID** (not the FQDN connection).

### 3. Outbound Voice Profile (D38)

The Call Control app **must** have an **Outbound Voice Profile** attached before `transfer` to external SIP succeeds.

- **Symptom:** `VOICE_V3_BASIC_TELNYX_WEBHOOK_ERROR` with Telnyx **D38**; transfer never completes.
- **Fix:** `ensureTelnyxOutboundVoiceReady()` in setup script / attach profile `3015630367940937537` (or workspace default).

### 4. Webhook

- URL: `{APP_URL}/api/telnyx/voice/v3-basic`
- Events: at minimum `call.initiated`, `call.hangup`
- Verified with Telnyx signing (`readTelnyxWebhook` in route)

### 5. Transfer payload (runtime)

From `src/lib/voice-v3-basic/telnyx-sip-forward.ts`:

1. `POST /calls/{call_control_id}/actions/answer`
2. `POST /calls/{call_control_id}/actions/transfer` with body:
   - `to`: `sip:{OPENAI_PROJECT_ID}@sip.api.openai.com;transport=tls`
   - `sip_transport_protocol`: `TLS`
   - `media_encryption`: `SRTP`
   - `timeout_secs`: `45`

---

## OpenAI configuration (required)

### 1. Project

- `OPENAI_PROJECT_ID` must be `proj_…` matching the **SIP URI** project segment.
- SIP destination targets this project’s Live SIP ingress.

### 2. Webhook

- **Subscribe:** `live.transport.incoming` (required for documented flow).
- **URL:** `{APP_URL}/api/openai/live/incoming` <!-- pragma: allowlist secret -->
- **Also handled at runtime (do not rely on these alone):** `live.call.incoming`, `realtime.call.incoming` (legacy/alternate emitters).

### 3. Webhook signature verification

- Set **`OPENAI_WEBHOOK_SECRET`** on the **web** container.
- Handler uses `client.webhooks.unwrap(rawBody, headers)` — **must be awaited** (bug without await: `OPENAI_LIVE_WEBHOOK { type: undefined }`, no accept).
- Headers: standard OpenAI webhook signing (`webhook-id`, `webhook-signature`, `webhook-timestamp`).
- If secret missing in dev: JSON parse only (not for production).

### 4. Live session accept

`client.live.sessions.accept(sessionId, { session: { … } })` from `buildBasicLiveSessionAcceptParams()`:

| Field | Value |
|-------|--------|
| `session.type` | `live` |
| `session.model` | `gpt-live-1` |
| `session.audio.output.voice` | `marin` |
| `session.delegation.type` | `responses` |
| `session.delegation.responses.model` | `gpt-6-astra` |
| Tools (initial test) | `[]` |

No `audio.format` on SIP accept (negotiated by SIP).

### 5. Initial greeting (GPT-Live only)

After accept, sideband waits for `session.started`, then:

- `session.commentary.append` (speak exact test greeting)
- `response.create`

Logs: `LIVE_GREETING_REQUESTED`, `LIVE_GREETING_AUDIO_STARTED`, `LIVE_GREETING_AUDIO_COMPLETED`.

---

## Environment variables (web app)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | API client + sideband |
| `OPENAI_PROJECT_ID` | Yes | SIP URI `proj_…` segment |
| `OPENAI_WEBHOOK_SECRET` | Yes (prod) | Webhook unwrap |
| `TELNYX_API_KEY` | Yes | Call Control answer/transfer |
| `APP_URL` | Yes | Webhook URL construction |
| `DATABASE_URL` | Yes | Setup script phone row / future provisioning state |

Optional:

| Variable | Purpose |
|----------|---------|
| `OPENAI_SIP_HOST` | Default `sip.api.openai.com` |
| `VOICE_V3_BASIC_SIDEBAND_OBSERVER` | Set `0` to disable sideband (not recommended in prod) |

Scheduler does **not** need `OPENAI_PROJECT_ID` for this path.

---

## Provisioning lifecycle (customer-facing)

Statuses in `src/lib/voice-v3/provisioning/status.ts`:

| Status | Meaning |
|--------|---------|
| `PENDING` | Number allocated, not configured |
| `CONFIGURING` | Telnyx/OpenAI wiring in progress |
| `VERIFYING` | Automated health + test call |
| `ACTIVE` | Verified — safe to show customer-ready |
| `FAILED` | Blocking error |

**Rule:** Do not mark **ACTIVE** until routing is **proven** (env checks + test call + `VOICE_V3_CALL_SUMMARY` within SLO).

Static env check: `evaluateVoiceV3ProvisioningEnv()` in `health-check.ts`.

---

## Failure modes we hit (real)

| Attempt | Symptom | Cause |
|---------|---------|--------|
| FQDN → OpenAI host | PSTN unavailable | Wrong Telnyx product model for PSTN→OpenAI |
| Call Control, no outbound profile | Ring / silence / hangup; D38 in logs | Transfer blocked |
| Webhook unwrap not awaited | `OPENAI_LIVE_WEBHOOK` undefined type; no accept | Promise treated as event |
| Webhook OK, no accept | Ring until stop | Same as above |
| Transfer OK, ignore `realtime.call.incoming` | No accept | Event type filter too narrow (fixed) |

---

## Troubleshooting matrix

| Symptom | Likely cause | Where to inspect | Exact fix |
|---------|----------------|------------------|-----------|
| **Number unavailable** (fast PSTN fail) | DID on **FQDN** connection or wrong `connection_id` | Telnyx portal / `diag-voice-v3-basic-telnyx.ts` | Move DID to **Call Control app** `3051313082853754271` (or new app with same pattern) |
| **SIP INVITE never reaches OpenAI** | Transfer not executed (D38, answer fail) | `VOICE_V3_BASIC_TELNYX_WEBHOOK_ERROR`, Telnyx CDR | Attach **Outbound Voice Profile**; retry answer+transfer |
| **`live.transport.incoming` never arrives** | OpenAI webhook URL/secret/project mismatch | OpenAI project webhooks UI | Subscribe `live.transport.incoming` → `{APP_URL}/api/openai/live/incoming` |
| **Webhook arrives but session not accepted** | Unwrap not awaited / wrong event type / missing session id | `OPENAI_LIVE_WEBHOOK`, `OPENAI_LIVE_MISSING_SESSION_ID` | Deploy webhook-await fix; verify `OPENAI_LIVE_INCOMING` + `OPENAI_LIVE_CALL_ACCEPTED` |
| **Session accepted but no audio** | Sideband/greeting not attached; SIP media | `LIVE_GREETING_*` logs, OpenAI Live dashboard | Ensure sideband enabled; `session.started` → `response.create` |
| **GPT-Live answers but Astra not configured** | Missing `delegation.responses` on accept | Accept payload in `live-session-config.ts` | `delegation.type: responses`, `model: gpt-6-astra` |
| **Webhook signature verification fails** | Wrong `OPENAI_WEBHOOK_SECRET` | `OPENAI_LIVE_WEBHOOK_UNWRAP_FAILED` | Rotate secret in OpenAI + Coolify web env |

---

## Verification checklist (new number)

1. `OPENAI_PROJECT_ID` matches SIP URI project.
2. OpenAI webhook: `live.transport.incoming` → `/api/openai/live/incoming`.
3. Telnyx DID → Call Control app → `/api/telnyx/voice/v3-basic`.
4. Outbound Voice Profile on Call Control app.
5. Test call: log sequence  
   `VOICE_V3_BASIC_CALL_INITIATED` → `VOICE_V3_BASIC_TELNYX_TRANSFERRED` → `OPENAI_LIVE_INCOMING` → `OPENAI_LIVE_CALL_ACCEPTED` → `LIVE_GREETING_REQUESTED` → `LIVE_GREETING_AUDIO_STARTED`.
6. Hangup: `VOICE_V3_CALL_SUMMARY` with `incoming_to_first_audio_ms` populated.

---

## Related code

| Area | Path |
|------|------|
| Telnyx forward | `src/lib/voice-v3-basic/telnyx-sip-forward.ts` |
| Telnyx webhook | `src/lib/voice-v3-basic/telnyx-webhook-handler.ts` |
| OpenAI webhook | `src/lib/voice-v3-basic/openai-live-webhook.ts` |
| Accept config | `src/lib/voice-v3-basic/live-session-config.ts` |
| Frozen prompts | `src/lib/voice-v3/prompts/` (`buildVoiceV3Prompts`) |
| Provisioning types | `src/lib/voice-v3/provisioning/` |
| Publish / resync route | `routePhoneToVoiceV3BasicCallControl()` — same wiring as setup script; **do not** use generic `TELNYX_CONNECTION_ID` for appointment receptionist DIDs |
| Telemetry | `src/lib/voice-v3/telemetry/call-trace.ts` |
| Greeting | `src/lib/voice-v3/greeting.ts` |
