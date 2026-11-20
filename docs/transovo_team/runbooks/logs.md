# Transovo production logs runbook

Use this when something fails on live. Debug from the real logs over SSH, never by guessing.

**Redaction rule:** never paste signed URLs, media URLs, cookies, tokens, keys, or transcripts into chat, issues, or PRs. Redact `X-Amz-*` / `token=` / `signature=` query strings and `https://` URLs to storage or CDN hosts before sharing a snippet. Prefer project id, job id, stage, error code, and counts.

Do not touch the SMS worker or Coolify app3 (`fd7b2fe8172414e3320776281a-*`).

## SSH

From the shared computer:

```bash
ssh -i /home/box/.ssh/grokbot_hetzner_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes cursor-agent@128.140.102.51
```

(Equivalent: `-i ~/.ssh/grokbot_hetzner_ed25519` when `~` is `/home/box`.) Key path only; never print the key.

## Find current container names

Web app Coolify id: `ds8s3hjin60qs6g7s0iqkixs` (transovo.ai). Each deploy creates a new name, `ds8s3hjin60qs6g7s0iqkixs-YYYYMMDDTHHMMSS`.

```bash
# running web container (latest deploy)
docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs- --filter status=running --format '{{.Names}} {{.Status}} {{.Image}}'

# clips workers (stable names; a deploy may leave *-old-* exited copies)
docker ps -a --filter name=clips-worker --format '{{.Names}} {{.Status}} {{.Image}}'
```

Workers: `clips-worker` (default lane) and `clips-worker-stream` (stream lane). Confirm a live web deploy with `https://transovo.ai/api/health` (`commitSha`).

## Live `docker logs`

Log driver on web and both workers: `json-file` with `max-size=10m`, `max-file=3` (about 30 MB per container). Logs start at container start and are lost when a container is recreated (deploys). `clips-worker` and the web app log `project=` / `projectId` (`proj_…`) and `job=` / `jobId` (`job_…`). The stream worker is quieter and often has no `proj_` lines.

```bash
WEB=$(docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs- --filter status=running --format '{{.Names}}' | sort | tail -n 1)
PROJ=proj_...          # full project id
JOB=job_...            # if known
SINCE=2026-11-10T07:15:00Z
UNTIL=2026-11-10T07:35:00Z

# web (progress is often multiline, so grab context)
docker logs --timestamps --since "$SINCE" --until "$UNTIL" "$WEB" 2>&1 \
  | grep -n -E "$PROJ|$JOB" | head

# workers
docker logs --timestamps --since "$SINCE" --until "$UNTIL" clips-worker 2>&1 \
  | grep -E "$PROJ|$JOB|claimed job=|finished |failed "

docker logs --timestamps --since "$SINCE" --until "$UNTIL" clips-worker-stream 2>&1 \
  | grep -E "$PROJ|$JOB|claimed job=|finished |failed "
```

Useful worker tags: `[clipper:stage]`, `[clipper:decision]`, `[clipper:transcribe]`, `[clipper:video_picker]`. Decision events include `retry`, `shortfall_accepted`, `drop`, `reject` (with a `reason` such as `below_min_moments` or `span_too_short`).

Redact before pasting:

```bash
sed -E \
  -e 's/[?&](X-Amz-[^=&]*|x-amz-[^=&]*|token|signature|Signature|Expires|AWSAccessKeyId|X-Goog-[^=&]*)=[^[:space:]"'\''&]*/?REDACTED/g' \
  -e 's#https://[^[:space:]"'\'']*(amazonaws\.com|cloudfront\.net|supabase\.co|supabase\.in|r2\.cloudflarestorage\.com|blob\.core\.windows\.net|storage\.googleapis\.com)[^[:space:]"'\'']*#https://REDACTED_STORAGE_URL#g' \
  -e 's#https://[^[:space:]"'\'']*(cdn\.|s3[.-])[^[:space:]"'\'']*#https://REDACTED_STORAGE_URL#g'
```

Do not paste `[ai-producer:specialist]` bodies or `rawModelJson`; they can contain transcripts and story text. Use event names, error codes, and counts only.

## Archive (14-day)

Because Docker keeps only ~30 MB and deploys wipe the live buffer, a cron archive runs every 15 minutes:

- Tag: `# transovo-devops-log-archive`
- Cron: `*/15 * * * * /home/cursor-agent/bin/transovo-log-archive.sh`
- Script: `/home/cursor-agent/bin/transovo-log-archive.sh`
- Files: `/home/cursor-agent/transovo-logs/<label>/<YYYY-MM-DD>.log`
  - Labels: `web`, `clips-worker`, `clips-worker-stream`
