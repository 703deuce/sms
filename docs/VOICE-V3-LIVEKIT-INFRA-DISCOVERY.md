# Voice V3 → LiveKit migration — infrastructure discovery report

**Status:** Discovery only — no new LiveKit projects, credentials, trunks, or deploys were created.  
**Date:** 2026-09-19  
**Policy:** SEARCH FIRST. REUSE SECOND. CREATE ONLY IF ACTUALLY MISSING. Never print API secrets in logs, commits, or this document.

---

## IMPORTANT: EXISTING LIVEKIT INFRASTRUCTURE ALREADY EXISTS

- Do **NOT** create a new LiveKit Cloud project.
- Do **NOT** create new LiveKit API credentials unless existing credentials are conclusively missing or invalid.
- Do **NOT** deploy a new self-hosted LiveKit server.

For this Voice V3 migration, use the **existing LiveKit Cloud** configuration. Self-hosted remains a future option via `MEDIA_BACKEND_MODE` only.

**Target architecture (unchanged):**

```
Telnyx PSTN
      ↓
existing LiveKit Cloud project
      ↓
LiveKit SIP / AgentSession
      ↓
GPT-Live-1 / Amy
      ↓
Responses delegation
      ↓
GPT-6 Astra
      ↓
thin LiveKit ↔ Transovo adapter
      ↓
existing Transovo tool/business layer
      ↓
Microsoft / Telnyx / DB / SMS
```

**Configuration boundary (preserve):**

```
Transovo Voice V3
        ↓
LiveKit connection configuration
        ↓
LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
        ↓
Cloud today / self-host later
```

Business logic must not care which LiveKit deployment is underneath.

---

## Executive summary

Transovo **already has** a production-grade LiveKit Cloud integration (SDKs, env abstraction, SIP provisioning, Python `transovo-voice` worker, Telnyx FQDN patterns) and a **documented self-hosted alternate** (`MEDIA_BACKEND_MODE=self_hosted`).

**Voice V3 PSTN certification today** still uses **Telnyx → OpenAI Live SIP** (`transfer_to_openai_live_sip`), not LiveKit. The migration is mostly **rewiring ingress + worker session** onto existing Cloud LiveKit, while keeping the **same** V3 delegation/Astra/tool layer — not standing up LiveKit from scratch.

---

## Step 1–2 — Configuration presence (values never printed)

| Item | Cloud Agent VM (Cursor secrets) | Production `transovo-web` container (Coolify host) | Notes |
|------|----------------------------------|-----------------------------------------------------|--------|
| **LiveKit Cloud URL** (`LIVEKIT_URL`) | **FOUND** | **UNSET** on web container | Expected: LiveKit creds often live on **`transovo-voice`** / LiveKit Cloud agent deploy, not always on Next.js web. |
| **API key** | **FOUND** | **UNSET** on web | Consumed via `requireLiveKitEnv()` → `getLiveKitBackendConfig()`. |
| **API secret** | **FOUND** | **UNSET** on web | Same. |
| **SIP URI / host** (`LIVEKIT_SIP_URI`; `LIVEKIT_SIP_HOST` optional) | **FOUND** (`LIVEKIT_SIP_URI`) | **UNSET** on web | `resolveLiveKitSipHost()` / `getAuthoritativeLiveKitSipHost()`. |
| **Agent dispatch name** (`LIVEKIT_AGENT_NAME`) | **FOUND** | **UNSET** on web | `TRANSOVO_LIVEKIT_AGENT_NAME` in `src/lib/telephony/provisioning/config.ts`. |
| **Trunk / dispatch env IDs** (`LIVEKIT_INBOUND_TRUNK_ID`, `LIVEKIT_DISPATCH_RULE_ID`, outbound trunk IDs) | **UNSET** in VM | **UNSET** on web | **Not required** if provisioning uses API discovery; Cloud API shows trunks/rules exist (below). |
| **Self-hosted URL / keys / trunk IDs** | **UNSET** in VM | **UNSET** on web | Prior self-host **documented** in repo snapshot; not active in discovery VM. |
| **`MEDIA_BACKEND_MODE`** | **UNSET** (defaults **cloud**) | **UNSET** | Default `livekit_cloud` per `docs/coolify-livekit-env.md`. |

