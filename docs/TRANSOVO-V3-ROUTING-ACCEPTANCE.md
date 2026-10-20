# V3 routing acceptance (production proof)

**Design status:** Locked (canonical shared dispatch + called-DID resolver).  
**Production certification:** **Not complete** — no successful PSTN call with two-way audio recorded below.

Architecture reference: `docs/TRANSOVO-V3-CLEAN-LIVEKIT-ROUTING.md`.

Read-only collector: `new-app/scripts/v3-routing-acceptance-readonly.mjs` (no LiveKit mutations).

---

## Acceptance scorecard (evidence-based)

```
V3 routing acceptance

3/7 verified (read-only) · 0/1 PSTN call · production NOT certified

[x] LiveKit audit shows intended resources — see §LiveKit 2026-10-20
[~] Canonical dispatch cleanup applied — live state already canonical; --apply would delete 0 rules (dry-run)
[x] One individual rule dispatches transovo-voice-v3 — SDR_SbGq4QxWDGSx
[ ] Test DID assigned + receptionist published — +15717491685 on trunk; Ava DRAFT/unpublished; assignment phoneId mismatch
[ ] PSTN call → correct agent + two-way audio — blocked (worker down + config gaps)
[x] Unassigned DID rejected — +15717491685 has no inbound assignment row for that phone id; resolve returns null
[ ] Repeat provisioning idempotency — not re-run in this pass
```

---

## LiveKit (production read-only — 2026-10-20 UTC)

**Source:** `npx tsx scripts/v3-routing-acceptance-readonly.mjs` executed inside Coolify New-App container (`commitSha` **1f357d7b9** at time of audit).  
**Artifact:** `/opt/cursor/artifacts/v3-routing-acceptance-prod-2026-10-20.json` (cloud agent run).

| Check | Result | Evidence |
|--------|--------|----------|
| Project | `https://sms-6w01zoya.livekit.cloud` | `livekitHost` in artifact |
| Inbound trunk | `ST_vewjyLgDxVda` · `transovo-telnyx-inbound` · 7 numbers | includes `+15717491685` in sample |
| Dispatch rules (total) | **1** | `dispatchRuleCount: 1` |
| Canonical rule | `SDR_SbGq4QxWDGSx` · `transovo-inbound-dispatch` | |
| Rule type | `dispatchRuleIndividual` | separate room per call |
| Agent target | `transovo-voice-v3` | `agentMatchesWorker: true` |
| Obsolete `transovo-did-dispatch-*` | **0** | `obsoletePerDidRules: []` |
| Scoped `--apply` deletions | **0** | `wouldDeleteOnScopedApply: []` |

**Approval gate:** No `--apply` was run. Current LiveKit state already matches the locked architecture; cleanup apply is optional unless duplicates return.

### Worker registration (`transovo-voice-v3`)

SIP API does not expose “agent online”. Container logs for Coolify app **`transovo-voice`** (`tgjridm6vrmrgljkfrr0rpjn`):

- **2026-10-17:** `"registered worker"` · `agent_name": "transovo-voice-v3"` · `id": "AW_pzL5v5GinYNg"`
- **2026-10-18:** `"shutting down worker"` — container **Exited** (not running at acceptance audit time)

**Blocker for PSTN:** dispatch can target `transovo-voice-v3`, but **no worker process was running** on the host when acceptance was collected. Restart `transovo-voice` on Coolify before calling.

---

## New-App / database (production — 2026-10-20)

| Check | Result |
|--------|--------|
| Deployed commit | `1f357d7b9` (`GET /api/health` in container) — **behind** `master` canonical/trust commits; merge/deploy still recommended after PSTN pass |
| `appointment_receptionist` agent “Ava” | `cmvfjn4eb0001js0o4h14zexo` · status **DRAFT** · `publishedVersionId: null` |
| Inbound assignment | `voiceAgentPhoneNumber` → `phoneNumberId: "n1"` (legacy/stub id) — **does not match** active phone row `cmvelb8d0000flm0lmsudc61b` for `+15717491685` |
| Phone `+15717491685` | Active · on LiveKit trunk · **no** `voiceAgentPhoneNumber` row for that `phoneNumberId` |
| `resolveReceptionistByCalledNumber(+15717491685)` | **Would return null** today → inbound bootstrap fails with “No active receptionist” (correct: no false default tenant) |
| Unassigned probe `+19998887777` | No active phone row |

**Actions before PSTN test (product ops, not architecture):**

1. Restart **`transovo-voice`** worker on Coolify; confirm log line `registered worker` · `agent_name": "transovo-voice-v3"`.
2. Re-assign **`+15717491685`** to Ava so `voiceAgentPhoneNumber.phoneNumberId` matches the real `phoneNumber` row and Telnyx/LiveKit provision matches New-App.
3. **Publish** Ava (`publishedVersionId` required for PSTN per `resolve-livekit-session.ts`).
4. Optionally deploy `master` + PR #710 trust hardening after the call path works.

---

## Trust model (production PSTN)

1. **Authenticated worker** — `POST /api/internal/voice-runtime` + Bearer secret.
2. **No tenant hints** on inbound SIP bootstrap.
3. **SIP-attributed called DID** — mandatory SIP participant source (default in #710); worker sends `bootstrapPath: livekit_sip`.
4. **DB assignment** — published version only; unassigned/mis-assigned DIDs must not resolve.

---

## PSTN capture template (fill on first successful call)

| Field | Value |
|--------|--------|
| Telnyx incoming call ID | _pending_ |
| LiveKit SIP participant identity | _pending_ |
| Called DID (`sip.trunkPhoneNumber`) | _pending_ |
| LiveKit room name / ID | _pending_ |
| Worker job / agent name | expect `transovo-voice-v3` |
| Resolved workspace | _pending_ |
| Published agent version id | _pending_ |
| First audio timestamp (caller hears Ava) | _pending_ |
| Call termination / outcome | _pending_ |

**Certification rule:** Do not mark production certified until this table is filled from a real external PSTN call with two-way audio.

---

## After first successful call

1. Complete a **booking** (or primary receptionist goal) via tools.
2. Verify **post-call** record: `voiceCall`, transcript/summary, workspace linkage.

---

## Commands (read-only)

```bash
cd new-app
npx tsx scripts/test-canonical-dispatch-logic.mjs          # repo / post-deploy
npx tsx scripts/v3-routing-acceptance-readonly.mjs       # LiveKit + DB if env set
npx tsx scripts/v3-routing-acceptance-readonly.mjs --e164 +1XXXXXXXXXX

# Inspect only (review before any delete):
npx tsx scripts/livekit-v3-canonical-routing-audit.mjs

# Mutating — requires explicit ack + human approval:
# LIVEKIT_V3_ROUTING_RESET_ACK=1 npx tsx scripts/livekit-v3-canonical-routing-audit.mjs --apply
```

---

## Definition of done

**Ava answers the assigned test number with the published configuration and two-way audio** — not another routing redesign.
