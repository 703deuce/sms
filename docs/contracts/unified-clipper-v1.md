# Unified clipper v1 results-shape contract

Status: **draft** for Frontend (results grid). Version `1`. Workspace-scoped, same auth as existing clip / AI producer APIs. Additive `aiMeta` only; no destructive schema changes.

One clipping run is **one job and one pass**. There is no mode choice. The run finds both Story (stitched) and continuous clips on the **same transcript**, then returns one merged, scored list. Each item is tagged `story` or `continuous`.

No billing and no credit charging. Never show `$`.

`#1111` editorial-safety rules stay in force: `needsReview`, critical drops, chronology / unplanned-jump checks, `unfinished_ending`, `uncovered_cut`, and auto-export only when `needsReview` is false.

Upload, stream, and multi-source Story (`multi_source_story_v1`) keep working. This contract covers the unified single-source clipper only.

## Run request

`POST /api/ai-producer-agent/runs`

The existing create-run endpoint. Unified clipping is selected with `storyMode: 'clip_unified_v1'`. That is the default for new upload and stream clip runs; the mode picker is removed or hidden in the UI.

```ts
{
  sources: Array<{                  // exactly one source
    sourceId: string
    kind: 'stream' | 'upload' | 'clip'
    projectId?: string
    clipId?: string
    storageKey?: string
    rangeMs?: [number, number]
    durationMs?: number
    title?: string
  }>
  outputType: 'story'               // required for clip runs
  storyMode: 'clip_unified_v1'
  platform?: 'tiktok' | 'shorts' | 'reels'
  targetLengthS?: [number, number]  // optional Story preference, 15–105s
  instruction?: string              // max 4000
  exportOnFinish?: boolean          // default true; still gated on !needsReview
  visualEvidenceMode?: 'transcript_baseline' | 'visual_audio'
}
```

`201` `{ data: { runId: string, status: string } }`

`targetLengthS` is a preference for Story clips only. Continuous clips stay in the 15–30s band and may go up to ~60s when the source supports it. Continuous does not inherit a long Story target.

Legacy `clip_moment_v1` and `clip_story_v1` remain accepted so older clients do not break. New Frontend should send only `clip_unified_v1`. Multi-source Story and Clean Take are unchanged and are not unified-clipper runs.

The job is a single `aiProducerAgentRun`. It is not two runs and not two worker jobs. Both candidate passes run inside that one job, on the same transcript, before the merge.

### Upload first, stream later

Regular **upload** clipping is wired to this contract now. After a PROCESS_PROJECT job marks an upload project READY, `maybeAutoStartUploadAgentBatch` starts **one** unified job on the project's full source range via `startUnifiedClipRun` (see `new-app/lib/server/ai-producer-agent/unified-clip-run.ts`). It does not start a per-window streamer batch and does not honor a Story-vs-continuous mode choice.

Stream clipping (Twitch/Kick) is not switched over as the default yet. The same `startUnifiedClipRun` entry point already accepts `kind: 'stream'` (including a prepared window project) so stream can call it later without a second API.


Job states are the existing producer-run states: `queued` → `running` (or `planning` / `applying`) → `done` | `failed` | `capped` | `canceled`. Frontend polls `GET /api/ai-producer-agent/runs/:id` and the results list below.

## Results

