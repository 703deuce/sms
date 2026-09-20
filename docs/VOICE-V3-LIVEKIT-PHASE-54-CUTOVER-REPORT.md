# Voice V3 LiveKit — Phase 54 controlled cutover (+15717491060)

**Status:** Infrastructure cutover **COMPLETE** — **STOP** for first real PSTN call (Steps 7–11).  
**Branch / tooling:** `cursor/571-livekit-v3-cutover-phase54-2304` · `scripts/cutover-571-livekit-v3-phase54.ts`

Direct-OpenAI rollback code in Git was **not** modified or deleted.

---

## Step 1 — Pre-cutover record

| Item | Value |
|------|--------|
| **Recorded (UTC)** | 2026-09-20T02:00:28Z |
| **Web image SHA** | `2174851663d56ee7828b846fdac5eb2600eaf43b` |
| **App 2 voice image** | `tgjridm6vrmrgljkfrr0rpjn:00798e40bbcb337a0ad4707368699e2fd4acf2c3` (deploy **2999**) |
| **LiveKit project** | `sms-6w01zoya` |
| **Inbound trunk** | `ST_MqBTBjwPieAv` (`transovo-telnyx-inbound`) — numbers **`+18663464256` only** |
| **Dispatch** | `SDR_VjjkrrgEjiR3` → legacy `LIVEKIT_AGENT_NAME` (trunk-wide) |
| **Telnyx +15717491060** | **Transovo Voice V3 Basic OpenAI SIP** (`3051313082853754271`) |
| **V3 worker** | `transovo-voice-v3` registered on App 2 `:8083` |

---

## CUTOVER (Steps 2–5)

### LiveKit trunk

- **Action:** Added `+15717491060` to existing trunk `ST_MqBTBjwPieAv` (866 retained).
- **Read-back:** `LIVEKIT TRUNK OWNS +15717491060` = **YES** (`numbers=["+18663464256","+15717491060"]`).

### Dispatch

- **Constraint:** LiveKit Cloud rejected a second per-DID dispatch rule on the same trunk (even after callee conversion / `numbers` updates — server still treated the rule as trunk-wide).
- **Action taken:** Updated trunk dispatch rule **`SDR_Vnzi2bUUohRh`** (`transovo-inbound-dispatch`) → agent **`transovo-voice-v3`**.
- **Read-back:** `LIVEKIT_DISPATCH` verify gate **PASS** → `SDR_Vnzi2bUUohRh` → `transovo-voice-v3`.
- **Follow-up (not blocking 571 cert):** `+18663464256` also dispatches to **V3** until LiveKit per-DID split is supported or trunk is split another way. V3 resolves config by **dialed E.164** at runtime.

### Telnyx

| | Before | After |
|---|--------|--------|
| Connection | Transovo Voice V3 Basic OpenAI SIP | **Transovo LiveKit Inbound** (`3037959952799893412`) |
| FQDN | (direct OpenAI path) | **`sms-6w01zoya.sip.livekit.cloud`** |

### Verify script (`verify-571-livekit-callable.ts`, App 2 LiveKit creds + `MEDIA_BACKEND_MODE=livekit_cloud`)

| Gate | Result |
|------|--------|
| LIVEKIT_API | PASS |
| LIVEKIT_SIP_PROJECT_ALIGN | PASS |
| LIVEKIT_SIP_TRUNK | PASS |
| LIVEKIT_DISPATCH | PASS (`transovo-voice-v3`) |
| TELNYX_NUMBER | PASS |
| TELNYX_FQDN | PASS |
| TELNYX_RECENT_SIP | WARN (no CDR yet — place call) |
| DB_AGENT_ROUTE | FAIL (DB maps DID to different agent id than script default — pre-existing) |
| VERIFY_ROUTING | FAIL (DB provision snapshot not updated — infra gates above PASS) |
| WEB_HEALTH / VOICE_RUNTIME_API | PASS |
| WORKER_DISPATCH_PROBE | PASS (synthetic room; uses primary agent name in script — not PSTN) |

---

## Routing state (current)

```
PSTN → Telnyx (Transovo LiveKit Inbound)
     → sms-6w01zoya.sip.livekit.cloud
     → trunk ST_MqBTBjwPieAv (+18663464256, +15717491060)
     → dispatch SDR_Vnzi2bUUohRh → transovo-voice-v3
     → run_voice_v3_livekit_session (App 2 :8083)
```

---

## Next: Steps 7–11 (human PSTN)

