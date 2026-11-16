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

- Upload a video, optionally check "Transovo Agent — fully finished clips" and choose maximum clips.
- Standard source processing reaches READY, then the project page sends an idempotent automatic discovery request (when that page is open).
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
