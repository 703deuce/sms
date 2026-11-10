# AI Studio v1 API contract

Status: **draft** for Frontend (`/app/studio`). Version `1`. Workspace-scoped, same auth as existing clip editor APIs. Additive Prisma only when the backend lands.

No billing, no credit deduction, no credit ledger. Generate may show a **placeholder credit estimate** (integer credits only). **Never show `$`.** The KIE.ai API key stays in env/Coolify (`KIE_API_KEY`); it is never returned, logged, or echoed.

## Job states

`queued` → `running` → `done` | `failed`

No automatic retries. Frontend polls `GET /api/studio/jobs/:id` (and the history list). A server-side KIE callback may exist later; it is not a Frontend route.

## Model registry shape

Config-driven. Adding or removing a model is one entry. `GET /api/studio/models` returns this document. Frontend uses `id`, not provider keys.

```ts
{
  version: 1
  models: Array<{
    id: string                    // stable, e.g. 'veo-3.1-lite'
    label: string
    kind: 'video' | 'image'
    modes: Array<'text_to_video' | 'image_to_video' | 'text_to_image'>
    supportsStartEndFrame: boolean
    supportsReferenceImage: boolean
    aspects: Array<'9:16' | '16:9' | '1:1'>
    durationsSec: number[]        // empty for image models
    resolutions: string[]         // e.g. '720p', '1080p', '1K'
    creditEstimate: number        // placeholder credits; not charged
  }>
}
```

Launch `id`s (v1): `veo-3.1-lite`, `veo-3.1-fast`, `veo-3.1-quality`, `hailuo-2.3`, `seedance-2.0-mini` (video); `flux-2-pro`, `nano-banana`, `nano-banana-pro` (image). **Not included:** Seedance 2.5. Cheapest test defaults: `seedance-2.0-mini` (shortest duration) and `flux-2-pro`.

## Endpoints

All JSON unless noted. 404 if the job is not in the workspace.

### `GET /api/studio/models`

`200` — the registry document above.

### `POST /api/studio/assets`

Multipart reference/start/end frame upload. Reuses existing storage helpers.

`200` `{ id: string }` — pass `id` as `referenceAssetId` / `startFrameAssetId` / `endFrameAssetId`.

### `POST /api/studio/jobs`

```ts
{
  modelId: string
  mode: 'text_to_video' | 'image_to_video' | 'text_to_image'
  prompt: string
  aspect?: '9:16' | '16:9' | '1:1'
  durationSec?: number
  resolution?: string
  referenceAssetId?: string
  startFrameAssetId?: string
  endFrameAssetId?: string
  projectId?: string            // optional editor project to associate
}
```

`201` `{ job: StudioJob }`. Does not charge credits. Honors a per-user concurrency limit.

### `GET /api/studio/jobs`

Query: `limit?` (default 24, max 50), `cursor?`, `status?`, `modelId?`, `projectId?`.

`200` `{ jobs: StudioJob[], nextCursor: string | null }`

### `GET /api/studio/jobs/:id`

`200` `{ job: StudioJob }`

### `GET /api/studio/jobs/:id/output`

Workspace-auth file download for a `done` job (preview/download in the history grid). `404` if not done or not in the workspace.

### `POST /api/studio/jobs/:id/send-to-timeline`

```ts
{ projectId: string, clipId?: string }
```

Adds the generated output to an existing editor/timeline project by reusing the current editor code (does not invent a second edit model). Job must be `done`.

`200` `{ ok: true, projectId: string, clipId: string }`

## `StudioJob`

```ts
{
  id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  modelId: string
  mode: 'text_to_video' | 'image_to_video' | 'text_to_image'
  prompt: string
  aspect: '9:16' | '16:9' | '1:1' | null
  durationSec: number | null
  resolution: string | null
  creditEstimate: number        // placeholder; not charged
  projectId: string | null
  output: null | {
    kind: 'video' | 'image'
    contentType: string
    width: number | null
    height: number | null
    durationSec: number | null
    previewUrl: string          // workspace-auth URL, e.g. /api/studio/jobs/:id/output
    downloadUrl: string
  }
  error: null | { code: string, message: string }
  createdAt: string             // ISO
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}
```

Failed jobs surface the KIE (or validation) error honestly in `error`. Provider payloads and secrets are not included.

## Error codes

JSON `{ error: string, code: string }`.

| HTTP | `code` | When |
|---:|---|---|
| 400 | `INVALID_PARAMS` | Missing/invalid prompt, mode, aspect, duration, resolution, or asset id |
| 400 | `UNKNOWN_MODEL` | `modelId` is not in the registry (or is disabled, e.g. Seedance 2.5) |
| 409 | `CONCURRENCY_LIMIT` | This user already has too many `queued`/`running` jobs |
| 409 | `JOB_NOT_READY` | Send-to-timeline or output download before `done` |
| 404 | `JOB_NOT_FOUND` | Job missing or not in this workspace |
| 404 | `PROJECT_NOT_FOUND` | Send-to-timeline target project missing or not in this workspace |
| 502 | `KIE_ERROR` | Provider rejected or failed the job (message is safe to show) |
| 500 | `STORAGE_ERROR` | Output or reference upload failed |

Auth failures use the existing workspace 401/403 behavior. No `$` in error messages.
