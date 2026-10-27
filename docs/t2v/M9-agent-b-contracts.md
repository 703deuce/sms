# M9 — backend contracts (web routes ↔ worker jobs)

Single T2V agent implements both sides on `transovo-build`. Web enqueues; worker handlers live in `worker/clips_worker/t2v/m9_jobs.py`.

## Job types (register in `worker/clips_worker/job_types.py` + `main.py` DISPATCH)

| Job type | Trigger (web) | Payload | Result (callback / job row) |
|----------|---------------|---------|-----------------------------|
| `T2V_EXTRACT_DECK` | `POST /api/t2v/extract/deck` | `{ workspaceId, uploadId, draftId? }` | `{ slides: Array<{ index, title?, narration, notes?, thumbKey? }>, title? }` written to job `result` JSON |
| `T2V_VOICE_CLONE` | `POST /api/t2v/voices/clone` | `{ workspaceId, name, consentAt, consentById, sampleUploadId }` | `{ voiceId, previewUrl? }` + `T2vSavedVoice` row `isClone: true` |
| `T2V_SCENE_AI_IMAGE` | `POST …/scenes/:id/media` `action: ai_image` | `{ workspaceId, draftId, sceneId, prompt, aspect }` | `{ media: T2vSceneMedia }` (kie-image) |
| `T2V_SCENE_AI_VIDEO` | `POST …/scenes/:id/media` `action: ai_video` | `{ workspaceId, draftId, sceneId, prompt, aspect }` | `{ media: T2vSceneMedia }` (broll-gen / KIE video) |

## HTTP routes (web stubs enqueue jobs; B fills handlers)

- `POST /api/t2v/extract/deck` → `{ jobId, status: 'queued' }`
- `GET /api/t2v/extract/deck?jobId=` → `{ status, progress?, result? }`
- `POST /api/t2v/voices/clone` → `{ jobId }` until ready, then `{ voiceId, saved }`
- `DELETE /api/t2v/voices/:voiceId` → ElevenLabs delete + remove `T2vSavedVoice` (clone only)
- `GET /api/t2v/templates` → list (Agent A seeds 12 system rows)
- `POST /api/t2v/templates/:id/apply` body `{ draftId }` → merges **style/settings only** (script/scenes untouched)

## Stock photos (B extends `stock-match.ts`)

`searchT2vStock({ …, mediaType: 'video' | 'photo' })` — when `PEXELS_API_KEY` missing, `photo` returns `[]` (no throw).

Types live in `new-app/lib/t2v/m9-contracts.ts`.
