# Spec: speed up self-hosted Motion Studio render completion

Owner handoff for ChatGPT. Read-only diagnosis of job
`msaj_fef36425-0c83-4639-9f81-8ddd1f8d3895` (Keith Murray, 2-minute film,
24 × 150-frame segments, 854×480 @ 30fps, CPU mode) on the sms self-hosted
render worker. Do **not** treat this as permission to deploy, restart,
merge, or change production. Propose a PR on
`feat/self-hosted-motion-render-20261120` (deployed commit `9c42f9d`).
All times below are America/New_York (ET).


## Owner priorities and requirements (Rick, Nov 20, 2026)

These override anything below if they conflict.

### A. Show the MP4 in Transovo the moment it is rendered (top priority)

As soon as the master MP4 passes technical QA and is uploaded, it must
show up in the customer's Transovo project as the finished, watchable
video right away (about 1:41 PM ET on the Keith Murray job, not
1:56). The customer must not wait for the editable project files.

- Mark the job and project as viewable / delivered for watching (player
  shows the video, `resultKey` set, customer notification sent if one
  exists) at master-ready time.
- Run editable publishing in the background **after** that. Show a
  small "editable version still preparing" state only for the
  editable download or open-in-editor action, never blocking the video.
- If editable publishing fails or retries, the watchable video stays
  delivered. Retry the editable publish on its own (bounded retries,
  then alert the owner); never roll back or hide the MP4.
- Record `masterReadyAt` (or equivalent) separately from `completedAt`.

### B. Fix order

1. Video-first delivery (A).
2. Content-hash (sha256) storage reuse in `publish_editable`.
3. Bounded parallel uploads for anything not reusable (for example 6–8 at once).
4. Upload/commit-only retries for segments. Never re-capture a segment
   just because its upload or commit failed.
5. Separate video-ready milestone (covered in A).
6. Reap Chrome child processes (`tini` / `--init` or a subreaper).
7. Secret-free stage logs: stage names, durations, retry counts and
   errors, never credentials, bearer tokens or signed URLs.

### C. Safeguard for reuse

Being inside the uploaded `render_bundle_v1.zip` does **not** mean an
asset is registered separately in storage. Only skip an upload when the
individual asset already exists as its own object **and** has a valid
storage receipt / artifact record (state ready, matching sha256 and
size). Otherwise upload it. Never mark an editable asset ready based on
the ZIP alone.

## What looked slow, and what actually was

Submit `2026-11-20T13:28:36.595786-05:00`. DB `completedAt`
`2026-11-20 18:56:03.052 UTC` = **1:56:03 PM ET**. Elapsed **27 min 27 s**.

Earlier tests on this same 4 vCPU box ran about 4–6 minutes per film
minute when clips-worker was idle, so a 2-minute film was expected in
about 10–12 minutes.

The expectation was right for **when the master MP4 became watchable**.
It was not right for **`completedAt`**, which also waits for
`publish_editable()` to re-upload the whole producer package, one file
at a time.

| Milestone (ET) | What happened |
|---|---|
| 1:28:36 PM | Producer submitted the job (`submit.json`) |
| 1:28:39 PM | Bundle `render_bundle_v1.zip` (161 MiB) registered in B2 |
| 1:29:20 PM | First Chromium processes spawn (bundle downloaded + extracted) |
| 1:29:20–1:38:46 PM | Segment capture (24 segments, 2 workers, **2 upload-failure re-renders**) |
| 1:38:46–1:40:14 PM | Concat + master encode (libx264 medium CRF 16 + loudnorm) |
| 1:40:14–1:40:40 PM | Master upload starts (56.5 MiB) and finishes; share encode/upload starts (5.1 MiB) |
| ~1:41:04 PM | QA + `approveMaster`. Progress message already says “Video ready to watch; preparing editable version” |
| 1:41:04–1:56:03 PM | `publish_editable()`: 84 serial asset uploads (~133 MiB), including a **4 min 38 s stall** |
| 1:56:03 PM | `POST /complete` and `completedAt` |

Rough split of the 27.5 minutes:

1. **Bundle upload (producer → B2):** ~3 s (already done at submit).
2. **Queue wait:** none. Worker was idle (`queue.json` running=null when inspected later). Consume loop is 1 s, so at most ~1 s.
3. **Bundle download + extract (worker ← B2):** **~44 s** (1:28:36–1:29:20). 161 MiB zip, 171 MiB unpacked, 212 files. Host `sar` in the 1:20–1:30 PM bucket shows elevated eth0 receive (~571 kB/s averaged over 10 minutes, consistent with a short burst download).
4. **Segment render + segment uploads:** **~9 min 26 s** (1:29:20–1:38:46). About **4.7 minutes per film minute**, inside the 4–6 minute band. Two segments were re-rendered after B2 commit failed (see below), adding roughly one extra wave (~30–40 s), not the 15-minute gap.
5. **Concat, master encode, share encode, master/share upload, QA:** **~2 min 18 s** (1:38:46–1:41:04). No evidence this was the outlier. QA on 9c42f9d is technical only (frame count, duration, resolution, fps, full decode, silent-audio check). Loudness is informational; the black-frame reject is already gone.
6. **Editable publish + complete:** **~15 min** (1:41:04–1:56:03). **This is where the extra time went.**

