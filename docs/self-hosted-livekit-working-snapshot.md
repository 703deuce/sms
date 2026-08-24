# Self-hosted LiveKit working snapshot (frozen rollback point)

**Frozen:** 2026-08-24 after production proof call at 12:33 UTC  
**Git commit:** `d150e0e0` (Align self-hosted LiveKit trunk with cloud and add pipeline trace tools)  
**Status:** PSTN → Telnyx → self-hosted LiveKit SIP → worker → Press-1 → consent → SMS **verified**

This document captures the known-good self-hosted configuration. **LiveKit Cloud config is unchanged** and remains the rollback target.

## Verified end-to-end path

```
PSTN → Telnyx → voice.transovo.ai:5060 → self-hosted LiveKit SIP // pragma: allowlist secret
     → transovo-voice worker (wss://voice.transovo.ai) // pragma: allowlist secret
     → Press-1 consent → missedCallEvent + SMS
```

**Proof call (12:33 UTC):** +17038166017 → +15714073615 // pragma: allowlist secret  
SIP correlation `SCL_xQ2UyyRPdWMg`, room `RM_WwKFXVYK3Vgp`, consent recorded, SMS sent.

## Active backend (self-hosted)

| Setting | Value |
|---------|-------|
| `MEDIA_BACKEND_MODE` | `self_hosted` |
| `LIVEKIT_SELF_HOSTED_URL` | `wss://voice.transovo.ai` | <!-- pragma: allowlist secret -->
| `LIVEKIT_SELF_HOSTED_SIP_HOST` | `voice.transovo.ai` | <!-- pragma: allowlist secret -->
| `LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID` | `ST_acZETLdoDQ8o` |
| `LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID` | `SDR_anLzF5j5kqpU` |
| `LIVEKIT_SELF_HOSTED_OUTBOUND_TRUNK_ID` | see Coolify env |

**Critical:** Inbound trunk must have **no IP allowlist** and **all codecs allowed** (matches cloud). Restrictive trunk `ST_9v6jM2L5ktzr` caused `PROGRESS_TIMEOUT`.

## Telnyx ingress

| Setting | Value |
|---------|-------|
| FQDN connection | `3022029259041408870` ("Transovo LiveKit Inbound") |
| Primary FQDN | `voice.transovo.ai` | <!-- pragma: allowlist secret -->
| SIP To target | `voice.transovo.ai:5060` | <!-- pragma: allowlist secret -->

## Cloud rollback (unchanged — do not delete)

Keep all `LIVEKIT_CLOUD_*` and legacy `LIVEKIT_*` vars in Coolify.

| Setting | Notes |
|---------|-------|
| Cloud project | `sms-6w01zoya.livekit.cloud` |
| Cloud inbound trunk (571) | `ST_niZH3LgKj7Po` (different from self-hosted) |

### Emergency rollback to cloud

```bash
# 1. Repoint Telnyx FQDN to cloud SIP host
npx tsx scripts/rollback-telnyx-fqdn-to-cloud.ts --apply

# 2. In Coolify (transovo-web + transovo-voice):
MEDIA_BACKEND_MODE=livekit_cloud

# 3. Redeploy both services
```

## Capture current live state

Re-export a point-in-time snapshot (no secrets) from production:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/freeze-self-hosted-livekit-snapshot.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/freeze-self-hosted-livekit-snapshot.ts --write docs/snapshots/self-hosted-livekit-working-latest.json
```

## Observability notes

MCTB SIP (Press-1) does **not** create `voiceCall` rows. Successful calls appear as:

- `smart_routing_sms_consent_events` — `metadataJson.path = "livekit_sip_mctb"`
- `missed_call_events` — `callerE164`, `businessE164`, `status = SENT` (after SMS)

Trace recent 571 activity:

```bash
npx tsx scripts/mctb-trace-recent-571-calls.ts +15714073615 24h  # pragma: allowlist secret
```

## Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/freeze-self-hosted-livekit-snapshot.ts` | Export rollback snapshot |
| `scripts/mctb-trace-recent-571-calls.ts` | DB + Telnyx + LiveKit trace |
| `scripts/mctb-trace-pipeline.ts` | Telnyx CDR + cloud vs self-hosted diff |
| `scripts/compare-livekit-cloud-vs-selfhosted.ts` | Side-by-side trunk comparison |
| `scripts/fix-self-hosted-trunk-match-cloud.ts` | Rebuild trunk if allowlist/codecs regress |
| `scripts/rollback-telnyx-fqdn-to-cloud.ts` | Emergency FQDN rollback |
| `scripts/sync-phone-livekit-trunk-ids-from-env.ts` | Align phone `settingsJson` with env trunk IDs |
