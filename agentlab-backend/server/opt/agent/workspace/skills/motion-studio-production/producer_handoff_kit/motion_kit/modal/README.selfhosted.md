# Producer one-shot render handoff (no direct render-host connection)

Use the existing MOTION_JOB_ID, MOTION_JOB_URL, and MOTION_JOB_TOKEN
environment variables from the active leased job. All URLs to Transovo are
via https://transovo.ai, never an extra host, and credentials are never
printed or included in submit.json.

1. The Producer creates a complete deliver_modal/render_bundle_v1.zip
   containing project.json, a full browser composition with
   window.__scene.seek(t), mixed audio, and native editable metadata.
   The make_bundle.py helper builds directly from the Producer's real
   film/ and editable/live/payload/ files (or validates an existing ZIP).
   It never invents media; verified source and native hashes must match.
   The uploaded original Producer scripts supplied the job-folder contract.
2. Check before submission:
   python3 scripts/render/make_bundle.py --job-dir J --check-page.
   This uses local Chromium/puppeteer-core and verifies three seek frames.
   Provide PUPPETEER_DIR if puppeteer-core is installed outside
   the kit. No paid media call occurs.
3. Default is RENDER_BACKEND=self_hosted and MOTION_MODAL_FALLBACK=0.
   Submit **once**: bash scripts/render/submit.sh J. The wrapper loads credentials from secrets/job_url and secrets/token
   (or state/job_token plus job_id). The script registers
   the ZIP with the existing job-scoped assets API, then asks
   transovo.ai/api/motion-studio/agent/jobs/:id/start-render to enqueue
   it internally. It writes deliver_modal/submit.json and exits.
4. For one manual status read: bash scripts/render/status.sh (no loop).
   After producer handoff the renderer independently records progress,
   QA, master approval, editable publication and live completion.
5. To reuse the existing source job's registered ZIP/segments on a fresh
   approved retry job: bash scripts/render/reuse.sh J2 SOURCE_JOB_ID,
   then submit J2. The helper writes state/receipts.json, reuse_req.json and reuse_resp.json,
   restores the hashed original ZIP, and the submitter derives the
   original segment length from its registered segment names.
   The submitter refuses mismatched intervals.

Settings:

- MOTION_SEGMENT_FRAMES: default 150; preserve the original value for retries.
- DRY_RUN=1: print proposed backend/segment counts; do not upload or submit.
- FORCE_RESUBMIT=1: explicit override after verifying status; do not use
  with an active render unless investigating an abandoned submission.
- MOTION_BENCHMARK_ONLY=1: submit QA-only, without publishing a customer job.
  RENDER_BENCHMARK_ONLY=1 is an accepted alias. Either flag prevents publishing.
- RENDER_BACKEND=modal: explicit fallback; requires installed Modal submit
  tooling and the existing approved budget/rate variables.
- MOTION_MODAL_FALLBACK=1: if the private render-host start call fails
  twice, try the existing Modal submitter, provided Modal's kill switch allows it.

The worker uses a **private** Docker service reachable only by the existing
web app. Producer does not know RENDER_HOST_SECRET or RENDER_WORKER_URL.
Do not run this command and the on-box bg_delivery/launch.sh path together.
