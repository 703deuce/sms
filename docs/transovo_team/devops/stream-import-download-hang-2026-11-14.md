# STREAM_IMPORT download hang — 2026-11-14

Captured **before** killing `job_a454af11` or restarting `clips-worker-stream`.
All times are America/New_York (ET). Log timestamps below also keep the original UTC `Z` values.
URLs, signed query params, and tokens are redacted as `<url>` or `?REDACTED`. No transcript text appeared in these logs.
`ps` is not installed in the worker image; process list was taken from `/proc` (same columns as `ps -eo pid,ppid,etime,cmd`), with URLs redacted from `cmd`.

## Summary

The current import, `job_a454af11f2e44055bf7d374657be4e04`, has been stuck at **Downloading audio** (project progress **12**) since **12:01:54 PM ET**, about **2 hours** as of 2:04 PM ET. There is no silent gap on this attempt: `[clipper:progress]` heartbeats continue every ~3 seconds (`http_send_begin` / `http_send_ok` / `db_release_*`) and keep `lockedAt` / `updatedAt` fresh, so stale-lock recovery never fires. The last log line before this report was another heartbeat, not a download error: `2026-11-14T19:03:40.818Z [clipper:progress] http_send_begin ... stage=Downloading audio`. Inside the container, **yt-dlp is still alive** (pid 26, parent pid 1, elapsed ~2h, audio-only Twitch extract to a temp ingest dir). **No ffmpeg process** is running (ffmpeg is only in yt-dlp `--postprocessor-args` and has not started). A partial `audio.mp4.part` sat at **74,411,340 bytes** with fragment files around Frag 275–281; at 2:03–2:04 PM ET those files were no longer growing (all mtimes ~2.5 minutes stale; Frag 280–281 were 0-byte). There are **zero** yt-dlp/ffmpeg/traceback lines in the worker logs. The previous job on the same VOD, `job_c234d622`, hung the same way for ~11 hours; its last log before silence was `http_send_begin stage=Downloading audio` at **11:45:01 AM ET**, and it was marked FAILED and killed ~11:58 AM ET.

## Job rows (product DB, safe columns only)

Typo check: `job_a454af11e2e44055bf7d374657be4e04` does not exist. The live job is `job_a454af11f2e44055bf7d374657be4e04`.

Both jobs belong to `proj_a17d5d14ffbc4a988123215cbd8d794a` (VOD `svod_6a8de4cb…`). The VOD row was not queried beyond the already-logged id and was not modified. Project status at capture: `PREPARING`, stage `Downloading audio`, progress `12`.

### job_a454af11f2e44055bf7d374657be4e04 (current)

| Field | Value |
| --- | --- |
| type | STREAM_IMPORT |
| status | RUNNING |
| attempts | 1 |
| createdAt | 2026-11-14 17:01:41.378 UTC (12:01:41 PM ET) |
| lockedBy | clips-worker-stream-1:408e0e91 |
| lockedAt | 2026-11-14 19:01:32.751 UTC (2:01:32 PM ET), still refreshing |
| finishedAt | NULL |
| error | (empty) |
| project stage / progress / updatedAt | Downloading audio / 12 / 2026-11-14 19:01:33.254 UTC (2:01:33 PM ET), still refreshing |

### job_c234d622b13a46bbbdd9a4ed81aa5a49 (earlier attempt, already FAILED)

| Field | Value |
| --- | --- |
| type | STREAM_IMPORT |
| status | FAILED |
| attempts | 2 |
| createdAt | 2026-11-14 05:58:18.479 UTC (12:58:18 AM ET) |
| lockedBy / lockedAt | NULL / NULL |
| finishedAt | NULL (not set when it was killed ~11:58 AM ET) |
| error | `Requeued after worker restart \| Stopped by DevOps 2026-11-14 ~11:58 ET: stuck ~11h at Downloading audio; killed for worker deploy 33350ddc per John; not requeued` |

## Process list in `clips-worker-stream` at 2:01:36 PM ET