- State (last timestamp, no duplicates/gaps): `/home/cursor-agent/transovo-logs/state/<label>.last_ts`
- Run log: `/home/cursor-agent/transovo-log-archive.log`

The script resolves the current web container name each run, redacts signed and storage/CDN URLs, skips if disk is ≥90% used or free space is under 2 GiB, keeps 14 days, and caps the archive tree at 1 GiB. It does not change Docker daemon config or touch app3.

```bash
PROJ=proj_...
grep -F "$PROJ" /home/cursor-agent/transovo-logs/web/2026-11-10.log
grep -E "$PROJ|job_..." /home/cursor-agent/transovo-logs/clips-worker/2026-11-10.log
```

Web archives can still contain specialist or transcript-adjacent fields; redact those before sharing.

To remove the archive: delete the `# transovo-devops-log-archive` crontab comment and the following `*/15` line, then `rm -rf /home/cursor-agent/bin/transovo-log-archive.sh /home/cursor-agent/transovo-logs /home/cursor-agent/transovo-log-archive.log`.

## Coolify deployment logs

Web application id: `ds8s3hjin60qs6g7s0iqkixs`. Query the Coolify DB (this is not the product database). Do not dump the `logs` column wholesale; it can include build env. Select status, commit, and timestamps first, then grep a copy of `logs` locally after redaction.

```bash
docker exec coolify-db psql -U coolify -d coolify -c "
SELECT id, application_id, status, left(commit, 12) AS commit,
       created_at, deploy_started_at, finished_at
FROM application_deployment_queues
WHERE application_id = 'ds8s3hjin60qs6g7s0iqkixs'
ORDER BY id DESC
LIMIT 15;
"
```

`logs` is text (often JSON). Example, status only for in-flight deploys:

```bash
docker exec coolify-db psql -U coolify -d coolify -t -A -c "
SELECT count(*) FROM application_deployment_queues WHERE status = 'in_progress';
"
```

## Product database (read-only)

`psql` is not installed in the worker image. Use Python + `psycopg2`, which is. Pull `DATABASE_URL` from the worker environment inside the container and never print it:

```bash
docker exec -i clips-worker python - << 'PY'
import os, psycopg2
# DATABASE_URL comes from the container env; do not print it.
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
proj = "proj_..."  # full id

cur.execute("""
SELECT id, status, stage, progress, error, "sourceKind",
       "createdAt", "updatedAt"
FROM clip_projects WHERE id = %s
""", (proj,))
print(cur.fetchall())  # status, error, timestamps only
conn.close()
PY
```

Safe, useful queries (quote camelCase identifiers; do not `SELECT *`; skip `transcriptWords`, `sourceUrl`, keys, payloads, snippets, and instruction text):

```sql
-- project status
SELECT id, status, stage, progress, error, "sourceKind",
       "rangeStartMs", "rangeEndMs", "createdAt", "updatedAt"
FROM clip_projects WHERE id = %s;

-- jobs (error/status/timestamps only; do not print payload)
SELECT id, type, status, attempts, error, "createdAt", "finishedAt"
FROM clip_jobs WHERE "projectId" = %s
ORDER BY "createdAt";

-- clip counts and timing (no titles, URLs, or transcript reason text)
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE "deletedAt" IS NULL) AS active,
       COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) AS deleted
FROM clips WHERE "projectId" = %s;

SELECT id, "startMs", "endMs", score, ("deletedAt" IS NOT NULL) AS deleted, "createdAt"
FROM clips WHERE "projectId" = %s
ORDER BY "createdAt";

-- AI producer run for this project
SELECT id, status, phase, "outputType", error, "resultProjectId", "resultClipId",
       "createdAt", "updatedAt", "finishedAt"
FROM ai_producer_agent_runs
WHERE "resultProjectId" = %s
   OR "outputProjectIds"::text LIKE '%' || %s || '%';

-- step errors only (error codes are safe; skip argsSummary / resultSummary)
SELECT "stepIndex", phase, tool, left(error, 200) AS error_head, "createdAt"
FROM ai_producer_agent_steps
WHERE "runId" = %s AND error IS NOT NULL AND error <> ''
ORDER BY "createdAt";
```

Equivalent idea if `psql` is later added to the image (still do not print the URL):

```bash
docker exec clips-worker sh -c 'psql "$DATABASE_URL" -c "SELECT id, status, stage, progress, error FROM clip_projects WHERE id = '\''proj_...'\'';"'
```

## Health

```bash
curl -sS https://transovo.ai/api/health
# workers
docker exec clips-worker sh -c 'printf %s "$CLIPS_WORKER_GIT_SHA"'
docker exec clips-worker-stream sh -c 'printf %s "$CLIPS_WORKER_GIT_SHA"'
```
