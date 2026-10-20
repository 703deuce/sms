# V3 routing acceptance (production proof)

**Design status:** Locked (canonical shared dispatch + called-DID resolver).  
**Implementation status:** Code on `master` + trust hardening PR; **acceptance not complete until checklist below is green.**

Architecture reference: `docs/TRANSOVO-V3-CLEAN-LIVEKIT-ROUTING.md`.

## Trust model (production PSTN)

1. **Authenticated worker only** — `POST /api/internal/voice-runtime` requires `Bearer` internal secret (`verifyVoiceRuntimeInternalAuth`). Only `transovo-voice-v3` should hold this credential.
2. **No tenant hints on SIP** — Inbound resolve rejects `workspaceId` / `agentId` / `useDraft`.
3. **SIP-attributed called DID** — Worker reads LiveKit SIP participant attributes; backend **requires** `dialedE164Source` from `SIP_PARTICIPANT_DIALED_E164_SOURCES` (default). Dev-only opt-out: `VOICE_V3_ALLOW_UNATTRIBUTED_DIALED_SOURCE=1` (never in production).
4. **Transovo assignment** — `resolveReceptionistByCalledNumber` + phone row ownership + **published** version only.

`dialedE164Source` is attribution metadata, not cryptographic proof. Production safety is **worker auth + no hint routing + DB assignment**.

## Checklist (copy for certification)

```
V3 routing acceptance

0/7

[ ] LiveKit audit shows intended resources (dry-run reviewed)
[ ] Canonical dispatch cleanup applied (--apply with LIVEKIT_V3_ROUTING_RESET_ACK=1)
[ ] One individual rule dispatches transovo-voice-v3
[ ] Test DID assigned and receptionist published
[ ] PSTN call reaches correct agent with two-way audio
[ ] Unassigned DID is rejected (no cross-tenant agent)
[ ] Repeat provisioning creates no duplicate dispatch rules
```

## Commands

```bash
# 1–3 Infrastructure
cd new-app
npx tsx scripts/livekit-v3-canonical-routing-audit.mjs
# Review output; optionally export rule list from LiveKit console before apply.
LIVEKIT_V3_ROUTING_RESET_ACK=1 npx tsx scripts/livekit-v3-canonical-routing-audit.mjs --apply

# 4 Product setup (UI or API): assign DID, publish receptionist

# 5–6 Manual PSTN from external phone; inspect New-App voiceCall + LiveKit room name uniqueness

# 7 Re-run assign / provision flow; audit again — rule count unchanged
```

## Before `--apply`

- Confirm project/credentials target the **intended** LiveKit project.
- Dry-run lists **only** duplicate `transovo-inbound-dispatch` and `transovo-did-dispatch-*` deletions.
- Save current dispatch rule IDs from the audit output (restore via LiveKit API/console if needed).

## Definition of done

**Ava (or test receptionist) answers the assigned test number with the published configuration** — not another routing redesign.