```
pid ppid etime    cmd
1   0    2:03:31  python -m clips_worker.main
26  1    1:59:46  /usr/local/bin/python3.11 /usr/local/bin/yt-dlp --retries 5 --fragment-retries 12 --continue --concurrent-fragments 4 -f worstaudio/worst[acodec!=none]/ba[abr<=48]/bestaudio[abr<=64]/bestaudio/b -x --audio-format opus --postprocessor-args ffmpeg:-ac 1 -ar 16000 -b:a 24k -o /tmp/streamer/ingest/ingest_svod_6a8de4c_wp6g049_/audio.%(ext)s --newline -P /tmp/streamer/ingest/ingest_svod_6a8de4c_wp6g049_ <url>
65  0    00:00    python   (this inspection)
```

No ffmpeg PID was present. Temp ingest (sizes at 2:04:05 PM ET, unchanged from a 2:03 snapshot; all mtimes 153s stale):

- `audio.mp4.part` 74,411,340 bytes
- `audio.mp4.part-Frag275.part` 261,120
- `audio.mp4.part-Frag276` 271,284
- `audio.mp4.part-Frag277` 270,532
- `audio.mp4.part-Frag278` 273,164
- `audio.mp4.part-Frag279.part` 130,048
- `audio.mp4.part-Frag280.part` 0
- `audio.mp4.part-Frag281.part` 0
- `audio.mp4.ytdl` 71
- total 75,617,559 bytes

## Log sources

- `/home/cursor-agent/transovo-logs/clips-worker-stream/2026-11-14.log` — `job_c234d622` 52,595 lines (52,521 heartbeats, 74 other); `job_a454af11` 9,734 lines. This is the only source for `job_c234d622` (that run lived on the previous container, replaced at 11:58:12 AM ET).
- `docker logs --timestamps clips-worker-stream` — `job_a454af11` 10,034 lines (10,022 heartbeats, 12 other). Current container started 11:58:12 AM ET; no `job_c234d622` lines.
- `/home/cursor-agent/transovo-logs/clips-worker/2026-11-14.log` — **0** lines for either job. Default-lane live logs were not needed.
- Grep over both stream sources for `yt-dlp`, `ffmpeg`, `traceback`, `exception`, or the ingest dir name: **0** matches (excluding heartbeats). yt-dlp stdout is not logged.

Heartbeat lines look like this (every ~3s, summarized rather than pasted thousands of times):

```
[clipper:progress] db_release_begin job=<id> stage=Downloading audio
[clipper:progress] db_released     job=<id> stage=Downloading audio
[clipper:progress] http_send_begin job=<id> stage=Downloading audio
[clipper:progress] http_send_ok    job=<id> stage=Downloading audio attempt=1
```

The only non-heartbeat “errors” are **progress HTTP callbacks** getting `HTTPError 502: Bad Gateway` during web deploys, then succeeding on retry. Those are callback posts to the app, not yt-dlp failures.

## job_a454af11 — redacted event log

Claimed on the current stream worker at **12:01:48 PM ET**. Stage moved from `Downloading` to `Downloading audio` within ~6 seconds and never left it. Heartbeats ran continuously from 12:01:48 PM ET through at least 2:03:40 PM ET (10,022 heartbeat lines in live docker logs).

```
2026-11-14T17:01:48.195089601Z claimed job=job_a454af11f2e44055bf7d374657be4e04 type=STREAM_IMPORT lane=stream
2026-11-14T17:01:48.547008635Z [clipper:decision] {"ts": 1794675708.547, "stage": "stream_import", "event": "import_begin", "vod_id": "svod_6a8de4cb617842368441455e7da6b23d", "job_id": "job_a454af11f2e44055bf7d374657be4e04", "url": "(redacted)", "platform": "twitch", "triggeredBy": "paste", "allowGrowing": false}
2026-11-14T17:01:48.852472559Z [clipper:progress] db_release_begin job=job_a454af11f2e44055bf7d374657be4e04 stage=Downloading
2026-11-14T17:01:53.431431134Z [streamer:decision] {"ts": 1794675713.431, "stage": "streamer", "event": "range_plan", "vod_id": "svod_6a8de4cb617842368441455e7da6b23d", "job_id": "job_a454af11f2e44055bf7d374657be4e04", "rangeStartMs": 0, "rangeEndMs": 0}
2026-11-14T17:01:54.143050600Z [clipper:progress] db_release_begin job=job_a454af11f2e44055bf7d374657be4e04 stage=Downloading audio
… heartbeats every ~3s, stage=Downloading audio, ~10,022 lines …
2026-11-14T19:03:40.818040135Z [clipper:progress] http_send_begin job=job_a454af11f2e44055bf7d374657be4e04 stage=Downloading audio
```

