# agentlab-backend: AgentLab server backup

Snapshot of everything needed to rebuild the AgentLab server (`root@204.168.139.158`, Hetzner, Ubuntu, OpenHands 1.63.1) if it goes down.
Snapshot time: see `SNAPSHOT_TIME_UTC.txt`. Refresh with `./sync.sh` (see bottom).

## What is in here
| Path | Contents |
|---|---|
| `server/opt/agent/` | Mirror of `/opt/agent`: `runner/` (agentd, gates), `tools/` (agent CLIs), `ops/` (daemons, backup.sh), `embed/` (code only), `connectors/`, `phone/` (LiveKit phone worker + run scripts), `oh-home/` (settings.json, hooks.json, profiles/ with key values replaced by `<REDACTED>`), `workspace/skills/`, `workspace/tools/`, `tests/` (harnesses), `build/` (Dockerfile + image build context, no fonts), `staged/`, `skills-src/`, `searxng/`, `desktop/` (scripts), `AGENTS.md`, `run.sh` |
| `server/etc/systemd/system/` | All `agent-lab-*` / `agentlab-*` service, timer and `.d` drop-in files |
| `generated/` | `crontab.txt` (scrubbed), docker container definitions (`docker-*.json`, env NAMES only), image list, systemctl state, host info, dpkg + pip lists, inventory of secret file names |
| `local/` | AgentLab docs from the Chief-of-Staff box: `AGENTLAB_HANDOFF.md`, research (`agentlab-*`, gap-fixes, cursor-efficiency, model routing / caching / proxy notes), `agentlab_phone/` docs + src, `agentlab_fix/*.md` |
| `secrets.tar.age` | **Encrypted** tar.gz of all secrets (see below). Public recipient: `age-recipient.pub` |
| `snapshot.conf` | The single include/exclude list used by `sync.sh` |
| `sync.sh`, `server_pull.sh`, `server_meta.sh`, `sanitize.py`, `crosscheck.py`, `apply_report.py`, `push_snapshot.py`, `.gitleaks.toml` | Refresh tooling |
| `REDACTIONS.json` | Which files had values redacted, by rule and count (no values) |

## What is NOT in here (by design)
Plaintext secrets of any kind (`/opt/agent/secrets`, `workspace/secrets`, `.env`, `*.env`, keys, `*.pem`, tokens, cookies, OAuth stores), databases (`runs.db`, `calls.db`, `memory.db`, `history.db`, `index.db`, any `*.db`), `workspace/jobs`, `workspace/runs`, `workspace/usage`, `workspace/conversations`, `workspace/pages`, web caches, venvs, `node_modules`, `__pycache__`, `/opt/agent/backups/`, model weights (`embed/models`, re-downloaded by fastembed), `tools/pylib*`/`mcp-fetch-pkgs`/`ruff` (reinstallable), fonts, logs, call recordings, files over 5 MB, Docker images themselves (rebuild from `server/opt/agent/build/Dockerfile`; base image `transovo-agent:1.63.1-full`).
Call data (`phone/calls.db`, recordings), job folders and run history are **not** backed up here. The server has its own nightly backup (`ops/backup.sh`, 03:00) to `/opt/agent/backups/` and an offsite blocker note in `ops/offsite.block`.

