# Track B additions (merge into AGENTS.md)

These tools were added under `/workspace/tools/bin` (host: `/opt/agent/workspace/tools/bin`). They are not yet on `PATH` (container PATH currently starts with `/opt/tools`). Until this is merged, call them as `/workspace/tools/bin/<name>` or `export PATH=/workspace/tools/bin:$PATH`.

Host-side jobs live in `/opt/agent/ops/` and are not visible inside the container. Do not rebuild the image or restart the container for these tools — they are ordinary scripts in the workspace volume.

## Media tools

All four need API keys in the environment (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY`). Those keys are in `/opt/agent/.env` on the host; they reach the running `agent-lab` container only after `run.sh` is updated to pass them through and the container is restarted.

Each successful call appends one JSON line to `/workspace/usage/usage.jsonl` with `tool`, `units`, and `estimated_cost_usd`. Never print, echo, or log API keys.

- `image-gen "prompt" [--ref img] [-o out.png] [--size 1K|2K|4K] [--aspect 1:1]` — Gemini Nano Banana (`gemini-nano-banana-2.1`). Default size `1K` (~$0.0336 plus a little input/thinking). `--ref` is optional and repeatable.
- `image-edit <image> "prompt" [-o out.png] [--ref img] [--size 1K|2K|4K]` — same model, required input image. Default output is `<stem>_edit.png`.
- `tts "text" -o out.mp3 [--voice id]` — ElevenLabs `eleven_flash_v2_5` (~$0.04 per 1,000 characters). Default voice is Rachel (`21m00Tcm4TlvDq8ikWAM`) or `ELEVENLABS_VOICE_ID`.
- `transcribe <file> -o out.json` — Deepgram `nova-3` with word timestamps and speaker diarization (`diarize_model=latest`). Pre-recorded monolingual is ~$0.0043/min; diarization is included.

## Usage

- `usage` — prints today's totals (America/New_York) for OpenHands conversation LLM cost plus media CLI cost, and a per-conversation / per-job list. `--json` dumps the summary. `--refresh` reruns the host collector when available.
- Host collector `/opt/agent/ops/collect-usage` reads conversation metrics from `http://127.0.0.1:8000/api/conversations/search` (header `X-Session-API-Key`, token loaded from `/opt/agent/.env` and never printed) and writes `/workspace/usage/summary.json` with per-conversation and per-day totals. Cron: every 15 minutes.

## Backups

- Host script `/opt/agent/ops/backup.sh` tars `/opt/agent/workspace/memory`, `/opt/agent/workspace/skills`, `/opt/agent/oh-home` settings (`settings.json`, `hooks.json`, `profiles/`), `/opt/agent/build`, and `/opt/agent/run.sh`.
- Excludes `/opt/agent/.env`, `provider-connections` (may hold tokens), conversations, job outputs, and media.
- Writes `/opt/agent/backups/agent-lab-YYYYMMDDThhmmssZ.tar.gz` and keeps the last 14.
- Cron: `0 3 * * *` (03:00 server time, which is UTC). Offsite B2 upload is skipped unless `B2_*` credentials are present.

## Desktop, live view and sign-in handoff

A persistent virtual desktop runs on the host (systemd unit `agent-lab-desktop`): Xvfb `:99` at 1920x1080, Openbox, and a PIN-gated live view. Raw VNC (`127.0.0.1:5900`) and X11 TCP (`127.0.0.1:6099`) are localhost only. The agent container uses `DISPLAY=127.0.0.1:99` and `/workspace/desktop/Xauthority`.

CLIs (also in `/workspace/tools/bin`):

- `desktop-status` — is the desktop up, and is a handoff waiting?
- `desktop-shot [-o out.png]` — screenshot the desktop, then `look out.png "..."`.
- `desktop-open [url]` — open Chromium on the desktop (profile: `/workspace/desktop/chrome-profile`).
- `click X Y [--button 1] [--double]` — click on the 1920x1080 screen.
- `desktop-type "text" [--enter]` — type into the focused window (does not log the text).
- `key Return` / `key ctrl+l` — press a key or combo.
- `handoff "Please sign in to YouTube" [--timeout 1800]` — give Rick the live-view URL and a PIN, then wait until he clicks **I'm done**. Use this for logins, 2FA and file pickers.
- `handoff --done` / `handoff --status`
- `desktop-link [--hours 12]` — a PIN so Rick can watch the desktop without blocking you.

A continuously updated preview is at `/workspace/desktop/live.jpg`. The interactive view is `http://<server>:6080` (UFW port 6080, PIN required). Do not print API keys when you send Rick a PIN; the PIN is not a secret key, just a short door code.

Host services: `/opt/agent/ops/desktop/start.sh`, `stop.sh`, `desktop-service.py`. Control API is `http://127.0.0.1:6070` (localhost only).

## Log redaction (no spending caps)

Cost tracking stays (`usage`, `/workspace/usage/`). There is **no** spending cap and no pause-on-limit script.

- `redact` — strip API keys and known `.env` values from stdin or files (`redact FILE`, `redact` as a filter).
- Host cron `/opt/agent/ops/scrub-logs` walks agent logs, usage files and conversation event JSON and replaces secret values with `***REDACTED***`. It never prints the values and never touches `.env`.

## Stronger delete protection (host-side, not agent-guard)

`agent-guard` only inspects shell text and can be skipped by a Python or Node script. The reliable model is **per-job Unix users plus a privileged helper**, not bind-mounts alone (every conversation today runs as the same uid 10001, so a writable `jobs/` tree cannot tell "my job" from "someone else's").

What is already on the host (does **not** lock down the live `/opt/agent/workspace` until you apply the run.sh changes):

- Users: group `agentlab-jobs` (gid 19998), `agentlab-helper` (uid 19999), job pool `agentlab-job-20001` … `agentlab-job-20100`.
- Map: `/opt/agent/ops/sandbox/uid.map` (`jobid uid`), allocated by `job-init` / helperd.
- Helper daemon: systemd `agent-lab-helper`, socket `/workspace/.helper/helper.sock`. Auth is `SO_PEERCRED` (uids 0, 10001, 19999, 20001–20100). It is the only writer of memory, skills and pages after lockdown. It runs the real `/opt/agent/tools/remember`, `forget`, `project-note`, `save-skill` as uid 19999, so those CLIs keep their current behavior.
- Wrappers in `/workspace/tools/bin/{remember,forget,project-note,save-skill}` talk to the helper when the socket is up, otherwise exec `/opt/tools/...`.
- `job-init <id>` creates `/workspace/jobs/<id>` (src/work/frames/out/log) owned **0700** by that job's uid (files 0600). Do **not** use 0770: every job user is in group `agentlab-jobs` (19998), and unlink is controlled by write access on the directory, so 0770 would let job A `os.remove` job B's files.
- `job-exec <cmd>…` (setuid root, `/opt/agent/ops/sandbox/job-exec`) ignores any requested user, resolves the job from cwd (`/workspace/jobs/<id>/…`), drops to that uid, and execs. Clears `LD_PRELOAD` / `LD_LIBRARY_PATH`.
- `apply-perms.sh --root DIR` chowns memory/skills/tools/pages to 19999 (world-readable, 0755/0644) and each job to its uid with **0700/0600**. It **refuses** `--root /opt/agent/workspace` unless you pass `--live`.

### run.sh changes (track A must apply; do not restart until these are in)

Keep the existing image, env, and volume flags. Add the bits marked `NEW`:

```bash
#!/bin/bash
# Starts the Transovo Agent Lab (OpenHands agent-server) container. Secrets come from /opt/agent/.env.
set -a; . /opt/agent/.env; set +a
docker rm -f agent-lab >/dev/null 2>&1 || true
docker run -d --name agent-lab --restart unless-stopped --network host \
  --shm-size=1g \
  --group-add 19998 \
  -e DEEPSEEK_API_KEY -e GEMINI_API_KEY -e ELEVENLABS_API_KEY -e DEEPGRAM_API_KEY -e OH_SECRET_KEY \
  -e OH_SESSION_API_KEYS_0="$AGENT_LAB_TOKEN" \
  -e OH_ENABLE_VSCODE=false -e OPENHANDS_SUPPRESS_BANNER=1 \
  -v /opt/agent/workspace:/workspace \
  -v /opt/agent/oh-home:/home/openhands/.openhands \
  -v /opt/agent/tools:/opt/tools:ro \
  -v /opt/agent/ops/sandbox/job-exec:/usr/local/bin/job-exec:ro \
  -e BOT_ID=agent-lab \
  -e PATH=/workspace/tools/bin:/opt/tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  transovo-agent:1.63.1-full --host 0.0.0.0 --port 8000
sleep 2
docker exec -u root agent-lab bash -c "for f in /opt/tools/*; do case \$f in *.py|*/pylib) ;; *) ln -sf \$f /usr/local/bin/; esac; done"
docker exec -u root agent-lab bash -c "echo export\ PATH=/workspace/tools/bin:/opt/tools:\\\$PATH > /etc/profile.d/agent-tools.sh"
# NEW: after each conversation is created, on the HOST (not in the container):
#   /opt/agent/workspace/tools/bin/job-init <conversation-id>
# Then run that conversation's terminal/file tools through job-exec, with cwd
# /workspace/jobs/<conversation-id>/. The OpenHands server process may stay
# uid 10001, but any command that can create or delete files must go through
# job-exec (otherwise 10001 will no longer be able to write job folders once
# you run apply-perms.sh --root /opt/agent/workspace --live).
```

The important PATH change is **`/workspace/tools/bin` before `/opt/tools`**, so the helper-backed `remember` / `save-skill` wrappers win. `--group-add 19998` is optional (the socket is 0666; peer uid is what matters). The `job-exec` bind-mount is required so the binary stays root-owned and setuid on the host (do not copy it into a writable workspace path).

After this run.sh is live and `job-init` runs for each conversation, lockdown the live tree once:

```bash
/opt/agent/ops/sandbox/apply-perms.sh --root /opt/agent/workspace --live
```

OpenHands must execute terminal (and the built-in file tool, if it writes as the server uid) via `job-exec`. A hook around `bash` is not enough — hooks can be bypassed; directory ownership is what denies `os.remove`. If the file tool cannot be wrapped, it will start failing to write to job folders after `--live` and will need an OpenHands-side "run tools as job uid" setting or a small patch.

### Dockerfile changes (optional, only if you rebuild later)

Not required for the proof or for the first lockdown. If you rebuild:

```dockerfile
# After existing user setup, document that job UIDs 20001-20100 and
# group 19998 exist on the *host* and are passed through numerically.
# Do not COPY job-exec into the image (setuid bits are lost on copy/extract
# unless you install it in an entrypoint as root). Keep the bind-mount in run.sh.
# Optional: install bubblewrap for a future extra wrap, not a substitute:
#   RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap && rm -rf /var/lib/apt/lists/*
```

Do **not** chown `/workspace` to 10001 in an entrypoint. That would undo per-job ownership.

Proof (already run in a throwaway `docker run --rm`, not against the live volume): as uid 20001, writing `jobs/job-a/mine.txt` succeeds; `os.remove('jobs/job-b/secret.txt')` raises `PermissionError`; memory files cannot be overwritten.

## Pages and reports

- `publish <file.html|.md> [--title "Title"] [--slug slug]` writes `/workspace/pages/<slug>/index.html` (Transovo-styled template, Chart.js included so inline charts work), copies the source, updates `/workspace/pages/index.json`, and prints the slug.
- **Public route for track A to add on transovo.ai:**
  - `https://transovo.ai/app/agent-lab/pages/<slug>` → static file `/opt/agent/workspace/pages/<slug>/index.html`
  - `https://transovo.ai/app/agent-lab/pages/` → optional index from `/opt/agent/workspace/pages/index.json`
- After lockdown, `publish` should go through the helper (add a PATH wrapper or call `helper-client publish`). Until `--live`, the CLI can write `/workspace/pages` directly; create that directory writable by 10001 for now.

## Test set

15 comparison tasks live at `/workspace/agent-lab/tests/TESTSET.md` (on the build box). Do not run them as part of a deploy. Each task has the exact prompt, pass criteria, and how to score quality 1–5, time, and cost against the Grok bots.