### Connectivity checks (discovery environment)

- `scripts/amy-livekit-readiness.ts`: **LiveKit API OK** (`listRooms`).
- `scripts/check-livekit-sip-uri-alignment.ts`: API hostname aligns with Cloud project; explicit `LIVEKIT_SIP_URI` may differ from API-derived `*.sip` subdomain (common on LiveKit Cloud).
- Inbound trunk discovered via API (example): name `transovo-telnyx-inbound`, id `ST_MqBTBjwPieAv`, number `+18663464256`.

### Production host layout (discovered)

On the inspected Coolify host at discovery time: **web** + **scheduler** containers in `docker ps`; **`transovo-voice` runs as LiveKit Cloud worker** (not co-located with web). See `voice-runtime-python/` and `docs/amy-livekit-migration.md`.

### Where configuration is consumed (reference)

| Variable / concept | Primary consumers |
|--------------------|-------------------|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | `src/lib/voice/media-backend/config.ts`, `requireLiveKitEnv()` |
| `LIVEKIT_SIP_URI` / SIP host | `src/lib/telephony/provisioning/config.ts`, Telnyx FQDN provisioning |
| `LIVEKIT_AGENT_NAME` | Python `voice-runtime-python/transovo_voice/main.py`, dispatch rules |
| `MEDIA_BACKEND_MODE` | `src/lib/voice/media-backend/resolver.ts`, Python `media_backend.py` |

---

## Step 3 — Cloud vs self-host abstraction (preserve)

| Layer | Location | Behavior |
|--------|-----------|----------|
| Selector | `MEDIA_BACKEND_MODE` | `livekit_cloud` (default) \| `self_hosted` |
| Config resolver | `src/lib/voice/media-backend/config.ts` | `LIVEKIT_*` vs `LIVEKIT_SELF_HOSTED_*` + `LIVEKIT_CLOUD_*` aliases |
| Runtime credentials | `requireLiveKitEnv()` in `src/lib/voice/runtime-provider/config.ts` | Uses **active** backend only |
| SIP host | `getAuthoritativeLiveKitSipHost()` | Self-host branch in `media-backend/sip-host.ts` |
| Python worker | `voice-runtime-python/transovo_voice/media_backend.py` | Maps self-hosted env → `LIVEKIT_*` at runtime |
| Pinning | `media-backend/pinning.ts` + call metadata | Active calls stay on pinned backend |

**Selected for this migration:** **LiveKit Cloud** (`MEDIA_BACKEND_MODE` unset or `livekit_cloud`).

**Self-hosted:** leave untouched; future switch = env + Telnyx ingress scripts (`docs/coolify-livekit-env.md`, `scripts/rollback-telnyx-fqdn-to-cloud.ts`).

---

## Step 6 — What LiveKit was used for (trace before new V3 wiring)

| Use case | Stack | Reuse for V3? |
|----------|--------|-------------|
| **Inbound Amy / generic receptionist** | Telnyx → LiveKit SIP → **Python** `AgentServer` (`voice-runtime-python/transovo_voice/main.py`) → HTTP tools to Transovo | **Patterns** (room metadata, dispatch, backend client); do not duplicate as a second product |
| **Outbound qualification** | TS remnants in `voice-runtime/src/outbound/`; Python outbound **disabled** in `main.py` | Selective reuse of dispatch/outbound trunk helpers |
| **MCTB / SIP telephony** | Python session modules (`sip_*`, MCTB traces) | **Do not** mix into V3 booking path |
| **SIP provisioning** | `src/lib/telephony/provisioning/livekit/*` | **Reuse** — search-first before `create*` |
| **Browser voice test** | `src/lib/voice/platform/livekit-browser-test-session.ts` | Reuse token/dispatch pattern |
| **Legacy Telnyx AI Assistant** | `VOICE_RUNTIME_PROVIDER=telnyx` | **Obsolete** for V3 target; keep flag for rollback |
| **TypeScript LiveKit worker** | `voice-runtime/src/main.ts` | **Removed** — exits with “use voice-runtime-python only” |

