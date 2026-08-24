# MCTB Self-Hosted Closeout Checklist

Architecture is **FROZEN**. This checklist covers deployable fixes and manual proof only.

## 1. Coolify env (BLOCKER — human)

Set on **both** `transovo-web` and `transovo-voice`:

```
MEDIA_BACKEND_MODE=self_hosted
LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID=ST_acZETLdoDQ8o
```

Verify after redeploy:

```bash
npx tsx scripts/verify-production-env-trunk.ts
```

Must return `"ok": true`.

## 2. Deploy PR #250

Includes:

- `phoneNumberId` linkage fix (E164 normalization)
- `missedCallEvent.metadata` stamping (`mediaBackend`, `path`, `providerCallId`, `transovoNumberE164`, `livekitRoomName`)
- `callSessionId` on consent events
- Duplicate consent protection

## 3. Post-deploy automated checks

```bash
MEDIA_BACKEND_MODE=self_hosted LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID=ST_acZETLdoDQ8o \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/production-verification-pass.ts

NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/test-mctb-press1-consent-db.ts

MEDIA_BACKEND_MODE=self_hosted LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID=ST_acZETLdoDQ8o \
  npx tsx scripts/verify-self-hosted-provisioning-path.ts --apply
```

## 4. Manual call #1 (REQUIRED — fresh DB proof)

Call **+15714073615**, press **1**, confirm SMS.

Then run:

```bash
npx tsx scripts/mctb-trace-recent-571-calls.ts +15714073615 2h
npx tsx scripts/mctb-audit-proof-call-db.ts <missedCallEventId>
```

**Must show:**

- `phoneNumberId` = `cmsgtjms84g6l2h0o255w1e3v` (or current 571 row)
- `metadata.mediaBackend` = `self_hosted`
- `metadata.path` = `livekit_sip_mctb`
- `metadata.providerCallId` = SIP correlation id
- consent `callSessionId` = same providerCallId
- exactly **one** missedCallEvent, **one** consent, **one** SMS

## 5. Manual Smart Routing matrix (after MCTB proof)

1. SR accepted (destination presses 1) — two-way audio
2. SR + destination personal VM (no press 1) — caller NOT bridged to VM
3. SR timeout/no answer — fallback executes
4. SR busy/rejected — fallback
5. Transovo voicemail fallback — record + playback

## 6. Not current product requirements

Do not build for launch: warm/blind transfer, conference/3-way, hold music on MCTB SIP, MCTB recording, transcription/AI on MCTB path.