Clips are saved on the **source project** (same as today's clip-mode outputs), tagged with `aiMeta.aiProducerRunId`. Frontend can also read them from the project clip list; the run-scoped endpoint below is the contract for the Opus-style results grid.

### `GET /api/ai-producer-agent/runs/:id/clips`

`200` when the run exists in the workspace. `clips` is empty until the run has published outputs. `404` if the run is missing or not in this workspace.

```ts
{
  data: {
    runId: string
    status: string                  // same states as GET /runs/:id
    mix: {
      story: number                 // published Story count
      continuous: number            // published continuous count
      droppedDuplicates: number     // removed for >60% overlap
    }
    overlapThreshold: 0.6
    clips: UnifiedClipResult[]      // already merged, deduped, mixed, ordered
  }
}
```

### `UnifiedClipResult`

```ts
{
  clipId: string
  projectId: string                 // source project; Edit opens this clip
  type: 'story' | 'continuous'
  title: string
  score: number                     // 0–100 virality/quality score
  durationSeconds: number
  startMs: number                   // first segment start in the source
  endMs: number                     // last segment end in the source
  segments: Array<{                 // source ranges, chronological
    startMs: number
    endMs: number
  }>
  needsReview: boolean
  needsReviewReasons: string[]      // empty when needsReview is false
  whyThisClip: string | null
  overlaps: Array<{                 // kept clips that share source time at ≤60%
    clipId: string
    fraction: number                // intersection / shorter clip duration
  }>
  autoExported: boolean             // true only when !needsReview and export ran
}
```

`type: 'story'` means a stitched multi-beat clip from the `clip_story_v1` candidate pass. `type: 'continuous'` means a single uninterrupted 15–30s (up to ~60s) segment from the `clip_moment_v1` pass.

`segments` has one range for a continuous clip and two or more for a Story clip. The existing `aiMeta.stitchSegments` field stores the same ranges.

`needsReview` and `needsReviewReasons` are the fields Frontend's badge already reads (`#1118`). Critical editorial failures are dropped and never appear in this list. Auto-export stays gated on `needsReview === false`.

Preview, play, and download use the existing clip media / export URLs for `clipId`. This contract does not add new media routes.

The same fields are also written onto the clip row:

- `clip.score` — the published 0–100 score
- `clip.aiMeta.type` — `'story' | 'continuous'`
- `clip.aiMeta.needsReview` / `clip.aiMeta.needsReviewReasons`
- `clip.aiMeta.stitchSegments`
- `clip.aiMeta.overlaps`
- `clip.aiMeta.clipMode` — pipeline used (`clip_story_v1` or `clip_moment_v1`)
- `clip.aiMeta.aiProducerRunId`

## Ordering

The list is already final. Default order is **score descending**, then Story before continuous on a tie, then earlier `startMs`. Frontend may still let the user re-sort (timeline, title) in the grid.

## Merge, dedupe, and mix

Both passes reuse the existing pipelines in `new-app/lib/ai-producer-agent/clip-mode/`. `#1111` editorial-safety checks run on each candidate **before** the merge. Same-type overlap inside a pass may still use the current in-pass filter (35%). The rules below apply to the **unified merge**.

### Overlap / duplicate threshold

Overlap fraction = intersection of source time across all segments, divided by the duration of the **shorter** clip (sum of its segment lengths).

- If two clips share **more than 60%** (`overlapFraction > 0.6`), they are treated as duplicates. Keep the higher-scoring clip. On a score tie, keep the Story clip (lean toward Story). The other is dropped and counted in `mix.droppedDuplicates`.
- Overlap **at or below 60%** is allowed when the clips are clearly different (for example a continuous moment that also appears inside a longer Story clip). Both stay, and each lists the other in `overlaps`.

The threshold is `0.6` exactly, documented here and in the PR. It is not configurable in v1.

### Story-majority mix

Story clips should be the **majority** of the published list, with continuous clips filling in distinct moments.

1. Start from editorial-safe candidates of both types, after the 60% dedupe.
2. Keep every remaining Story clip.
3. Add continuous clips by score, skipping any that would violate the 60% rule against a kept clip, until continuous would stop being a fill-in (published Story count must be strictly greater than published continuous count whenever at least one Story clip survived).
4. If no Story clip survived editorial safety, ship the valid continuous clips rather than inventing Story results.
5. Never drop a Story clip only to change the mix. Never invent a clip to force a majority.

A typical outcome is more Story than continuous (for example 6 Story + 5 continuous). Counts vary with the source.

## Gap rules (Story stitches)

A Story clip may join beats that are far apart in the source. A jump of **5 minutes or more** (`LONG_SOURCE_GAP_MS = 5 * 60_000`) is treated as a planned chronology jump only when both sides map to **adjacent beats** in that run's story plan, and the landing line is a self-contained sentence start. Unplanned 5+ minute jumps, or a planned jump that lands on a context-dependent line (for example "Talk to me."), stay critical and are dropped. Planned-but-flagged long gaps may publish as `needsReview`.

There is no separate maximum gap beyond that editorial check: if the beats are adjacent in the plan and the landing is self-contained, the stitch may span more than 5 minutes. See the PR body for the comparison with publicly described Opus Clip behavior and the choice we made.

## Error codes

Existing producer-run errors still apply, including `clipper_agent_requires_one_source_and_story_output` and `clipper_agent_target_must_be_15_to_105_seconds`. Auth failures use the existing workspace 401/403 behavior.

| HTTP | When |
|---:|---|
| 400 | Invalid source list, output type, target length, or body |
| 404 | Run missing or not in this workspace |
| 409 | A producer run is already in progress for this workspace |

No `$` in error messages.
