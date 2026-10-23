# Power Dialer — completion ledger

Statuses: **Not started** | **In progress** | **Implemented** | **Tested** | **Deployed** | **Browser verified** | **Blocked**

Last updated: Phase 4 gap closure + Phase 5 Numbers & Connectivity (batch 3).

## Migration verification

| Migration | Expected | Prod status |
|-----------|----------|-------------|
| `20261023140000_power_dialer_lists_phase3` | ContactList `source`, `archivedAt`, `updatedAt` | Verify via `verify-power-dialer-phase4-migration-readonly.ts` |
| `20261023150000_power_dialer_phase4` | Dispositions, scripts, VM drops, callbacks + attempt columns + `ContactList.filtersJson` | **Repaired** on prod (resolve rolled-back + repair SQL); file in git uses `Workspace`/`Contact`/`ContactList` |
| `20261023170000_power_dialer_phase5` | `power_dialer_detection_events` | Apply on next deploy (`migrate deploy`) |

Read-only script: `new-app/scripts/verify-power-dialer-phase4-migration-readonly.ts`  
Doc: `docs/POWER-DIALER-PHASE4-MIGRATION.md`

## Phase 4 gap closure

| Gap | Status |
|-----|--------|
| Disposition per-row edit / delete / reorder / set default | **Implemented** — API + Settings UI |
| VM drops MediaRecorder + file upload + preview | **Implemented** — `/voicemail-drops/upload` + Settings UI |
| VM mock production guard | **Implemented** — `voicemail-drop-playback.ts` |
| Transcription + AI summary on call detail | **Implemented** — `human-call-transcription.ts` + Call detail via `phone-ui-map` |
| Callback Start call + eligibility | **Implemented** — `/callbacks/[id]/eligibility` + dialer deep link |

## Phase 5 — Numbers & connectivity

| Item | Status |
|------|--------|
| Caller ID resolution (sticky pool) | **Implemented** — `caller-id-resolution.ts` wired in `createWebRtcOutboundCall` |
| Settings Caller ID + Call screening tabs | **Implemented** |
| Number health list + detail API/UI | **Implemented** |
| Free reputation tools subpage | **Implemented** |
| Premium reputation honest placeholder | **Implemented** + probe script |
| AMD / screener events | **Implemented** — `answer-detection.ts` + Telnyx webhooks in `calls-service` |
| Telnyx Number Reputation purchase | **Not done** — probe only |

## Tests

| Script | Result (local) |
|--------|----------------|
| `pnpm run test:power-dialer-phase4` | PASS |
| `pnpm run test:power-dialer-phase5` | PASS |

## Deploy / voice

| Item | Notes |
|------|-------|
| Voice container redeploy | **Not required** unless voice-runtime AMD changes — web handles Telnyx webhooks |
| Browser verified | Pending |
| Live PSTN VM drop / AMD latency | **Could not verify** |

## Could not verify (honest)

- Production read-only migration script after this deploy’s `commitSha`
- Browser UI walkthrough (dispositions drag, VM record, number health charts)
- Live Telnyx AMD on WebRTC outbound legs
- Deepgram transcription on real PD recordings in prod
- Telnyx Number Reputation API provisioned
- Call screening intro playback on real screened phones
- Callback inbound routing documentation on live numbers