Progress-post 502s (all recovered; they line up with web deploys at ~12:37 PM ET and ~1:20 PM ET):

```
2026-11-14T17:37:47.590068292Z progress post retry job=job_a454af11f2e44055bf7d374657be4e04 attempt=1/4 last=<HTTPError 502: 'Bad Gateway'> sleep=2.0s
2026-11-14T17:37:52.590457950Z progress post ok job=job_a454af11f2e44055bf7d374657be4e04 after attempt=2 base=<url>
2026-11-14T17:37:52.626883100Z progress post retry job=job_a454af11f2e44055bf7d374657be4e04 attempt=1/4 last=<HTTPError 502: 'Bad Gateway'> sleep=2.0s
2026-11-14T17:37:54.683799744Z progress post retry job=job_a454af11f2e44055bf7d374657be4e04 attempt=2/4 last=<HTTPError 502: 'Bad Gateway'> sleep=4.0s
2026-11-14T17:38:01.571021692Z progress post ok job=job_a454af11f2e44055bf7d374657be4e04 after attempt=3 base=<url>
2026-11-14T17:38:20.194659745Z progress post retry job=job_a454af11f2e44055bf7d374657be4e04 attempt=1/4 last=<HTTPError 502: 'Bad Gateway'> sleep=2.0s
2026-11-14T17:38:25.309445562Z progress post ok job=job_a454af11f2e44055bf7d374657be4e04 after attempt=2 base=<url>
2026-11-14T18:20:20.492975021Z progress post retry job=job_a454af11f2e44055bf7d374657be4e04 attempt=1/4 last=<HTTPError 502: 'Bad Gateway'> sleep=2.0s
2026-11-14T18:20:25.500495602Z progress post ok job=job_a454af11f2e44055bf7d374657be4e04 after attempt=2 base=<url>
```

Archive 502 retry count for this job: 5 (4 in the 17:00 UTC hour, 1 in the 18:00 UTC hour).

## job_c234d622 — redacted event log

First claimed **12:58:20 AM ET**. Stage moved to `Downloading audio` by **12:58:26 AM ET**. The job was **re-claimed at 9:37:23 AM ET** after a worker restart (`error` already contained `Requeued after worker restart`; attempts ended at 2). Heartbeats then continued until **11:45:01 AM ET** (52,521 heartbeat lines). The last line before silence was an incomplete heartbeat (`http_send_begin` with no following `http_send_ok`). The container was replaced at **11:58:12 AM ET** when the job was marked FAILED and not requeued.

