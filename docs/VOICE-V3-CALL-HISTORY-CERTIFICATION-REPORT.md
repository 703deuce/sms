# Voice V3 Call History — Certification Report

**Branch:** `cursor/voice-v3-call-history-2304`  
**Base candidate:** `33531dee` / `a2107a87`  
**Certification pass SHA:** _(see git tip after cert fixes)_  
**Production deployment:** NOT performed.

## Decision

**CALL HISTORY PRODUCT CERTIFICATION: FAIL (recording E2E not proven)**

Native transcript + post-call pipeline + storage privacy + auth unit tests **pass** on the real Microsoft booking call (`CALL_ID_SUFFIX=oATFW5UYHFah`). **Telnyx recording → ingest → playback** was **not** exercised on any call with a `VoiceRecording` row (including that production call, which predates the recording hook). **Forced Deepgram** and **channel semantics on real audio** remain **blocked** until a staging PSTN call produces a dual-channel MP3.

---

## 1. Final candidate SHA

See branch tip after certification defect fixes (segment loading, channel mapping, validator, Deepgram API).

## 2. Real Telnyx recording result

**NOT PROVEN.** Call `oATFW5UYHFah` (2026-09-21 21:42–21:46 UTC): `recording: null`, `callHistory.recordingStatus: not_requested`, `telnyxCallControlId: null` (LiveKit ingress path). Recording hook was added after this call.

**Required before deploy:** One staging PSTN call with `telephony.callRecording ≠ off`, then re-run `scripts/cert-voice-v3-call-history.ts` with `PLAYBACK_HTTP=1`.

## 3. Proof both caller + AI audio

**NOT PROVEN** (no durable recording for test call).

## 4. Actual channel semantics

**NOT EMPIRICALLY PROVEN** on audio.

**Code strategy (post-cert fix):**

- Telnyx documents dual stereo: **channel A (index 0) = first call leg**, channel B = remaining legs ([Telnyx `record_start`](https://developers.telnyx.com/api-reference/call-commands/recording-start)).
- Deepgram multichannel transcribes each channel independently.
- **Speaker labels** use `resolveDualChannelSpeakerMap()`:
  1. **Cert metadata** `callHistoryCert.channelMap` (staging override)
  2. **Native transcript token overlap** per channel (preferred)
  3. Low-confidence inbound default (leg-A = caller) only if overlap inconclusive
  4. Else `channel_0` / `channel_1` (no false caller/agent)

## 5–7. Recording duration / Supabase / playback

N/A until §2 passes. **Supabase bucket:** `call-recordings` **exists**, **public: false** (cert script).

## 8. Native transcript (real call)

| Metric | Result |
|--------|--------|
| Forensics final | `true` |
| Canonical turns | 57 (`user`: 36, `assistant`: 21) |
| DB segments | 57 |
| Validator | **VALID** (after segment load fix) |
| Tool/system leak | Not detected in validator sample |

**Defect found:** Prisma-compat `include: { segments }` returned empty while segments existed → pipeline falsely rejected native transcript. **Fixed** via explicit `voice_transcript_segments` queries in post-call pipeline + APIs.

## 9. Native validator decision

**ACCEPT** on real call: caller + agent turns present, ordered, forensics final, no duration-density rule.

**Cert fix:** Removed `too_sparse_for_duration` (silence/tool pauses must not force Deepgram).

## 10. Deepgram skipped on valid native

**YES** — `VOICE_TRANSCRIPT_NATIVE_ACCEPTED` on cert run; no `VOICE_TRANSCRIPT_DEEPGRAM_STARTED` for that call.

## 11. Forced Deepgram fallback

**NOT RUN** — no `READY` recording. Use `FORCE_DEEPGRAM=1` on cert script after staging recording call.

## 12. Deepgram configuration

- Model: `nova-3`
- Multichannel: `multichannel=true` + `utterances=true` when `channels > 1`
- Mono: `diarize=true` + **`diarize_model=latest`** + `utterances=true` (replaces deprecated-only `diarize=true` path)

## 13. Speaker attribution

Logic in `channel-semantics.ts` + `deepgram-fallback.ts` (see §4). **Empirical attribution pending** staging recording.

## 14. Summary result

Generated on real call via `ensureCallHistorySummary` (OpenAI when key present). Persisted `VoiceConversationInsight`. **Defect fixed:** summary loader no longer relies on broken Prisma `include` for appointments/transfers.

## 15–19. Browser UI

**NOT COMPLETED** (computer-use subagent unavailable). **API smoke (authenticated dev bypass):**

- `GET /api/voice/calls` — 200, rows returned, `hasTranscript: true` after fix
- `GET /api/voice/calls/:id` — insights + transcripts; segments load after fix
- `deriveOutcomeBadges` — unit tested; no import error in build path

**Manual UI still required** on staging: list, detail, player, responsive.

## 20. Cross-workspace security

**Unit tests:** `scripts/test-voice-v3-call-history-auth.ts` — PASS (token bind, tamper, expiry).

**Integration:** Session-scoped APIs use `workspaceId` from session; recording stream verifies token `recordingId` + `workspaceId`.

## 21. Environment matrix (this VM)

| Variable | Status |
|----------|--------|
| TELNYX_API_KEY | PRESENT |
| DEEPGRAM_API_KEY | PRESENT |
| OPENAI_API_KEY | PRESENT |
| INTEGRATION_SECRET_KEY | PRESENT |
| Supabase service role (storage) | PRESENT (bucket list succeeded) |
| SUPABASE_CALL_RECORDINGS_BUCKET | MISSING (default `call-recordings`) |
| APP_URL | PRESENT |

## 22. Bucket privacy

`call-recordings`: **exists**, **public: false**.

## 23–25. Timings

Not measured end-to-end (no recording ingest). Post-call pipeline on existing call: native accept + metadata update only.

## 26. Booking regression

`scripts/test-voice-v3-active-agent-demo-fallback.ts` — **PASS**.

## 27. Code changes from certification defects only

- Remove duration-density validator rule; regression test for long silence
- `diarize_model=latest` for mono Deepgram
- Channel mapping via overlap + cert metadata (not hard-coded ch0=caller)
- Load transcript segments without broken `include` (post-call, list API, detail API)
- Summary facts loader without broken `include`
- `materializeNativeTranscriptFromForensicsIfNeeded` (idempotent)
- Cert/helper scripts

## 28–29. SHAs / deploy

No production deployment. Push cert-fix commit and re-run staging PSTN checklist before merge.

---

## Staging checklist (human)

1. PSTN call with distinctive caller phrase + AI reply; recording on.
2. `CALL_ID=... PLAYBACK_HTTP=1 npx tsx scripts/cert-voice-v3-call-history.ts`
3. Per-channel transcript inspection; set `callHistoryCert.channelMap` if needed.
4. `FORCE_DEEPGRAM=1` on duplicate call or cert-only workspace.
5. Browser: `/voice/calls` + detail + play + mobile width.
