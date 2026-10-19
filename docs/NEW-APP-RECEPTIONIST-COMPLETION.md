# New-App AI Receptionist V3 — completion status

**Branch:** `cursor/ar-v3-greenfield-f350`  
**Last verified:** `npm run test:receptionist` (new-app) — ALL PASS against local dev on port 3100.

## Delivered in this pass (all three tracks)

### 1. UI glue (Knowledge, Analytics, Test)

| Surface | Route | Backend |
|--------|--------|---------|
| Knowledge | `/app/receptionist/knowledge` | `/api/receptionist/knowledge/{faqs,gaps,sources}` |
| Analytics | `/app/receptionist/analytics` | `/api/receptionist/analytics` |
| Test | `/app/receptionist/test` | `/api/receptionist/test/status` + readiness |

Removed `lib/data` fixture usage on these screens. Test console shows real readiness + worker API reachability; scripted scenarios are labeled as examples (not live LiveKit).

### 2. Scheduling / Voice V3 tools

- **Publish** stores monolith-compatible `VoiceAgentVersion.config` via `map-editor-to-runtime-config.ts` (`advanced.appointmentReceptionistWizard` + `newAppReceptionist` snapshot).
- **Runtime:** `voice-v3-bridge.ts` loads optional `voice-v3-runtime.bundle.mjs` when present (esbuild from monolith `src/`). Without bundle, session/tools use new-app fallback (`update_intake`, `request_callback`, `end_call`) and log `VOICE_V3_MONOLITH_*_FALLBACK`.
- **Build:** `pnpm run bundle:voice-v3` (alias plugin + Prisma shim). Prebuild runs bundle with `|| true` so Coolify builds are not blocked; run bundle manually on release hosts that need full scheduling tools in-process.

### 3. LiveKit provisioning

- **On publish:** `provisionReceptionistLiveKitOnPublish` syncs per-DID dispatch metadata when `phone.settingsJson.telephony.provision` is `livekit_sip` + active trunk (`livekit/dispatch-sync.ts`).
- **Workspace routing:** `providerSyncStatus` / `providerSyncError` updated on `WorkspaceCallRouting`.
- Publish fails closed when LiveKit metadata sync fails after trunk is provisioned.

## Core stack (unchanged)

- Draft / publish / pause / resume / discard — `new-app/lib/server/receptionist/*`
- Python worker → `POST /api/internal/voice-runtime`
- Overview + calls list/detail wired to Prisma

## Follow-up (production hardening)

1. Complete `bundle:voice-v3` graph (trim monolith imports or seal a smaller entry) and commit bundle artifact or run bundle in Coolify prebuild when env allows.
2. Browser PSTN test flow (outbound test call) when Telnyx test credentials are configured.
3. Post-call pipeline (recording, summary, gap extraction) on call completion webhooks.

## Commands

```bash
cd new-app
pnpm dev                    # port 3100
pnpm run test:receptionist
pnpm run bundle:voice-v3    # optional full Voice V3 runtime bundle
```
