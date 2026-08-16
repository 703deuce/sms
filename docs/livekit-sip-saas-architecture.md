# LiveKit SIP architecture for multi-tenant Transovo

Transovo is a SaaS: customers buy numbers in the product; **no human should create LiveKit trunks or dispatch rules in the dashboard per customer**. Provisioning runs through Telnyx + LiveKit server APIs from the Transovo backend. The Python voice worker only **consumes** resolved configuration at call time.

## End-to-end flow

```
Customer buys / assigns number
        ↓
Telnyx API (Call Control / FQDN → LiveKit SIP host)
        ↓
Transovo DB (workspace, agent, DID, provision record)
        ↓
LiveKit SIP API (shared inbound trunk, shared dispatch, shared outbound trunk)
        ↓
Inbound PSTN call → called DID → bootstrap → transovo-voice session
Outbound / warm transfer → shared trunk + per-call sip_number + sip_call_to
```

## LiveKit guidance we follow

| Resource | LiveKit recommendation | Transovo pattern |
|----------|------------------------|------------------|
| Outbound trunk | Long-lived, reused across calls; vary caller ID with `sip_number` | **One (or few) platform Telnyx → LiveKit outbound trunks** |
| Outbound call | `CreateSIPParticipant` with stored trunk + `sip_number` | Warm transfer / outbound dial uses shared trunk ID + customer DID |
| Inbound trunk | API-managed; can hold many DIDs | **Shared `transovo-telnyx-inbound`** with DID added on provision |
| Dispatch rule | Reuse rules; route dynamically (room prefix / metadata) | **Shared `transovo-inbound-dispatch`** → `transovo-voice-runtime` worker |
| Inline trunk on participant | Supported but less reliable at scale | Not used for production; prefer stored trunk |

## Resource ownership matrix

| Scope | Resources | Stored where | Notes |
|-------|-----------|--------------|-------|
| **Platform-wide** | LiveKit project URL/API keys; default outbound trunk ID env; shared inbound trunk; shared dispatch rule; Telnyx FQDN connection template; outbound trunk name `transovo-telnyx-outbound` | Env + optional `LIVEKIT_*_TRUNK_ID` overrides after first provision | Same trunk IDs for all tenants when using shared resources |
| **Per Telnyx connection** | FQDN connection id, SIP credential toward LiveKit | `phoneNumber.settingsJson.telephony.telnyxFqdnConnectionId` | Usually one shared FQDN connection per LiveKit SIP host |
| **Per workspace / customer** | Workspace id, voice agent id, published version, explicit dispatch metadata | DB (`workspace`, `voiceAgent`, `phoneNumber` assignment) | Routing resolved at bootstrap from called DID |
| **Per phone number (DID)** | E.164, Telnyx number id, inbound trunk membership, outbound trunk caller-id list entry, provision state | `phoneNumber` + `settingsJson.telephony` | Provision adds DID to shared trunks; does **not** create new trunks per number |
| **Per call** | Room name, participant, `sip_number` (customer DID), `sip_call_to` (transfer target) | Ephemeral / `voiceCall` row | No new LiveKit trunk per call |

## Environment variables (platform-level)

Preferred name for the shared outbound trunk fallback:

```bash
LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID=ST_xxxxx
```

Legacy aliases still read by code (same value):

- `LIVEKIT_OUTBOUND_TRUNK_ID`
- `LIVEKIT_SIP_OUTBOUND_TRUNK`

Telnyx credentials for **creating** the shared outbound trunk (web provisioning only):

```bash
TELNYX_SIP_OUTBOUND_USERNAME=
TELNYX_SIP_OUTBOUND_PASSWORD=
TELNYX_SIP_OUTBOUND_ADDRESS=sip.telnyx.com   # optional
```

Inbound / dispatch optional overrides (after first successful provision):

```bash
LIVEKIT_INBOUND_TRUNK_ID=
LIVEKIT_DISPATCH_RULE_ID=
```

## Code map

| Concern | Module |
|---------|--------|
| Number provision orchestration | `src/lib/telephony/provisioning/number-assignment.ts` |
| Shared outbound trunk + caller ID list | `src/lib/telephony/provisioning/livekit/outbound-trunk.ts` |
| Shared inbound trunk | `src/lib/telephony/provisioning/livekit/trunk.ts` |
| Shared dispatch rule | `src/lib/telephony/provisioning/livekit/dispatch.ts` |
| Bootstrap (pass trunk + caller ID to Python) | `src/lib/voice/python-runtime-bridge/bootstrap-inbound.ts` |
| Warm transfer | `voice-runtime-python/transovo_voice/agent/transfer_tool.py` |

### Provision (`ensureNumberProvisioned`)

1. Telnyx: route number to LiveKit FQDN connection.
2. LiveKit: ensure DID on shared inbound trunk.
3. LiveKit: attach trunk to shared dispatch rule.
4. LiveKit: ensure customer DID on **shared** outbound trunk (non-fatal if Telnyx outbound creds missing).
5. DB: store trunk/dispatch ids in `settingsJson.telephony`.

### Bootstrap (`bootstrapInboundForPython`)

Returns:

- `sipOutboundTrunkId` — from `resolvePlatformOutboundTrunkId({ callerIdE164: called DID })` (ensures DID on trunk when creds exist).
- `sipCallerIdE164` — called DID for per-call `sip_number`.

### Outbound / transfer

```text
trunk_id     = shared platform outbound trunk
sip_number   = customer's Transovo DID (caller ID)
sip_call_to  = transfer destination or outbound target
```

## Operations checklist

1. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` on **transovo-web** (provisioning) and **transovo-voice** (worker).
2. Set `TELNYX_SIP_OUTBOUND_USERNAME` / `PASSWORD` on **transovo-web** so provision can create/register the shared outbound trunk.
3. After first number provision or `ensureLiveKitOutboundTrunk`, copy trunk id to `LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID` on web (optional speed-up; code also finds by name `transovo-telnyx-outbound`).
4. Voice worker does **not** need outbound trunk env if bootstrap returns `sipOutboundTrunkId` (preferred).
5. Run `verifyNumberRouting` or LiveKit readiness API for a DID before production smoke.

## What we do **not** do

- Create a new LiveKit outbound trunk per customer or per call.
- Require dashboard manual trunk creation per SaaS tenant.
- Put per-customer trunk IDs only in voice worker env (DB + bootstrap instead).

## Related docs

- `docs/deployment-transovo-web-voice-split.md` — Coolify web vs voice env split
- `docs/outbound-voice-audit.md` — outbound dial audit script
- `docs/amy-livekit-migration.md` — Caller Amy / LiveKit migration notes
