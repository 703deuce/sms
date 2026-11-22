# Transovo Agent clipper — producer contract v1

Status: Transovo web/API bridge committed. Producer runtime must implement the new actions before this is live. Do not replace the Motion Studio create_video or revise_video flows.

## Purpose

One Grok director works from the customer's source video and independently chooses the strongest moments, scores them, cuts them, reframes speakers, adds custom story-specific motion graphics, captions and effects, then produces finished social clips. It can use and layer any available engines. Keep the original speech and picture truthful and central to the edit. No separate specialist agents.

## Webhook

The application submits an HTTPS JSON POST to GROKBOT_WEBHOOK_URL with the configured GROKBOT_WEBHOOK_KEY. Body includes:
- action: clip_and_finish OR finish_clip
- version: 1
- jobId, projectId, optional clipId
- jobToken, jobUrl, callbackUrl
- source: {url,filename,mime?,startMs,endMs,durationMs}
- mode: autonomous_clipper OR source_footage_enhancement
- direction, aspectRatio, fps, quality, mediaPolicy, webResearch
- for clip_and_finish: maxClips, targetDurationsSeconds

Grok should immediately save the inbound assignment. Acknowledge with HTTP 2xx and process asynchronously. The source URL is temporary; download it early. Never expose bearer tokens.

## Authenticated callback endpoints

Use Authorization: Bearer {jobToken} on every callback.

GET /api/clips/agent/jobs/{jobId} — job status.
POST /api/clips/agent/jobs/{jobId}/progress — {stage,percent,message}.
POST /api/clips/agent/jobs/{jobId}/assets — upload prepare/commit.
POST /api/clips/agent/jobs/{jobId}/complete — {status:"complete",durationMs:N} or {status:"failed"}.

Supported progress stages: selecting, editing, graphics, review, rendering, delivering, complete.

## Upload protocol

For each artifact:
1. POST /assets with {action:"prepare",kind,filename,mime,bytes}.
2. Upload the file bytes via the returned signedPut, tus or s3Multipart destination.
3. POST /assets with {action:"commit",uploadId,parts?}. Supply multipart ETags when needed.
4. Wait for ready confirmation.
5. Up to 100 artifacts per job and 2GB per file. JSON highlight manifest <=2MB.

Only committed files can appear in completion records.

## clip_and_finish (full source, autonomous discovery)

Grok watches/listens to the full source and picks its own moments, including visual-only highlights. It scores hook, payoff, speech continuity, action, and usefulness. It produces up to maxClips finished, separate MP4s and uploads them as kind video, MIME video/mp4.

Also upload a JSON file named highlights.json, kind project, MIME application/json. Example:

{
  "clips": [
    {
      "filename": "highlight_1.mp4",
      "title": "A complete highlight",
      "startMs": 142000,
      "endMs": 195000,
      "durationMs": 42000,
      "score": 93,
      "why": "Strong hook, context and payoff"
    }
  ]
}

Times startMs/endMs are ABSOLUTE in the original uploaded source. durationMs is the final produced MP4 duration, even if pauses were cut. Scores must be integer 0 to 100. The filename must equal a committed MP4 filename. Submit POST /complete with {status:"complete"} after all uploads are ready.

On completion, the API creates independent clipper clips with original source ranges, scores, finished video previews and editor links. The old scored clips (if any) remain.

## finish_clip (selected clip from existing clipper)

Grok receives the selected clip's original source URL, local/absolute source bounds, score and editorial brief. It should retain the voice and meaningful action, trim unnecessary pauses, intelligently frame speakers, choose split or stacked layouts when useful, and add custom motion graphics. The director selects engines; don't enforce a fixed template or engine count.

Upload one video/mp4 artifact, kind video. Send POST /complete with {status:"complete",durationMs:<finished video length>}.

To retain fully editable layers, also upload project.json using the existing transovo.motion-project/1 tracks/elements contract and reference separately uploaded visual/audio assets by filename. The app attempts to register native media and import the timeline without overwriting the original source audio. If the manifest fails, only the finished MP4 is delivered; do NOT claim full timeline parity.

## Product flow