**Telnyx ↔ LiveKit today:** FQDN connections, ingress host from `LIVEKIT_SIP_URI` / derived hosts, inbound trunks + dispatch rules (`scripts/verify-571-livekit-callable.ts`, `scripts/setup-amy-866-livekit-end-to-end.ts`).

**Self-hosted proof (historical):** `docs/snapshots/self-hosted-livekit-working-2026-08-24.json` + `docs/self-hosted-livekit-working-snapshot.md` — rollback steps preserved; not active in discovery VM env.

---

## Repository inventory (Step 2)

| Capability | Present? | Where |
|------------|----------|--------|
| LiveKit server SDK | **Yes** | `livekit-server-sdk` ^2.17.0 (`package.json`) |
| LiveKit client (browser) | **Yes** | `livekit-client` ^2.21.0 |
| LiveKit Agents (Node) | **Yes** | `@livekit/agents` ^1.6.2 (+ plugins) — worker entry removed |
| LiveKit Agents (Python) | **Yes** | `livekit-agents[openai]` >=1.2,<2 — **active worker** |
| Token + room + dispatch | **Yes** | `livekit-browser-test-session.ts`, outbound service, provisioning |
| SIP client / trunk CRUD | **Yes** | `media-backend/client.ts`, `telephony/provisioning/livekit/*` |
| Webhooks | **Minimal** | Voice path is SIP + agent jobs, not a separate LiveKit webhook product surface |
| Env validation | **Yes** | `amy-livekit-readiness.ts`, `verify-571-livekit-callable.ts`, `requireLiveKitEnv()` |
| Cloud vs self-host | **Yes** | `src/lib/voice/media-backend/*`, `docs/coolify-livekit-env.md` |

### Related documentation

- `docs/coolify-livekit-env.md` — media backend selector
- `docs/amy-livekit-migration.md` — Amy LiveKit runtime migration notes
- `docs/livekit-sip-saas-architecture.md` — SIP SaaS patterns
- `docs/VOICE-V3-LIVEKIT-ARCHITECTURE-MIGRATION.md` — V3 subsystem inventory (tool/delegation focus)
- `.env.example` — LiveKit env variable catalog (commented)

---

## Voice V3 today vs migration target

| | **Now (PSTN cert path)** | **Target** |
|--|--------------------------|------------|
| Ingress | `src/lib/voice-v3-basic/telnyx-webhook-handler.ts` → `forwardInboundCallToOpenAiLiveSip` | Telnyx → **existing LiveKit Cloud** SIP |
| Media / Amy | OpenAI **GPT-Live** sideband (`src/lib/voice-v3/live-sideband-session.ts`) | LiveKit **AgentSession** + GPT-Live-1 (Agents) |
| Astra / tools | Delegation, freshness, Microsoft executors (frozen) | Same **thin adapter** to Transovo APIs |
| `src/lib/voice-v3/**` LiveKit imports | **None** | New **transport adapter only** |

---

## Step 4 — Create-only-if-missing (initial assessment)

From API inspection with existing Cloud credentials (**no creates run**):

| Resource | Status | Action for migration |
|----------|--------|----------------------|
| LiveKit Cloud **project** | **Exists** (API + SIP) | **Reuse** |
| **Inbound SIP trunk** | **Exists** (e.g. `transovo-telnyx-inbound`) | **Reuse**; add DIDs via existing `trunk.ts` / patch scripts if cert numbers differ |
| **Dispatch rule** | **Likely exists** | Verify per number with `verify-571-livekit-callable.ts` / `inspectLiveKitSipRouting(e164)` |
| **LiveKit Cloud agent / worker** | **Exists** (`transovo-voice` Python) | **Extend or add agent profile** for V3 — not a second Cloud project |
| **Telnyx route for V3 cert numbers** | **May still point at OpenAI SIP / TeXML** | **Routing change** when cutting over — report before apply |
| **GPT-Live delegation in LiveKit Agents** | **Not wired for V3** | **New application code** on existing SDK/worker host |

