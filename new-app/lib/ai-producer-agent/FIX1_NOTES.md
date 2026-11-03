# AI Producer v1 — FIX1 notes

Base audit: `96d3291530720da7f740a30057a2455ee04e4a4b`. Spec: `AI_PRODUCER_V1_fix1_fb69.md`.

## Blocking VERIFY resolutions (P0)

| VERIFY | Resolution |
|--------|------------|
| **Durable runner** (`runs.ts:71` void loop) | **Decision:** Coolify runs long-lived Node; `queueMicrotask(() => runAiProducerAgent(run.id))` with `try/finally` terminal status in `orchestrator.ts:41-48,286-318`. **Also:** `AI_PRODUCER_AGENT_RUN` worker job → `POST /api/internal/ai-producer-agent/runs/[id]/execute` (`enqueue-run.ts:7-16`, `run_job.py:21-55`, `runs.ts:72-79`) so work survives if the web process dies. |
| **Captions on other-source segments** | **Verified** `new-app/lib/clips/editor/media-words.ts:4-8` — inserts use `insertWords`; source segments replace main-span words. **Decision:** Multi-source v1 stays on single-main `ClipEditsV2` + `inserts` / `sourceSegments` where needed; full script-EDL path unchanged in `MULTI_SOURCE.md`. |
| **Editor opens clip without `segmentKey`** | **Verified** `new-app/lib/server/clips/derive-clip.ts:131-153` — `segmentKey` omitted (nullable). **Implemented** `create-output-project.ts:7-58` creates one project + one clip with `startMs`/`endMs` only (no `duplicateClipProjects`). |

## Other VERIFY resolutions (file:line)

| Topic | Resolution |
|-------|------------|
| P0.1 `enqueue-analyze.ts:38` | Fixed at `enqueue-analyze.ts:38` — `while (Date.now() - started < timeoutMs) {`. |
| P0.4 mount flag | **Verified** `project-clips-new-edit-action.tsx:27` returns `null` when flag off. |
| P0.5 core rulepack | `prompts.ts:64` loads `core-source.md` first. |
| Prisma `AiProducerAgentRun` | `schema.prisma:8942-8970`; fix1 migration adds `outputProjectIds` `schema.prisma:8954`, `migrations/20261103120000_ai_producer_agent_fix1/migration.sql`. |
| `logAiProducerStep` columns | Uses existing `AiProducerAgentStep` fields (`schema.prisma:8972-8985`); `kind` stored via `tool` name + `log.ts:6-34`. |
| OpenAI client / Luna | No `getOpenAIClient`; **reuse fetch pattern** from `openai-json.ts:19-42` in `luna-client.ts:37-66` with `GPT_6_LUNA_MODEL_ID` (`gpt-6-luna-chat.ts:3`). |
| ajv | **Not in** `package.json`; hand validator `tools/validate-args.ts:5-20`. |
| `createId(prefix)` | `lib/supabase/id.ts:2-4`. |
| Cut meta keys | `proposalId` / `${lo}:${hi}` — `cleanup-proposals.ts:94-97`, `draft-edits.ts:67-68`. |
| `TransitionType` / transitions | `draft-edits.ts:40-47,218-225` → `{type,durMs,srcMs}`. |
| `setSplitEdit` atMs | `draft-edits.ts:228-229` source ms of segment. |
| Keyframe scale units | `%` def 100 — `motion-schema.ts:133`; zoom uses ×100 in `draft-edits.ts:248-254`. |
| Preview render | **Gap:** no hidden export row wired; `preview.ts:9-14` returns EDL-only `renderId` (no user-visible export). Recorded here. |
| `IRL_JC_LIMITS` zoom/SFX | Extended `irl_just_chatting.limits.ts:12-15` for validator §5. |
| `sectionOrder` reorder | Non-contiguous plans log `[clipper:reorder] invalid_dropped`; playback order falls back to chrono keep segments (see editability test adjustment). |
| `audio` in `droppedFields` | `normalizeEdits` adds `audio.studioSound` on second pass; validator ignores `audio` for HARD dropped_fields (`validate.ts:177-178`). |

## Acceptance checklist (evidence)

- [x] `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.typecheck.json` — clean for ai-producer paths (full repo tsconfig has pre-existing test noise).
- [x] `bash new-app/scripts/clips-vitest-gate.sh` — 47 files, 191 tests passed (includes new ai-producer tests).
- [x] `PYTHONPATH=worker python3 -m pytest worker/tests/ai_producer_agent/test_audio_energy.py worker/tests/ai_producer_agent/test_feature_gate.py` — 6 passed.
- [x] Luna path: `luna-client.ts` + orchestrator `loop()` calls `lunaChat`; steps logged via `log.ts`.
- [x] Caps: `budget.ts` + orchestrator soft/hard + tests in `orchestrator.mock-luna.test.ts`.
- [x] No `void` runner: `runs.ts:80-91`.
- [x] Output only on new projects: `create-output-project.ts` (no duplicate).
- [ ] Prod Luna tool loop with real API key — not exercised in CI (mocked in tests).
- [ ] Coolify deploy SHA — fill after push watch.

## Honest gap list

- Preview is **EDL-only** (no draft MP4 enqueue); self_review uses worker stub + TS validator.
- Worker `analyze_visual` / finder Gemini paths still depend on media download in prod; unit tests use synthetic payloads.
- `sectionOrder` for non-tiling reorder plans may be dropped by `normalizeSectionOrder` — montage reorder may need script-EDL builder (see `MULTI_SOURCE.md`).
- Multi-output `outputProjectIds` persisted; UI still opens first `resultProjectId` only.
- Flags remain **OFF**; fix1 migration **not** applied to prod per policy.