- Upload a video, optionally check "Transovo Agent — fully finished clips" and choose maximum clips. This mode does not also invoke the legacy clip-scoring worker.
- For new opted-in video uploads, the project becomes source-ready immediately and skips the legacy clipper worker. When the project page opens, it sends a stable-idempotency discovery request.
- Or click "Create finished clips" on a ready source project to make an autonomous Grok run.
- Or select existing ranked clips and click "Finish top/selected clips" to enhance them without rerunning moment detection.
- Progress is polled; delivered MP4s appear with scored result cards and downloadable video.
- Manual editor keeps the original footage; agent output versions and editable manifest layers are non-destructive.

## Deployment prerequisites and acceptance

1. Apply additive clip_agent_finish_jobs migration and regenerate Prisma Client.
2. Grok webhook MUST implement clip_and_finish and finish_clip actions. It currently cannot be assumed to know them.
3. Configure the existing webhook key/public origin and GROKBOT_LIVE_MODE=1.
4. Verify a 5-minute podcast upload produces 2–3 independent clips with relevant speaker framing and motion graphics.
5. Verify solo talking-head and sports footage, including silent visual moments.
6. Verify manifests/timings, status updates, downloads, version retention, editor behavior and worker output parity.
7. Verify webhook retries, parallel asset uploads, auth, rate limits, and failure recovery.

This code has not been live-tested against the producer. Do not describe the feature as certified or completely production-ready until those tests pass.

## v2: Deepgram-first producer clipper (flagged)

When `CLIPS_PRODUCER_PIPELINE=1`, ordinary find-clips uploads are transcribed with prerecorded Deepgram Nova-3 (diarize, punctuate, smart_format, utterances, paragraphs), retaining `deepgram.json`, `transcript.compact.jsonl`, `words.json` and a cost record. The clipper coordinator reserves a worker in the **existing Motion Studio registry** under the same advisory lock/physical machine/AI plan budget used by film jobs. Register `clips-produce` (or the existing `motion-studio-produce`) capability. No new secrets are needed.

### Producer assignment

A registered worker receives `{action:"clip_and_finish",kind:"clips",jobId,jobUrl,jobToken,leaseId,workerId,workspaceId,projectId,coordinator:true,delivery:{mode:"mp4"}}` (or `finish_clip` and `kind:"clip_revision"`). The coordinator authenticates the HTTPS webhook with its existing `MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY`. **Do not publish a live-only timeline; output rendered MP4s.** The producer must fetch fresh signed URLs from `GET {jobUrl}/inputs` using `Authorization: Bearer {jobToken}`, which returns the full source URL, Deepgram/utterance/words URLs, clipCount (default 5, maximum 15), targetSeconds (20–60), aspectRatio (9:16 default), requested resolution, caption preset/brand/notes, and source bounds if a one-clip revision. Signed URLs expire: refresh from `/inputs` if necessary. No provider API key belongs in job input.

### Upload protocol and callbacks

Keep the existing `POST {jobUrl}/assets` prepare/commit handshake. Supported kinds and MIME restrictions are enforced by the API; upload images with SHA-256 checksums when kind `image`. For each completed clip, commit:

- `clip_01.mp4`: full-resolution finished edited MP4 (`kind:video`).
- `clip_01.preview.mp4`: completed 480p MP4 (`kind:video`).
- `clip_01.thumbnail.png`: thumbnail (`kind:image`, SHA-256 required).
- `clip_01.json`: `{title,hook,why,sourceStartMs,sourceEndMs,durationMs,speakers,virality:1..10}` (`kind:project`).
- `clip_01.edits.json`: a native editable document (`kind:project`); custom graphic media referenced here must be individually committed.
- Optionally an SRT and separate transparent PNG or WebM overlay artwork, all committed before the clip is published.

After committing, call `POST {jobUrl}/clips` with `{clipJson:"clip_01.json",editsJson:"clip_01.edits.json",video:"clip_01.mp4",preview:"clip_01.preview.mp4",thumbnail:"clip_01.thumbnail.png"}`. This *immediately publishes* one card. Repeat for up to 15 clips. The raw virality (1–10) becomes `clip.score = virality * 10`; both preview and original source ranges are saved. Clip publication is idempotent by job ID + clip metadata filename.