If anything is missing on a **specific cert DID**, stop and report:

- what is missing  
- why Voice V3 requires it  
- whether creating it changes existing LiveKit behavior  
- the exact resource that would need to be created  

Do not silently create duplicate infrastructure.

---

## Obsolete vs reuse

### Reuse

- `src/lib/voice/media-backend/*`
- `src/lib/telephony/provisioning/livekit/*`
- `requireLiveKitEnv()`, `getLiveKitSipClient*`
- Python `AgentServer` bootstrap (`voice-runtime-python`)
- `TRANSOVO_BACKEND_URL` + `TRANSOVO_INTERNAL_API_KEY` worker → web pattern
- Dispatch snapshot sync (`dispatch-snapshot-sync.ts`)
- Coolify env naming in `.env.example` / `voice-runtime-python/.env.example`

### Do not reuse as-is for V3

- Telnyx Assistant runtime as primary path
- TypeScript `voice-runtime` worker (removed)
- MCTB-specific Python SIP flows in the V3 booking/callback path
- Legacy planner-heavy Amy graphs where V3 uses Astra tool catalog + frozen executors

---

## Step 8 checklist (discovery verdict)

| Field | Verdict |
|--------|---------|
| Existing LiveKit **Cloud** configuration | **FOUND** (env + API-validated in discovery environment) |
| Cloud URL | **FOUND** (WSS project URL; do not commit or log value) |
| API key | **FOUND** — value not stored in this document |
| API secret | **FOUND** — value not stored in this document |
| Existing **self-host** configuration | **FOUND in repo/docs/snapshot**; **not loaded** in discovery VM / web container |
| Repository integration | **Extensive** (see inventory table) |
| SDK versions | Node: `@livekit/agents` ^1.6.2, `livekit-server-sdk` ^2.17.0; Python: `livekit-agents[openai]` >=1.2,<2 |
| SIP resources discovered | **Yes** on Cloud (trunk + example DID); full rule list via `inspectLiveKitSipRouting(e164)` |
| Telnyx ↔ LiveKit discovered | **Yes** (FQDN, provisioning libs, verify scripts); V3 wizard/cert numbers may not use LiveKit ingress yet |
| Reuse for V3 | Config layer, SIP provisioning, worker hosting, internal API bridge |
| Obsolete for V3 | OpenAI-direct SIP forward as long-term ingress; Telnyx Assistant path; TS worker |
| **Genuinely new for GPT-Live V3 on LiveKit** | (1) LiveKit-side GPT-Live / delegation session matching current sideband semantics, (2) Telnyx routing to LiveKit for V3 numbers, (3) worker entry that calls existing `handle-delegated-voice-tools` / freshness — **not** new Microsoft/callback/SEND_LINK executors |

---

## Recommended next steps (discovery-led)

1. **Per cert number:** run `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/verify-571-livekit-callable.ts` (set `PHONE_E164`) and record PASS/FAIL for trunk, dispatch, worker join — **no creates** until gaps are listed.
2. **Map** OpenAI SIP webhook URLs used by V3 today vs LiveKit room/job metadata contract (reuse Python `dispatch_resolver` / inbound metadata patterns).
3. **Design spike:** one worker profile (`LIVEKIT_AGENT_NAME` or job metadata flag) → V3 adapter → same sideband/delegation code paths certified on conversation freshness.

---

## Step 5 — Preserve secrets (reminder)

Never:

- commit LiveKit credentials  
- copy them into source code  
- expose them in test output  
- include their values in documentation  
- replace existing secrets unnecessarily  

Use the existing environment-variable/secrets mechanism. If secret names need mapping into a worker, reference **existing** secret names.

---

## Step 7 — Voice V3 migration goal (unchanged)

The existence of old LiveKit code does **not** change the migration architecture.

Do not:

- create a parallel product  
- create another wizard  
- rebuild existing Transovo executors  
- rebuild functionality already supplied by LiveKit Agents where Agents owns it  

---

*End of discovery report.*
