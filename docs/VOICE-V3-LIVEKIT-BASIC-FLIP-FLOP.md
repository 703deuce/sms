# Why LiveKit Basic kept coming back (and what we changed)

## Why this mattered for Voice V3 troubleshooting

Provisioning (Telnyx + LiveKit) could succeed while **the wrong LiveKit worker** answered the call. Prompt and wizard work targeted **Voice V3 (GPT-Live Amy + Astra)**; some PSTN calls still ran **legacy Basic (`gpt-realtime`)**. Those calls are **not valid evidence** for whether Amy/Astra prompts were good or bad.

**One number → one intended receptionist → one Voice V3 runtime** is the production architecture.

## Symptom

PSTN calls to wizard / AI Receptionist numbers sometimes sounded like **LiveKit Basic** (`gpt-realtime`, short template router) instead of **Voice V3** (`gpt-live-1` Amy + Astra). Calls could feel longer or “not Amy,” with no `voiceV3Forensics` and `agentTemplate: livekit_basic_voice` in call metadata.

## Root cause (three layers)

### 1. Two LiveKit workers on one cluster (historical)

| Worker name | Process | Runtime |
|-------------|---------|---------|
| `transovo-voice-runtime` | Legacy profile | Template router; default **`livekit_basic_voice`** |
| `transovo-voice-v3` | V3 profile | GPT-Live Amy + Astra |

Both workers could register at once. **Whichever agent name the SIP dispatch rule targeted won.**

### 2. Provisioning stamped the legacy worker

Dispatch sync used `transovo-voice-runtime` for many DIDs. Job metadata embedded a bootstrap snapshot defaulting to **`livekit_basic_voice`**.

### 3. Workspace-wide canonical agent override

`resolveAgentByCalledNumber` could substitute the **cert** agent for **every** DID in the workspace. Wizard **3615** could load **cert** config on the **wrong** stack.

## Fix (code)

1. **V3 only** — `TRANSOVO_LIVEKIT_AGENT_NAME` = `transovo-voice-v3`; voice container runs **one** V3 process (no legacy worker registered for PSTN).
2. **Dispatch** — SIP rules target `voice_v3_gpt_live` metadata (no Basic bootstrap snapshot).
3. **`livekit_basic_voice`** — not an active fallback; requests **fail loudly**.
4. **`resolveAgentByCalledNumber`** — per-DID inbound owners; cert canonical override **only** on cert E.164.

Lab template source may remain in the repo; it must **not** register as a production PSTN worker.

After deploy, **re-sync dispatch** for each receptionist DID (publish or dispatch metadata sync). Rules still pointing at `transovo-voice-runtime` will **not** connect to any worker until fixed — intentional.

## Production acceptance criteria (V3 only)

| Check | Expected evidence |
|-------|-------------------|
| Worker processes | **Only** `transovo-voice-v3` registered with LiveKit (no `transovo-voice-runtime` on PSTN) |
| SIP dispatch | Receptionist DIDs → `agentName: transovo-voice-v3` |
| Called-number resolution | **3615** → wizard agent; **1060** → cert agent (no cross-substitution) |
| Session bootstrap | `voice_v3_gpt_live` / `resolve_voice_v3_livekit_session` — not Basic |
| Actual model | GPT-Live-1 + Astra delegation |
| Published config | Version for **called** DID’s inbound owner |
| Call forensics | `voiceV3Forensics` present on the call row |
| Tools | Match that agent’s published capabilities |

**Not** acceptable: “runs both legacy + V3 profiles” on the voice container for production PSTN.

### Automated pre-call check (web container + DB + LiveKit API)

```bash
WIZARD_E164=+15714073615 CERT_E164=+15717491060 \
EXPECTED_WIZARD_AGENT_ID=cmu42zyel1c4x01090c6s335z \
EXPECTED_CERT_AGENT_ID=cmshz2lc25c622c4i58303501 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/verify-voice-v3-inbound-dual-did.ts
```

Does **not** change cert published business settings.

### After routing PASS — real PSTN call

Confirm on the call record: forensics, GPT-Live session, correct `agentId` for the number you dialed. Only then judge prompt refinements.

## What we are not doing

- Changing cert `+15717491060` **published business configuration** as part of routing fixes.
- Using pre-fix Basic calls as the baseline for Amy/Astra prompt quality.
