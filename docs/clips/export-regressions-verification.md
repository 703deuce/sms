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

### Prod verification (2026-11-02, merge `c4d862b`, worker `t48-au33-v1-c4d862b196bc`)

| Render | Hash prefix | Stems | MD5 (720p) | Notes |
|--------|-------------|-------|------------|--------|
| `rnd_8f8cba…` | `t47-v2` | no | (5757499 B) | Cached pre-fix hash |
| `rnd_2a41e30e…` | `t47-v2` + deliver JSON | yes | `61572c9e…` | Re-encode under old hash |
| `rnd_2ccd6714…` | `t48-au33-v1-c4d862b196bc` + `:stems=1` | yes | **`61572c9e…` (identical)** | Fresh job after cache-key deploy |

- **Cache hypothesis confirmed:** 720p exports under `t47-v2` reused READY rows; stems export without `:stems=` in material could still collide on deliver JSON variant.
- **Full-mix RMS** at 0.1 s steps matches between `rnd_8f8cba` and `rnd_2a41` at sampled times (voice-dominated; music fade not visible on master bus).
- **Music stem** from `rnd_2ccd6714…` **does** show AU-33 fades: fade-in by ~2 s (`music.wav` −inf → −47 dBFS @ 2 s); fade-out last 3 s (`−32.8 dB @ 38 s` → `−100 dB @ 39 s` → silence @ 40.5 s).

**Follow-up:** Set `CLIPS_WORKER_GIT_SHA` on the **web** container (Coolify env + redeploy) so TS hash matches worker (`c4d862b196bc`); until then web uses `…-unknown` suffix while worker uses full SHA (both still invalidate `t47-v2`).
