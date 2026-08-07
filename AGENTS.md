<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Caller Amy production verification

Do **not** mark Caller Amy overall PASS until all five gates pass on a real phone call:

1. **CATALOG** — `node scripts/audit-caller-amy-published-tools.mjs` (live Telnyx assistant has only the 7 model-facing webhooks + native hangup/transfer).
2. **TOOL TRANSPORT** — `record_current_field` or `continue_workflow` must hit `/api/telnyx/voice/tools` (check `voiceToolExecution` rows and `providerWebhookEvent` with `eventType=voice.tool_webhook.ingress`).
3. **WORKFLOW** — collected fields advance state (no direct `calendar_availability` during collection).
4. **BOOKING** — one appointment via runtime (`get_booking_verification`).
5. **CALL DATA** — one canonical `voiceCall` from conversation start with ANI, duration, transcript, and tool traces.

Report: `node scripts/caller-amy-five-gate-report.mjs` (set `CALL_ID` after a smoke call).

PR #100 (`continue_workflow` timeout/fillers) does **not** fix zero tool transport — do not merge it until TOOL TRANSPORT passes.
