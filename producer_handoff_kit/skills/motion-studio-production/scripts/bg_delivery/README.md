# bg_delivery: render first, editable in the background (Rick, Nov 19 2026)

For LIVE jobs (`delivery.mode:"live"`). The customer gets a playable MP4 as soon as the film is approved; the editable
live package uploads in the background with no agent turns, then the job completes with `delivery:"live"`.

## Run (per job, after approval + final watch)
```bash
K=/workspace/ms_producer_editable; B=/workspace/motion_kit/bg_delivery; J=/workspace/motion_jobs/<jobId>
node $K/producer/bin/publish-live.mjs --spec $J/editable/project.json --out $J/editable/live --job-dir $J --dry-run   # must print PASS
# render the approved master once (SKILL.md section 8 render rules) -> $J/deliver/master.mp4
bash $B/launch.sh $J $J/deliver/master.mp4          # returns when the MP4 is playable; editable upload continues detached
cat $J/deliver_bg/status.json                        # UPLOADING n/total -> PUBLISHING -> COMPLETING -> COMPLETE | FAILED
bash $B/resume-all.sh                                # after any box restart / at the start of every routine run (idempotent)
```
Options: `--no-repack` (upload the publish-live package as is), `--window-hours N` (retry window, default 8).

## Pieces
| File | Role |
|---|---|
| `launch.sh` | repack -> write `deliver_bg/config.json` -> `deliver-master.mjs` (foreground) -> `start-watchdog.sh` (detached) |
| `deliver-master.mjs` | upload master (`kind:"video"`), `assets {action:"approveMaster"}`, progress. Job stays OPEN (no /complete) |
| `deliver-editable.mjs` | worker: receipts-based resume, 8 parallel uploads, backoff+jitter to the window end, `/checkpoint` every 60 s (lease), progress, confirm all `ready`, local validation, `/portable`, `/complete {delivery:"live", portableVersionId, durationMs}` |
| `watchdog.sh` / `start-watchdog.sh` | `setsid nohup` loop, one per job (flock); restarts a crashed/killed worker; stops on DONE/FAILED |
| `resume-all.sh` | restarts the watchdog for every unfinished `*/deliver_bg` (this box has no cron/systemd, so nothing runs at boot by itself) |
| `repack-live.mjs` | packs all scene-bundle files into <=6 MB `.frames` packs (server already slices packs); validates; byte-identical check |
| `manifest.mjs`, `contract/` | manifest build + server validators (read-only snapshot of sms master 83a83d5c) |
| `test/run-tests.sh` | local mock tests (no Transovo calls) |

State in `<J>/deliver_bg/`: `config.json`, `state.json` (resume), `status.json`, `DONE` | `FAILED`, `worker.log`, `watchdog.log`, `master.log`, pids.
Exit codes (worker): 0 done, 3 failed for good, other = crash (restarted). Secrets only from `<J>/secrets/{job_url,token}`; logs redact URLs and tokens.
