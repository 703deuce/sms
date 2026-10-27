# Streamer reliability acceptance — 10× VOD run log

**Gate:** 10 consecutive **2–6 h** Twitch/Kick paste imports, **0 failures**, before Stage 2 auto-pull.  
**Spec:** `STREAMER-RICK-STAGES.md` § Reliability acceptance.

Fill one block per run after deploy. Attach `[clipper:stream]` log excerpts (no secrets).

---

## Run template

```text
run=__
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
sourceDeletedAt=yes|no
stream_usage_delta_h=__
notes=
log_excerpt_path=
```

---

## Runs

| run | platform | duration_h | projectId | result | notes |
|-----|----------|------------|-----------|--------|-------|
| 01 | | | | | |
| 02 | | | | | |
| 03 | | | | | |
| 04 | | | | | |
| 05 | | | | | |
| 06 | | | | | |
| 07 | | | | | |
| 08 | | | | | |
| 09 | | | | | |
| 10 | | | | | |

**Sign-off:** __________ **Date:** __________ **Worker SHA:** __________
