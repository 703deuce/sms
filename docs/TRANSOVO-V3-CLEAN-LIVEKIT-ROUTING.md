# Transovo V3 — clean LiveKit routing (canonical)

**Status:** **Locked design** for greenfield New-App SaaS. Production proof tracked in `docs/TRANSOVO-V3-ROUTING-ACCEPTANCE.md` (acceptance checklist — not yet certified).

## Intended path

```
Telnyx (number → LiveKit FQDN connection)
  → LiveKit inbound SIP trunk (shared, all assigned DIDs)
  → One canonical dispatch rule (`transovo-inbound-dispatch`)
  → Worker `transovo-voice-v3` (single Python app, many concurrent sessions)
  → New-App `resolveNativeVoiceV3LiveKitSession` / `resolveReceptionistByCalledNumber(dialedE164)`
  → Published `VoiceAgentVersion` for that workspace only
```

## Design rules

| Rule | Detail |
|------|--------|
| **One dispatch rule** | Trunk-scoped **individual** rule → **separate room per call**. No per-customer LiveKit dispatch rules. |
| **No tenant ids in dispatch metadata** | Job metadata: `runtime: voice_v3_gpt_live`, `resolve: http_backend_on_sip`. Workspace/agent come from **called DID** + DB assignment. |
| **One worker name** | Always `transovo-voice-v3` (env: `VOICE_V3_LIVEKIT_AGENT_NAME`). |
| **Assignment in Transovo** | `voiceAgentPhoneNumber` + publish gate; unassigned DIDs must not resolve to another workspace. |
| **Obsolete cleanup** | Delete `transovo-did-dispatch-*` rules and duplicate shared rules. Do not maintain split/rescope compatibility code. |

## Number assignment (AI Receptionist)

1. Confirm number belongs to workspace.
2. `ensureInboundTrunkForNumber(e164)` — add DID to shared trunk.
3. `ensureCanonicalV3SharedDispatchRule({ trunkId })` — idempotent.
4. `pruneObsoleteDispatchRules({ keepRuleId })` — remove per-DID rules.
5. Telnyx → LiveKit FQDN connection (verify + rollback on failure).
6. Persist `livekit_sip` telephony record + `voiceAgentPhoneNumber` link.
7. User publishes receptionist → optional dispatch refresh (canonical only).

**Code:** `new-app/lib/server/telephony/v3-receptionist-provision.ts`, `new-app/lib/server/receptionist/livekit/canonical-dispatch.ts`.

## Session resolution

**Inbound SIP:** `new-app/lib/server/voice-v3/resolve-livekit-session.ts`

- Requires `dialedE164` from worker bootstrap.
- `resolveReceptionistByCalledNumber` → workspace, agent, paused state.
- **Published version only** for production inbound (no draft on PSTN).
- Browser test rooms use explicit `workspaceId` / `agentId` in metadata.

## Operations

### Audit / reset LiveKit dispatch rules

```bash
cd new-app
npx tsx scripts/livekit-v3-canonical-routing-audit.mjs          # inspect + dry-run prune
npx tsx scripts/livekit-v3-canonical-routing-audit.mjs --apply    # ensure canonical + delete obsolete
```

Requires `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### What not to break

- Telnyx Phone WebRTC / Call Control (`telnyx_call_control` routing mode).
- MCTB TeXML ingress (`mctb_texml`) and certified forwarding test paths.
- SMS, calendars, unrelated LiveKit credentials.

## Verification checklist

### Infrastructure (LiveKit)

- [ ] Only one shared V3 dispatch rule on the inbound trunk (`transovo-inbound-dispatch`).
- [ ] Rule type = **individual** (separate room per call).
- [ ] Dispatch agent name = **`transovo-voice-v3`** (matches Python worker registration).
- [ ] No `transovo-did-dispatch-*` rules remain.
- [ ] Re-provision is idempotent (no duplicate rules).

Run audit (inspect first, then apply with ack):

```bash
cd new-app
npx tsx scripts/livekit-v3-canonical-routing-audit.mjs
LIVEKIT_V3_ROUTING_RESET_ACK=1 npx tsx scripts/livekit-v3-canonical-routing-audit.mjs --apply
```

Cleanup scope: **only** duplicate `transovo-inbound-dispatch` rules and `transovo-did-dispatch-*` names — never arbitrary trunks or unrelated rule names.

### Called number trust (PSTN)

- [ ] Python worker sets `dialedE164` from SIP participant attributes (`sip.trunkPhoneNumber` preferred).
- [ ] Worker sends `dialedE164Source` to New-App `resolve_voice_v3_livekit_session`.
- [ ] New-App **rejects** inbound bootstrap that includes `workspaceId` / `agentId` hints.
- [ ] New-App resolves tenant via `resolveReceptionistByCalledNumber` + verifies phone row ownership.
- [ ] **Published** version only for PSTN (draft never serves production inbound).

**Production default:** SIP-participant `dialedE164Source` is **required** (e.g. `sip.trunkPhoneNumber`). Internal API auth binds the worker; hints cannot select tenant. Dev-only: `VOICE_V3_ALLOW_UNATTRIBUTED_DIALED_SOURCE=1`.

### Browser test

- [ ] `POST /api/receptionist/test/livekit` requires authenticated workspace (`resolveWorkspaceId`).
- [ ] Explicit `workspaceId` / `agentId` allowed only for `transovo-browser-test-*` rooms.

### Product milestone (acceptance — not architecture)

See **`docs/TRANSOVO-V3-ROUTING-ACCEPTANCE.md`** for the 0/7 checklist and copy block. Next meaningful result: PSTN call → correct **published** agent (e.g. Ava on test DID).

## Related docs

- `docs/NEW-APP-VOICE-NUMBER-SWITCH.md` — Telnyx switch sequence (carrier vs bindings).
- `docs/NEW-APP-VOICE-ROUTING-PHONE-MCTB-RECEPTIONIST-EXPLAINED.md` — Phone / MCTB / Receptionist layers.
