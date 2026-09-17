# GPT-Live minimal protocol baseline (isolated)

Proves GPT-Live behavior **without** Amy greeting, tools, delegation, `response.create`, or post-start control events.

## Enable on test server (hot-patch, not master)

```bash
./scripts/prod-voice-bridge-hotpatch.sh --minimal
```

Sets `/app/.voice_ai_transport` → `openai_live_minimal` and patches bridge code.

## Baselines (env on container)

| `OPENAI_LIVE_MINIMAL_BASELINE` | Instructions |
|-------------------------------|--------------|
| **A** (default) | none — model + PCMU audio + voice only |
| **B** | `You are Amy, a helpful phone receptionist.` |
| **C** | B + `Keep responses short and ask one question at a time.` |

Example: `OPENAI_LIVE_MINIMAL_BASELINE=B` in container env (optional; default A).

## Protocol (this path only)

1. WebSocket `wss://api.openai.com/v1/live/sessions` (no query params)
2. One `session.start` after open
3. Wait `session.started`
4. Only `session.input_audio.append` from **inbound** Telnyx media (outbound dropped)
5. Play `session.output_audio.delta` to Telnyx in order
6. **Never** `response.create`, `session.commentary.append`, `session.instructions.append`, greeting timers

**Caller speaks first** — no scripted greeting.

## PSTN test script

1. Call 571; stay silent **10s** — note if Live speaks without client triggers
2. Say **“Hello.”**
3. Say **“I need to book an appointment.”**
4. Stay silent **10s** after Amy finishes — note spontaneous extra speech

## Logs

```bash
docker logs <container> 2>&1 | grep -E 'LIVE_CLIENT_EVENT|LIVE_SERVER_EVENT|live_minimal|<callId>'
```

Pass: `session.started`, audio in/out, **zero** `live_minimal_unexpected_client_event` during silence test, no outbound-echo loop.

## Code

- `live-minimal-call-bridge.ts` — runtime
- `live-minimal-config.ts` — `session.start` payload
- `ws-server.ts` — routes `openai_live_minimal` transport

Restore Amy Live experiment: `./scripts/prod-voice-bridge-hotpatch.sh --live`
