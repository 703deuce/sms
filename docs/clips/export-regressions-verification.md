# Export regressions vs dbe66f23 — verification notes

## 2. Stems + music fade (clip `clip_9e3f8c03`, prod deploy `29012842`)

**Observation (20:02 ET baseline vs post–#936 720p export):** The new 720p MP4 export of `clip_9e3f8c03` on `29012842` is **sample-for-sample identical in loudness** to the 20:02 ET export from before #936 — same RMS envelope every 0.1 s; **music still not fading**. That strongly indicates the export was **served from a cached READY render** (edits hash unchanged) rather than re-encoded by the new worker. That also explains the **missing stems download URL** if the cached row predates stem packing (`stemsKey` null) while the API reused the row.

**Fix (this branch):**

- Render cache key now includes **`CLIP_AUDIO_RENDER_REV` (`au33-v1`)**, **`CLIPS_WORKER_GIT_SHA` (12-char)**, **`:stems=0|1`**, and non-default deliver JSON — see `new-app/lib/clips/render-cache-key.ts`, `export-aspect.ts`, `enqueueRenderClip`.
- Skip READY reuse when stems are requested but `stemsKey` is missing.
- `deploy-worker.sh` syncs `CLIPS_WORKER_GIT_SHA` into Coolify web env (`scripts/coolify-set-clips-worker-git-sha-web.sh`) so web and worker agree after worker deploy.

**Re-render acceptance:** After merge + web restart (or deploy) + worker deploy, export `clip_9e3f8c03` at 720p (with stems if testing EX-16). Measure with:

```bash
python3 worker/scripts/measure_export_rms_envelope.py /path/to/export.mp4 --json
```

Expect **2 s fade-in** (RMS rises in first ~2 s of music bed) and **3 s fade-out ending at 41 s** (RMS drops in last ~3 s before clip end; music window end at 41 s).
