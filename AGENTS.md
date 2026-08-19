<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud dev environment

The app's runtime data layer is Supabase (PostgREST), so local dev runs the **Supabase CLI stack in nested Docker** — no external secrets needed. Config lives under `.cursor/` (`install.sh`, `start.sh`, `boot.sh`, `lib.sh`) and `supabase/config.toml`.

- Bring it up manually: `bash .cursor/start.sh` (starts Docker + Supabase, writes `.env`, runs `db:push`, seeds), then `npm run dev`. `boot.sh` does both and is the environment `start` command.
- Seeded login: `alex@harborhome.co` / `demo1234`.
- Nested-Docker gotcha: inter-container traffic (PostgREST→Postgres) needs `net.bridge.bridge-nf-call-iptables=0` before the stack starts; `start.sh` handles it. Docker uses the `fuse-overlayfs` storage driver.
- `supabase/config.toml` runs a slimmed stack (db + API/PostgREST only) with `auto_expose_new_tables=true` (Prisma-created tables must be reachable via PostgREST) and Supabase auto-migrations disabled (the Prisma schema is the source of truth).

## Caller Amy production verification

Do **not** mark Caller Amy overall PASS until all five gates pass on a real phone call:

1. **CATALOG** — `node scripts/audit-caller-amy-published-tools.mjs` (live Telnyx assistant has only the 7 model-facing webhooks + native hangup/transfer).
2. **TOOL TRANSPORT** — `record_current_field` or `continue_workflow` must hit `/api/telnyx/voice/tools` (check `voiceToolExecution` rows and `providerWebhookEvent` with `eventType=voice.tool_webhook.ingress`).
3. **WORKFLOW** — collected fields advance state (no direct `calendar_availability` during collection).
4. **BOOKING** — one appointment via runtime (`get_booking_verification`).
5. **CALL DATA** — one canonical `voiceCall` from conversation start with ANI, duration, transcript, and tool traces.

Report: `node scripts/caller-amy-five-gate-report.mjs` (set `CALL_ID` after a smoke call).

Telnyx-side tool audit: `node scripts/audit-telnyx-call-tool-transport.mjs` (set `CONVERSATION_ID` or `CALL_CONTROL_ID`, `CALL_ID`, `BASE_URL`).

PR #100 (`continue_workflow` timeout/fillers) does **not** fix zero tool transport — do not merge it until TOOL TRANSPORT passes.

**Known TeXML-direct failure mode:** Telnyx may invoke `get_runtime_context` before a `VoiceCall` row exists (only hangup status_callback created the call). Fix: `ensureVoiceCallForToolWebhook` on `/api/telnyx/voice/tools` + early TeXML lifecycle — see PR #102.

## Caller Amy pre-production suite (run before deploy)

```bash
npm run test:caller-amy-preprod
# or full orchestration + preprod:
npm run test:caller-amy
```

Exercises real webhook ingress, call lifecycle, field collection, transcript pipeline, concurrency, and tenant isolation against `DATABASE_URL` (isolated tenants). The script prints the same five-gate report; **overall PASS requires 5/5** before production smoke.

**Development workflow:** unit contracts → `npm run test:caller-amy-preprod` → provider integration (Calendly test calendar) → adversarial/failure tests → staging assistant → **one** real production smoke call.

**REQUIRES LIVE TELNYX ACCEPTANCE TEST:** conversational LLM/audio session, progressive filler timing under real latency, and final end-to-end audio — cannot be fully simulated via HTTP webhooks alone.

## AI Receptionist (generic LiveKit product agent)

**Do not** extend the real-estate Front Desk runtime as the default SaaS receptionist. Build a **configuration-driven generic agent** on the shared LiveKit worker.

**Read first:** `docs/ai-receptionist-runtime-implementation.md` — audit, compile pipeline, factory model, phased plan, acceptance tests.

**Architecture:** `UI draft → compileReceptionistConfig() → VoiceAgentVersion → createGenericReceptionistAgent() → AgentSession`

**UI routes:** `/voice/agents` (list), `[id]/about`, `[id]/capabilities`, `[id]/advanced`, `[id]/voice-test`

**Reuse:** `voice-runtime/src/inbound-session-pipeline.ts`, `booking-tools.ts`, `transfer-tool.ts`, `agent-service.ts` publish/versioning, telephony provisioning.

**LiveKit examples (reference):** `/agent/repos/agents/examples/survey/`, `hotel_receptionist/`, `warm-transfer/`, SDK `beta/workflows/task_group.py`.