## Encrypted secrets (`secrets.tar.age`)
Contains (relative to `/`): `opt/agent/secrets/`, `opt/agent/workspace/secrets/`, `opt/agent/.env`, `opt/agent/oh-home/` (unredacted settings + profiles), `opt/agent/searxng/`, `opt/agent/runner/state/`. The OpenHands in-app vault (`LOGIN_*`) had 0 entries when snapshotted.
Encrypted with [age](https://github.com/FiloSottile/age) to the recipient in `age-recipient.pub`. The **private identity** is on John's box at
`/home/box/.agentlab_backup/age-identity.txt` (mode 600, never in the repo).
> **Keep an offline copy of that identity file** (password manager or USB). If the box and the identity are both lost, `secrets.tar.age` cannot be decrypted. Anyone with the identity can read every secret, so store it like a password.

### Required secret NAMES (values only inside secrets.tar.age)
- `secrets/anthropic.env`: ANTHROPIC_API_KEY
- `secrets/openai.env`: OPENAI_API_KEY
- `secrets/kie.env`: KIE_API_KEY
- `secrets/agentmail.env`: AGENTMAIL_API_KEY, AGENTMAIL_INBOX, MAIL_ALLOW_TO
- `secrets/telegram.env`: TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_CHATS
- `secrets/dataimpulse_proxy.env`: DI_PROXY_HOST, DI_PROXY_PORT, DI_PROXY_USER, DI_PROXY_PASS, DI_SOCKS_PORT
- `secrets/b2.env`: S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
- `secrets/pixabay.env`: PIXABAY_API_KEY (also `workspace/secrets/pixabay.env`)
- `secrets/phone.env`: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, TELNYX_API_KEY, TELNYX_SIP_OUTBOUND_USERNAME/PASSWORD, AGENTLAB_SIP_CONNECTION_ID/USER/PASS, MICROSOFT_/CALENDLY_/SALESFORCE_/ZOHO_ CLIENT_ID + CLIENT_SECRET (+ MICROSOFT_TENANT_ID)
- `secrets/connectors/microsoft.json`: access_token, refresh_token, expires_at, scope (re-authorize via the connectors broker if expired)
- `workspace/secrets/captcha.env`: CAPSOLVER_API_KEY, CAPTCHA_PROVIDER
- `/opt/agent/.env`: AGENT_LAB_TOKEN, OH_SECRET_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
- `oh-home/profiles/*.json` and `settings.json`: the `api_key` fields (restored automatically with the archive)

## Restore onto a fresh Ubuntu box
Run as root on the new server. `$REPO` = a checkout of this repo (a normal `git clone` is fine on the new server), `$B` = `$REPO/agentlab-backend`.
1. **Base packages**: `apt update && apt install -y docker.io python3 python3-pip python3-venv git curl age chromium-browser xvfb openbox x11vnc cron` (exact versions: `generated/dpkg-list.txt`, `generated/pip3-freeze.txt`, `generated/host-info.txt`).
2. **Users**: create `agentlab` (and uid/gid 10001 for the helper, see `server/etc/systemd/system/agent-lab-helper.service.d/uid.conf`; docker group gid 19998 is used by the agent container, see `generated/docker-agent-lab.json`).
3. **Copy code**: `mkdir -p /opt/agent && cp -a $B/server/opt/agent/. /opt/agent/ && chown -R agentlab:agentlab /opt/agent/workspace /opt/agent/oh-home /opt/agent/embed`. Recreate empty runtime dirs: `mkdir -p /opt/agent/{backups,logs,secrets} /opt/agent/workspace/{jobs,runs,usage,pages,conversations,memory,secrets}`; DBs are recreated on first start.
4. **Decrypt secrets** (needs the identity file, e.g. copied back to `/root/age-identity.txt`, mode 600):
   `age -d -i /root/age-identity.txt $B/secrets.tar.age | tar -xzf - -C / && chmod 700 /opt/agent/secrets /opt/agent/workspace/secrets && chmod 600 /opt/agent/.env /opt/agent/secrets/*.env /opt/agent/workspace/secrets/*.env`
   (This overwrites the redacted `oh-home` and `searxng` copies with the real ones. Then `chown -R agentlab:agentlab /opt/agent/oh-home /opt/agent/workspace/secrets`.) Never write the decrypted tree into a git repo.
5. **Docker**: install/rebuild the images (`docker build` from `/opt/agent/build/Dockerfile` for `transovo-agent:1.63.1-full`; the phone worker image `agentlab-phone` from `/opt/agent/phone/`; searxng image per `generated/docker-searxng.json`). Start the agent container with `/opt/agent/run.sh` (it reads `/opt/agent/.env`), the phone worker with `/opt/agent/phone/run-worker.sh`, searxng with `/opt/agent/ops/searxng-run.sh`. Mounts, network mode, restart policy and env var NAMES for each container are in `generated/docker-*.json`.
6. **Embed venv + models** (not backed up): `cd /opt/agent/embed && python3 -m venv venv && venv/bin/pip install -r requirements.txt` (or see `embed/pip.log` / `generated/pip3-freeze.txt`); fastembed re-downloads models into `/opt/agent/embed/models`. Tools needing `tools/pylib`, `mcp-fetch-pkgs`, `ruff`: reinstall with pip/npm per the tool scripts.
7. **systemd**: `cp -a $B/server/etc/systemd/system/agent-lab-* $B/server/etc/systemd/system/agentlab-* /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now agent-lab-keys agent-lab-egress agent-lab-embed agent-lab-helper agent-lab-vaultd agent-lab-runner agent-lab-anthropic-shim agent-lab-chrome agent-lab-desktop agent-lab-jobbrowsers agentlab-connectors agent-lab-browser-heal.timer` (add `agent-lab-telegram` only once a bot token exists). Expected state: `generated/systemctl-units.txt`. Before restarting the runner or container, make sure no run is active (`SELECT id,status FROM runs WHERE status IN ('running','starting')`).
8. **Crontab**: `crontab $B/generated/crontab.txt` (check for `<REDACTED>` placeholders; there were none in this snapshot).
9. **Verify**: `systemctl is-active agent-lab-*`, `docker ps` (agent-lab, agentlab-phone, searxng), `curl -s 127.0.0.1:8000/health`, run `/opt/agent/ops/lab-doctor`.
10. Re-point DNS/phone: the Telnyx number and LiveKit project are external; the SIP trunk/worker credentials are in `phone.env`.

## Refresh the snapshot (on John's box)
`/workspace/agentlab_backup_tool/sync.sh` (a copy is in this folder; run it from a directory containing `snapshot.conf`). It:
1. reads `snapshot.conf` (the one include/exclude list),
2. pulls the code with one `tar` over ssh (read-only on the server), plus generated metadata,
3. streams the secrets bundle `ssh -> tar -> age` straight into `secrets.tar.age` (plaintext never touches disk),
4. redacts, then runs gitleaks, an exact-value cross-check against the real secrets, and a key-prefix grep; it refuses to push if anything is left,
5. commits the whole `agentlab-backend/` folder through the GitHub API to branch `agentlab-backend-backup` (or a timestamped branch if that PR was merged) and opens/updates a PR. Never force-pushes, never merges.
Requirements: `age`, `gitleaks` in `~/bin` or PATH, the ssh key `~/.ssh/agentlab_root_ed25519`, `GITHUB_TOKEN` in `/home/box/.transovo_team_secrets.env`, and the age identity at `/home/box/.agentlab_backup/age-identity.txt`.
Modes: `sync.sh pull|scan|push|all`.