The customer-visible MP4 (`resultKey` = `master_cpu.mp4`, 59,247,753 bytes)
was therefore ready around **1:41 PM ET, ~12.5 minutes after submit**.
`completedAt` is 15 minutes later only because editable publish is
synchronous and is required before `/complete`.

## Why publish_editable took 15 minutes

There is no `portable.json` in this job’s `render_bundle_v1.zip`, so
`pipeline.publish_editable()` walks `package.json` assets and calls
`prepare_upload()` once per blob, **serially**.

Evidence from `MotionStudioAgentJob.artifacts` (113 entries):

- 1 bundle + 26 segment artifacts (24 ready + 2 left `pending`) + 1 master + 1 share + **84 editable-like assets**.
- Editable uploads are almost perfectly periodic: a 265-byte `index.html` still takes **~6–8 s**. That is not transfer time. Each file does: prepare (B2 createUpload + DB write of the growing artifacts JSON) → PUT → commit (`completeUpload`, `getObjectSizeBytes`, sometimes a SHA-256 re-read, `studioAsset` upsert, another artifacts JSON write). All of those are remote (app 1 → B2 and Supabase) and happen one after another.
- 84 × ~7 s ≈ 10 minutes, plus five ~23 MiB wavs (~10 s each) and a 9 MiB `.frames` file, plus the stall below, ≈ 15 minutes.
- Those 84 files / 133 MiB are largely bytes **already in the 161 MiB bundle that was sitting in B2 at 1:28:39 PM**. The worker re-uploads mix.wav, narration, music, sfx, footage audio, photos, fonts, per-scene `layers.json` / `index.html` / `editable-elements.json`, and scene bundles instead of copying or deep-linking the objects already stored.

Mid-publish stall: a 3,092-byte `layers.json` was prepared at **1:43:00 PM**
and left `pending`. The **same SHA-256** was prepared again and marked
`ready` at **1:47:38 PM** — a **4 min 38 s** gap. App 1 did **not** log
the “Uploaded size does not match the prepared object.” error for this
one (that log line appears only at 1:29:53 PM and 1:38:12 PM, matching
the two segment failures). Worker has no logs, so the exact HTTP error
is unknown. Best fit to the code: `pipeline.api()` retries prepare/commit
on timeout or 5xx (timeout 120–180 s, exponential sleep, up to 8 attempts).
`prepare` with `resume: true` only reuses an artifact that is already
`ready` with the same sha256; a leftover `pending` row is ignored, so a
retry of `prepare` creates a new UUID and orphans the first. Two ~120 s
timeouts plus backoff is enough to explain ~4.6 minutes. Host `sar` in
the 1:40–1:50 PM bucket shows ~80% idle and ~0% iowait, so this was not
CPU or disk; it was waiting on B2/API.

After 1:47:38 PM the serial uploads resume at the same ~7 s cadence
until the last font at 1:55:50 PM, then `/complete` at 1:56:03 PM.

## Segment retries (minor, but a real bug)

App 1 logged twice:

```
[motion-studio:api] request_failed {
  type: 'MotionStudioError',
  detail: 'Uploaded size does not match the prepared object.'
}
```

at 1:29:53 PM and 1:38:12 PM ET.

Matching artifacts (same bytes and sha256 on the pending and ready
rows):

- `modal_seg_v1_cpu_00000000_00000150.mp4` — pending 1:29:47, ready 1:30:22
- `modal_seg_v1_cpu_00003300_00003450.mp4` — pending 1:38:06, ready 1:38:46

Commit in `new-app/lib/server/motion-studio/agent-bridge.ts` calls
`completeUpload` then `getObjectSizeBytes` and throws 400 if the stored
size does not match the prepared size. A 400 is **not** retried by
`pipeline.api()` (only 429/5xx/connection). `server.py` then retries the
**entire** `capture_segment()` (new Chromium, new encode, new upload) up
to 3 times. The second encode produced the identical sha256, so the
pixels were fine; only the first commit failed. That cost ~30–40 s each
and explains 26 Chromium launches / 13 waves for 24 segments (zombie
start times line up with the upload timestamps).

