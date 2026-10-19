# Transovo V3 — clean LiveKit routing (canonical)

**Status:** Target architecture for greenfield New-App SaaS (no legacy tenant dispatch to preserve).

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

- [ ] Only one shared V3 dispatch rule on the inbound trunk.
- [ ] Dispatch agent name = `transovo-voice-v3`.
- [ ] No `transovo-did-dispatch-*` rules remain.
- [ ] PSTN call to assigned DID → worker receives called number.
- [ ] Resolver returns correct workspace + **published** bundle.
- [ ] Unassigned DID → resolver error (no cross-tenant leak).
- [ ] Re-provision does not create duplicate dispatch rules.

## Related docs

- `docs/NEW-APP-VOICE-NUMBER-SWITCH.md` — Telnyx switch sequence (carrier vs bindings).
- `docs/NEW-APP-VOICE-ROUTING-PHONE-MCTB-RECEPTIONIST-EXPLAINED.md` — Phone / MCTB / Receptionist layers.
