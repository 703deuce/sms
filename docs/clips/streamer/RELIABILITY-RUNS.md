# Streamer reliability acceptance — one clean VOD run

**Gate (Rick, 2026-10-27):** **One** real Twitch or Kick **2–6 h** paste VOD runs **end-to-end** cleanly (ranked clips, rendered, **exported**, no crash, chunks/source cleaned up) → **Stage 2 auto-pull** is unblocked.  
**Dropped:** 10 consecutive VOD matrix (no longer required).  
**Spec:** `STREAMER-RICK-STAGES.md` § Reliability acceptance.

Fill one block after deploy. Attach `[clipper:stream]` log excerpts (no secrets).

---

## Run template

```text
run=01
date=____-__-__
operator=__
environment=production|staging
platform=twitch|kick
url=(platform public VOD, no sub-only)
duration_h=__
projectId=
vodId=
STREAM_IMPORT=
STREAM_ANALYZE=
STREAM_RENDER=
STREAM_CLEANUP=
project_status=READY|FAILED
clip_count=
exported_clip_ids=(at least one full export download)
sourceDeletedAt=yes|no
chunk_keys_cleaned=yes|no
stream_usage_delta_h=__
notes=
log_excerpt_path=
```

---

## Runs

| run | platform | duration_h | projectId | result | notes |
|-----|----------|------------|-----------|--------|-------|
| 01 | | | | | |

---

## Sign-off

- [ ] Single run meets R1–R5 in `STREAMER-RICK-STAGES.md`
- [ ] At least one clip **exported** with stream template (headline / source bar) if testing polish path
- [ ] Stage 2 work authorized: Twitch EventSub `stream.offline` / `stream.online` + rolling growing VOD; Kick replay poll up to ~90m after offline