```
2026-11-14T05:58:20.044097626Z claimed job=job_c234d622b13a46bbbdd9a4ed81aa5a49 type=STREAM_IMPORT lane=stream
2026-11-14T05:58:20.543110280Z [clipper:decision] {"ts": 1794635900.541, "stage": "stream_import", "event": "import_begin", "vod_id": "svod_6a8de4cb617842368441455e7da6b23d", "job_id": "job_c234d622b13a46bbbdd9a4ed81aa5a49", "url": "(redacted)", "platform": "twitch", "triggeredBy": "paste", "allowGrowing": false}
2026-11-14T05:58:20.851928325Z [clipper:progress] db_release_begin job=job_c234d622b13a46bbbdd9a4ed81aa5a49 stage=Downloading
2026-11-14T05:58:25.980084469Z [streamer:decision] {"ts": 1794635905.98, "stage": "streamer", "event": "range_plan", "vod_id": "svod_6a8de4cb617842368441455e7da6b23d", "job_id": "job_c234d622b13a46bbbdd9a4ed81aa5a49", "rangeStartMs": 0, "rangeEndMs": 0}
2026-11-14T05:58:26.682691194Z [clipper:progress] db_release_begin job=job_c234d622b13a46bbbdd9a4ed81aa5a49 stage=Downloading audio
… heartbeats every ~3s …
2026-11-14T14:37:23.275987828Z claimed job=job_c234d622b13a46bbbdd9a4ed81aa5a49 type=STREAM_IMPORT lane=stream
2026-11-14T14:37:23.640151360Z [clipper:decision] {"ts": 1794667043.64, "stage": "stream_import", "event": "import_begin", "vod_id": "svod_6a8de4cb617842368441455e7da6b23d", "job_id": "job_c234d622b13a46bbbdd9a4ed81aa5a49", "url": "(redacted)", "platform": "twitch", "triggeredBy": "paste", "allowGrowing": false}
2026-11-14T14:37:28.475039762Z [streamer:decision] {"ts": 1794667048.475, "stage": "streamer", "event": "range_plan", "vod_id": "svod_6a8de4cb617842368441455e7da6b23d", "job_id": "job_c234d622b13a46bbbdd9a4ed81aa5a49", "rangeStartMs": 0, "rangeEndMs": 0}
… heartbeats every ~3s …
2026-11-14T16:45:01.899227602Z [clipper:progress] http_send_begin job=job_c234d622b13a46bbbdd9a4ed81aa5a49 stage=Downloading audio
```

Progress-post 502s: 35 retries in the archive (hours 07, 08, 11, 12, 14, 15 UTC). First at 2:00:16 AM ET, last at 10:58:19 AM ET. Typical pattern: attempt 1/4 got 502, attempt 2/4 succeeded. These are not yt-dlp errors.

```
2026-11-14T07:00:16.156258156Z progress post retry job=job_c234d622b13a46bbbdd9a4ed81aa5a49 attempt=1/4 last=<HTTPError 502: 'Bad Gateway'> sleep=2.0s
2026-11-14T07:00:21.118005206Z progress post ok job=job_c234d622b13a46bbbdd9a4ed81aa5a49 after attempt=2 base=<url>
… 33 more retries, same shape, clustered around web-deploy windows …
2026-11-14T15:58:19.048951486Z progress post retry job=job_c234d622b13a46bbbdd9a4ed81aa5a49 attempt=1/4 last=<HTTPError 502: 'Bad Gateway'> sleep=2.0s
```

## Notes for the kill / rollout (not yet done at the time of this capture)

`requeue_job_after_interrupt` and `requeue_job_immediate` (drain / SIGTERM) update the job to `QUEUED` **without** `WHERE status = 'RUNNING'`. Boot recovery (`requeue_running_not_owned_by_instance`) only requeues `RUNNING` rows. So the job must be marked FAILED first, and the container must not get a graceful drain that can flip it back to QUEUED.


## Aftermath (after the capture above)

`job_a454af11` was marked FAILED at 2:04:57 PM ET, locks cleared, `finishedAt` set, error appended, not requeued. The VOD row was not modified.

While a worker or the web progress-apply path was still posting, the FAILED row could be flipped back to RUNNING (`lockedBy` stayed empty; `lockedAt` and status were rewritten). SIGKILL of `clips-worker-stream` was required for the FAILED write to stick. Drain/interrupt SQL can also requeue without `WHERE status = 'RUNNING'`, which is why the container was killed rather than given a graceful drain.

About 10 seconds after the first new stream-worker boot (2:11:59 PM ET), a third STREAM_IMPORT on the same project/VOD was created: `job_e26aabd5b6b7408bbb70efae3b779698` at 2:12:09 PM ET (`triggeredBy: paste`, claimed 2:12:16 PM ET). It was not a boot-recovery requeue of a RUNNING row (the worker had logged `queued_jobs=0`). This job was also marked FAILED (finishedAt 2:14:51 PM ET) per John's "kill anything that pops up" and was not requeued. After a SIGKILL + `docker start` of the same container at 2:15:49 PM ET, all three jobs stayed FAILED and no fourth job appeared in the following minutes.
