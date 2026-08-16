# Python LiveKit Voice Runtime — Migration Map

**Status:** Phase 1–3 implemented (Python worker, TaskGroup intake, backend bridge, spawn flag).  
**Audit:** See `docs/voice-runtime-python-audit-pr206.md` — single-ownership + HTTP bridge review before smoke deploy.  
**Default worker:** `VOICE_RUNTIME_IMPL=python`  
**Rollback:** `VOICE_RUNTIME_IMPL=typescript`

This is **not** “the rewrite is finished.” Next milestone: one boring, repeatable real booking call through Python (5–10 calls).

---

## Architecture

```
SIP → Python AgentSession → Amy (OpenAI Realtime marin)
         → start_booking → BookingIntakeTaskGroup (LiveKit Beta tasks)
         → Transovo internal API (persist, availability, commit)
         → transaction-first booking writes (TypeScript/Prisma)
```

| Layer | Owner |
|-------|--------|
| AgentSession, Tasks, TaskGroup | LiveKit Python SDK |
| GetName/Phone/Email/Address tasks | LiveKit `beta.workflows` (via adapters) |
| Dynamic manifest fields | `DynamicFieldTask` |
| Multi-field extraction | TypeScript `extractDeterministicFieldsFromUtterance` via API |
| Validation, Calendly, receipts | TypeScript backend bridge |
| UI, billing, CRM, BullMQ | Existing Next.js app |

---

## Directory tree

```
voice-runtime-python/
  pyproject.toml
  transovo_voice/
    main.py                 # AgentServer entry, cli.run_app
    userdata.py             # SessionUserData + workflow enum
    telemetry.py            # Structured JSON logs
    session/
      inbound.py            # Bootstrap + AgentSession start
      realtime_config.py    # OpenAI Realtime marin + semantic_vad
    agent/
      amy.py                # Single Amy agent factory
      tools.py              # start_booking, select_slot, confirm_booking, FAQ
    workflows/
      booking_intake.py     # TaskGroup from manifest
    tasks/
      protocols.py          # Field type helpers
      adapters.py           # Transovo* → LiveKit Beta tasks
      dynamic_field_task.py # Arbitrary manifest fields
    integrations/
      backend_client.py     # HTTP → /api/internal/voice-runtime
  tests/
    test_field_mapping.py
```

---

## TypeScript voice-runtime file classification

| Category | Examples | Fate |
|----------|----------|------|
| **LiveKit replaces** | `collection-turn-processor`, `collection-fragment-buffer`, `phone-number-collection-task`, `collection-realtime-control` | **Delete after Python parity** (Phase 7) |
| **Backend bridge** | `calendly-calendar`, `booking-provider-write`, `runtime-schedule-appointment` | **Remain TS** — called via internal API |
| **Python replaces** | `main.ts`, `inbound-entry`, `generic-receptionist-agent`, `workflow-orchestrator` collection path | **Replaced by Python** for generic receptionist |
| **Keep TS until migrated** | `real-estate-frontdesk-agent`, `outbound/entry` | Use `VOICE_RUNTIME_IMPL=typescript` |
| **Never port** | `awaitingFieldAnswer`, `forceRecordCurrentField`, transcript dedupe | **Deleted** with TS runtime |

---

## Internal API (`POST /api/internal/voice-runtime`)

Auth: `Authorization: Bearer $VOICE_RUNTIME_INTERNAL_SECRET`

| Action | Purpose |
|--------|---------|
| `bootstrap_inbound` | Resolve call, load published config |
| `persist_intake_fields` | Validate + store fields on `voiceCall.metadata` |
| `extract_fields` | Opportunistic multi-field extraction |
| `get_availability` | Calendly slot list |
| `commit_booking` | Transaction-first provider write |
| `business_answer` | Knowledge/RAG |
| `emit_event` | Telemetry passthrough |

---

## Environment variables (Python worker)

| Variable | Purpose |
|----------|---------|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Worker registration |
| `LIVEKIT_AGENT_NAME` | Dispatch name |
| `OPENAI_API_KEY` | Realtime |
| `VOICE_RUNTIME_INTERNAL_URL` / `PORT` | Loopback internal API base (defaults `http://127.0.0.1:$PORT`) |
| `VOICE_RUNTIME_INTERNAL_SECRET` | API auth |
| `VOICE_REALTIME_MODEL`, `VOICE_REALTIME_VOICE` | Default gpt-realtime-2 + marin |
| `VOICE_REALTIME_VAD_EAGERNESS` | semantic_vad (default medium) |
| `VOICE_RUNTIME_IMPL` | Set on **Node spawn** only (python \| typescript) |

---

## Deployment (single container)

1. `nixpacks` / `coolify-install-with-heartbeat.sh` creates `voice-runtime-python/.venv` and installs `livekit-agents[openai]` + editable `transovo_voice`.
2. Next.js `instrumentation.ts` spawns one child: Python **or** TypeScript via `VOICE_RUNTIME_IMPL`.
3. Logs: `[voice-python]` or `[voice-runtime]`.
4. Real-estate / outbound: set `VOICE_RUNTIME_IMPL=typescript` until Phase 4.

**Estimated image delta:** ~80–150 MB (Python venv + livekit-agents openai extra). No second container.

---

## Migration phases

| Phase | Status |
|-------|--------|
| 1 Python worker + adapters | ✅ |
| 2 Booking intake TaskGroup | ✅ |
| 3 Availability + commit via API | ✅ |
| 4 Message / transfer / cancel / reschedule | 🔲 |
| 5 Smoke + edge tests on production | 🔲 |
| 6 Python default (`VOICE_RUNTIME_IMPL=python`) | ✅ default in spawn |
| 7 Delete obsolete TS voice-runtime | 🔲 after parity |

---

## Rollback

```bash
VOICE_RUNTIME_IMPL=typescript
```

Redeploy. No schema changes required.

---

## Test matrix

| Test | Command |
|------|---------|
| Bridge auth + impl flag | `npx tsx scripts/test-python-voice-runtime-bridge.ts` |
| Field mapping / volunteer skip | `cd voice-runtime-python && .venv/bin/pytest tests/` |
| Collection (legacy TS) | `npx tsx scripts/test-collection-field-turns.ts` |

Live call smoke: verify `task_group_started`, `field_completed`, `booking_write_succeeded` in logs with `[voice-python]` prefix.

---

## What we did NOT port (by design)

- `record_current_field` / `forceRecordCurrentFieldTurn`
- `collectionFieldPhase` / `awaitingFieldAnswer`
- Per-turn `create_response` toggling
- Custom phone/email/address fragment buffers
- Child booking agent / chat context resync hacks

LiveKit Tasks own structured collection; Transovo owns business truth via HTTP.