For the final callback, upload/commit `job.json` (with timing and cost report) and send `POST {jobUrl}/complete` with `{status:"complete",jobJson:"job.json"}`. Uploading `highlights.json` and legacy completion remains supported with the flag off. Use `POST {jobUrl}/progress` with `{stage,percent,message}`, or `POST {jobUrl}/fail` with `{reason}` for a terminal error. A run is retried once for lost leases or a 45-minute timeout and then failed with a user-visible reason. Report progress regularly to maintain the lease.

### Native editable timeline

`clip_01.edits.json` must use:

```json
{
  "schema": "transovo.clip-edits/2",
  "edits": {
    "v": 2,
    "trim": {"in":142000, "out":195000},
    "cutRanges": [[160000, 162000]],
    "aspectRatio": "9:16",
    "layout": {"mode":"speaker_follow","shotOverrides":[]},
    "captions": {"enabled":true,"presetId":"bold_pop","animation":"pop","position":"bottom","wordsPerLine":2},
    "textItems": [],
    "keyframes": [],
    "broll": []
  }
}
```

`trim.in/out` and `cutRanges` are **absolute source milliseconds**, with trim matching `clip.json` sourceStartMs/sourceEndMs. `sectionOrder` also refers to source ranges. `textItems`, `keyframes`, `captionLines`, and `broll` time positions are **output milliseconds**. `layout` can carry mode, cropBox, layoutSegments, template boxes, and shotOverrides. `captions` carries style while timestamped per-word input is taken from saved Deepgram clip words; `wordFixes` may correct individual words. Use `hookOverlay` and `textItems` for headlines, names, shapes, and callouts; `zoom` and `keyframes` for punch-ins; `transitions` for cuts; optionally `audio`, `color`, `tracks`, `layerProps`. Custom graphics can be represented as `broll` items `{id,source:"upload",artifactFilename:"artwork.png",startMs,endMs,still:true}`; the app registers them as project media and swaps in an uploadId. For predictable export parity, prefer transparent PNG stills; alpha WebM behavior needs production verification. Never bake captions into the same artwork as native text if you want text-editability.

An invalid/missing edits document must not prevent publishing the finished MP4. The card plays the 480p master, full resolution downloads directly until editor changes; the editor loads normalized native edits with an original version preserved for revert. Note: not every advanced motion/alpha property is yet guaranteed to render identically in worker export, so the producer should use the supported schema rather than claiming perfect round-trip fidelity.

### Deployment limitations

The producer runtime must implement these actions before enabling the flag in production. Run a smoke check on transcription, source sync, clip publication, preview/download, editor/export, lease retry, and per-clip re-run. With flag off, legacy opt-in discovery and `PROCESS_PROJECT` remain available. This document specifies the webhook-facing API, not a claim that the producer bot is deployed or certified.


## Fix 1 — producer handoff and recovery rules (November 22, 2026)

- After Deepgram persists the transcript, the worker enqueues the idempotent `auto-grok-{projectId}` producer job in the **same database transaction** as READY. Dispatch is via the existing coordinator cron and no browser tab needs to remain open.
- The producer transcription uses configured `DEEPGRAM_MODEL` and project `asrLanguage` (English by default), and allows **one** paid attempt; a failure remains FAILED. Audio-only uploads keep the legacy worker.
- Clip producer lease is **15 minutes**. Producer must make an authenticated `/progress`, `/inputs`, or `/assets` callback **at least every 60 seconds**, including during renders; successful calls renew near expiry. The accepted creative job is **never automatically retried** following lost lease or the 45-minute deadline: operations must initiate a manual retry. Only pre-accept webhook dispatch may retry once after **60 seconds**.
- Clip coordinator setup/dispatch failures must not fail the film coordinator cron. The customer sees friendly failures, while redacted operational reasons persist separately.
- New clips and per-clip revisions register the same source overlay assets. Revisions refresh the poster and clip words. Idempotent duplicate clip callbacks do not produce new orphan word objects.
- With the flag off, discovery defaults to **3 clips**, maximum **10**. Finished full-resolution download URLs request attachment disposition and the browser preserves the app tab.