Likely causes to investigate in the upload path: B2 eventual consistency
between `completeUpload` and `getObjectSizeBytes`; a signed PUT / TUS /
multipart that commits before all bytes are visible; or a retry of
`prepare` that leaves a short/empty object on the first key. `resume:
true` does not resume a `pending` row.

## What was not the cause

- **clips-worker / clips-worker-stream:** both `poll idle queued_jobs=0`
  for the entire 1:20–1:56 PM window. Not contended this time.
- **OOM / memory cap:** worker limit is 5 GiB RAM with `MemorySwap` equal
  to `Memory` (no container swap). `OOMKilled=false`, container started
  11:39:12 AM ET and was not restarted. No kernel OOM in dmesg/journal
  during the window. Host memory was ~22–27% used; swap was already
  ~3.3 GiB / 27% before the job and did not grow.
- **Disk pressure:** host disk was ~87% (threshold to *pause* new work is
  90%). `sar` iowait stayed ~0.03%. Job was not in the disk-wait loop.
- **Queue backup:** one film at a time; this job went straight to running.
- **CPU starvation from CpuShares=256 or RENDER_NICE=10:** during segment
  render (1:30–1:40 PM bucket) host was **48.7% nice, 40% idle**, load
  3.69 on 4 CPUs. The nice 10 worker was getting CPU; other containers
  were not crowding it out (`%user` ~4–5%). Two segment workers left
  about 40% of the box idle on purpose. Raising `RENDER_SEGMENT_WORKERS`
  from 2 to 3 might shave a few minutes off capture, but that is not the
  15-minute gap, and Chrome memory must stay inside the 5 GiB cap.
- **QA design checks / black-frame reject:** already removed in 9c42f9d.
  This job passed QA; no `qa_frame_cpu.png` was uploaded.

## Why `docker logs` is empty

This is by design plus an omission, not a Docker logging misconfig.

- Image command is `python3 -u /opt/motion_render_host/server.py` with
  json-file logs (`max-size=10m`, `max-file=3`). The log file exists and
  is **0 bytes**.
- `Handler.log_message` in `worker/motion_render_host/server.py` is a
  deliberate no-op so request URLs, headers, and job tokens never go to
  stdout.
- `pipeline.py` also never prints (comment: “Never print argv”).
- There is **no** secret-free stage log (stage name, segment index,
  elapsed seconds, retry count, non-URL error class). The README says
  “store and rotate logs without tokens” but that was not implemented.
- Per-job scratch under `/work/job_*` is deleted when the job finishes,
  and `queue.json` only keeps `{running, queue, stages}` — no timings.
  After this job, `/work` had only `queue.json`
  (`msaj_fef36425-…: completed`, `msaj_9b841a11-…: failed`) and an empty
  `/work/tmp`.

That is why this investigation had to reconstruct the timeline from B2
upload ids (`_mHHMMSS_` and `_u<epoch-ms>`) in `artifacts`, leftover
defunct Chromium start times, app 1 error logs, and `sar`.

## Leftover Chromium zombies (fix, not the slowness)

The worker process is **PID 1**. Python does not reap orphan children.
`capture.mjs` launches puppeteer/Chromium; `chrome_crashpad` and
`chromium` stay `<defunct>` (STAT `ZN`). At inspection time: **152
zombies**, 0 live Chrome, 158 processes total.

- ~48 zombies started 11:42–11:46 AM ET (6 waves, consistent with a
  leftover 12-segment run after the worker was deployed; likely the
  earlier failed Streamer Awards job `msaj_9b841a11-…` being retried
  from `queue.json` — do not redeploy to “clean” this).
- 104 zombies started 1:29:20–1:38:14 PM ET during Keith Murray
  (26 launches × typically 2 chromium + 2 crashpad).

Zombies use no CPU or RSS. `PidsLimit` is 1024, so this job was not
near the cap, but a few more films will be. Add `tini` (or another
init) as PID 1, set `PR_SET_CHILD_SUBREAPER`, and/or reap in the
Python server. Do not restart the live worker just to clear zombies
unless Rick asks.

## Concrete code changes requested

Keep the worker private, one film at a time, no public port, no new
secrets in logs, no design QA, no customer-facing “looks dark” warnings.
Stay on the existing job API. Do not log URLs, tokens, or headers.

### 1. Stop blocking “video ready” / `completedAt` on serial editable publish

In `worker/motion_render_host/server.py` `do_render`, after
`approveMaster` the worker already POSTs progress 90: “Video ready to
watch; preparing editable version”. That is the customer-visible moment.

- Record and expose a `masterReady` (or similar) timestamp in
  render-status when `approveMaster` succeeds, so “how long did the
  render take?” is not confused with `/complete`.
- Make `publish_editable` much cheaper (items 2–4) so `/complete` follows
  within about a minute on a package this size, rather than 15 minutes.