1. **Place call** to `+15717491060` (silent → greeting → speak → optional availability).
2. **Watch** App 2 logs: `docker logs -f <transovo-voice container>` for `voice_v3_*` / `run_voice_v3_livekit_session`.
3. Report SIP attributes, greeting/silence, tool test, latency, first failing boundary **A–L**.

Cloud agent **cannot** place PSTN; user/operator must call.

---

## Incident: “Cannot be completed as dialed” (2026-09-20 ~02:15 UTC)

| Evidence | Value |
|----------|--------|
| Telnyx SIP CDR | `hangup=UNALLOCATED_NUMBER`, `sip_invite_failure_status=404` on inbound to `+15717491060` |
| **First failing boundary** | **A** — Telnyx reached LiveKit SIP; LiveKit rejected INVITE (404) |

**Cause:** During cutover, the shared dispatch rule was briefly recreated as **`dispatchRuleCallee`**. Telnyx + this trunk had been certified with **`dispatchRuleIndividual`**. That mismatch produced LiveKit SIP 404 (same class as historical 866 `UNALLOCATED_NUMBER`).

**Repair applied (production):**

1. Restored **`dispatchRuleIndividual`** on `SDR_Vnzi2bUUohRh` (agent remains **`transovo-voice-v3`**).
2. Set trunk numbers to **±E.164 variants** for both `+18663464256` and `+15717491060`.

**Retry:** Place another PSTN call to `+15717491060` and confirm Telnyx SIP CDR no longer shows 404.

---

## Repair 2 — API-backed Telnyx × LiveKit (2026-09-20, canonical provisioning)

**References (authoritative, not guessed):**

| Source | Requirement |
|--------|-------------|
| [Telnyx LiveKit quickstart](https://developers.telnyx.com/docs/livekit/quickstart) | Inbound trunk: explicit `numbers` (+E.164), `allowed_addresses: ["192.76.120.0/22"]` |
| [LiveKit Telnyx provider](https://docs.livekit.io/telephony/start/providers/telnyx/) | Telnyx FQDN connection → project `*.sip.livekit.cloud`, `dnis_number_format` +e164 |
| [Telnyx signaling IPs](https://support.telnyx.com/en/articles/1130687-whitelisting-telnyx-ip-addresses) | US primary `192.76.120.10`, secondary **`64.16.250.10`** (not inside `/22` alone) |
| Transovo `number-assignment.ts` | `ensureTelnyxLiveKitFqdnConnection` → `ensureInboundTrunkForNumber` → `ensureSharedDispatchRule` |

**Note:** Telnyx **hosted** LiveKit (`nyc1.sip.livekit-telnyx.com`) is a different product path. This project uses **LiveKit Cloud** (`sms-6w01zoya.sip.livekit.cloud`) — correct per LiveKit’s Telnyx provider doc, not the Telnyx regional `livekit-telnyx.com` FQDN.

**Root cause of persistent 404:** `fullResetLiveKitSipIngress` left a **wildcard trunk** (`numbers: []`, two host IPs only). LiveKit accepts the INVITE only when the called DID is on the trunk (or allowlist/auth rules match). Empty `numbers` + incomplete allowlist → `UNALLOCATED_NUMBER` / SIP 404 at LiveKit.

**Script:** `scripts/repair-571-livekit-sip-canonical.ts` (+ `scripts/inspect-571-telnyx-livekit.ts` read-only)

**LiveKit after repair (read-back):**

| Resource | Value |
|----------|--------|
| Trunk | `ST_vewjyLgDxVda` — `+15717491060`, `15717491060`, `+18663464256` |
| Allowlist | `192.76.120.0/22`, `192.76.120.10`, `64.16.250.10` |
| Dispatch | `SDR_SbGq4QxWDGSx` → **`transovo-voice-v3`**, `trunkIds: [ST_vewjyLgDxVda]` |
| Telnyx | `+15717491060` → **Transovo LiveKit Inbound** → `sms-6w01zoya.sip.livekit.cloud:5060` |

**Code:** `telnyx-ips.ts` / `telnyx-allowlist.ts` now align allowlist with Telnyx US primary + secondary signaling.

**Retry PSTN** — Telnyx CDR should show `NORMAL_CLEARING` or LiveKit hangup, not `sip_invite_failure_status=404`.

---

## Rollback (not executed)

- Git: direct-OpenAI path unchanged.
- Telnyx: PATCH number back to connection `3051313082853754271` (Transovo Voice V3 Basic OpenAI SIP).
- LiveKit: remove `+15717491060` from trunk; restore dispatch agent to legacy `LIVEKIT_AGENT_NAME` on `transovo-inbound-dispatch`.