- Do not skip publishing the editable package; the editor still needs it.
  Just do not re-upload 133 MiB serially, and do not stall 4+ minutes on
  one 3 KB file without a tight retry of the *upload*, not the film.

### 2. Do not re-upload bytes that are already in B2

`publish_editable()` should, in order:

1. If `portable.json` exists, keep the current fast path (one POST).
2. Otherwise, for each asset sha256, **reuse** a `ready` artifact already
   on this job (the render bundle, or any prior ready blob with the same
   sha256/bytes/mime). The prepare `resume: true` path almost does this
   but only when filename/kind/mime also match and only for `ready` rows.
   Extend it so a blob already stored under another filename, or still
   `pending` with the same sha256 after a verified object size, can be
   reused or completed instead of opening a new upload.
3. Prefer a server-side copy / “attach existing object” action over a
   second PUT of the same bytes. The 161 MiB bundle is already on the job
   at `render_bundle_v1.zip`.

Add a producer-side option to include `portable.json` in the bundle so
the worker can skip the per-blob loop entirely. That is already
supported; this job simply did not have the file.

### 3. Upload remaining new blobs with a small pool, not one-by-one

If some blobs still must be uploaded, use a small ThreadPool (e.g. 4)
with the same secret handling as today. A 265-byte file should not take
7 s of wall time because it is standing in line behind 83 other API
round trips. Cap concurrency so we do not recreate the B2 503 behaviour
`fetch_file` already backs off for.

### 4. Fix size-mismatch / pending-orphan retries

- After PUT/TUS/multipart, if `commit` returns “Uploaded size does not
  match the prepared object,” **retry commit** (with a short delay for
  B2 to settle) and/or HEAD the object, **without** re-rendering the
  segment and without a new `prepare` UUID.
- `resume: true` should adopt an in-progress `pending` artifact with the
  same sha256/bytes instead of creating a sibling row. Clean up or
  complete orphans.
- For segments, if `ready_url(name)` is not ready but a pending row with
  the same filename/sha256 exists, finish that upload rather than calling
  Chromium again.
- Log a secret-free warning when this happens (filename, prepared bytes,
  observed bytes if present, attempt number).

Investigate `getObjectSizeBytes` immediately after `completeUpload` for
a race. If that is the cause, wait/retry the size check in
`agent-bridge.ts` rather than returning 400 on the first miss.

### 5. Secret-free stage logs and persisted timings

Add stdout lines and a `/work/logs/job_<id>.json` (or fields in
`queue.json` / render-status) with **no tokens, URLs, or headers**:

- enqueue, start, bundle downloaded (bytes, seconds)
- each segment: start, end, seconds, retries, skipped
- join/encode seconds, QA seconds, master/share upload seconds
- each publish batch or per-file: filename, bytes, seconds, retry count
- approveMaster time, complete time

This is the only way the next slow job can be diagnosed without reading
B2 upload ids and leftover zombies. Keep `log_message` muted for HTTP.

### 6. Reap Chromium (init process)

- Use `tini` (or equivalent) as the container ENTRYPOINT so PID 1 reaps.
- Optionally `PR_SET_CHILD_SUBREAPER` in the Python server.
- Confirm `browser.close()` in `capture.mjs` actually waits for the
  process; crashpad zombies today suggest it does not.

Do not raise `PidsLimit` as the only fix. Do not restart the production
worker in this change set unless Rick asks.

### 7. Optional, lower priority: segment workers

`RENDER_SEGMENT_WORKERS=2` is the documented default and was fine for
this film (capture already met the 4–6 min/min band). A later experiment
can try 3 on a clip-heavy 2-minute film, watching the 5 GiB cap. Do not
change the default in the same PR as the publish-path fixes unless
measurements on a replay bundle show a clear win.

## Tests to add (offline, no live job)

- `publish_editable` reuses a ready artifact with the same sha256 and
  does not call storage PUT.
- `prepare` with `resume: true` completes or reuses a pending sibling
  with the same sha256 instead of inserting a second row.
- Segment capture on a mocked size-mismatch commit retries **commit**
  (or upload), not Chromium, and does not increment a capture count.
- Worker stdout / job timing file contains stage names and seconds and
  does not contain `http`, `Bearer`, or the host secret.
- Existing queue, cancel, and QA tests still pass. Do not bring back
  black-frame or LUFS design rejects.

## Out of scope

- Do not merge or rebase PR #1270 / #1271 unless Rick says so.
- Do not switch app 1 off `feat/self-hosted-motion-render-20261120`.
- Do not restart, redeploy, prune, or clear `/work` on sms as part of
  this work.
- Do not log or paste `RENDER_HOST_SECRET` or job bearer tokens.
