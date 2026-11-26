# AgentLab hidden infrastructure gaps (read-only, code/config only)

Written Tue Nov 24, 2026, about 11:59 PM ET. Scope changed mid-task: **no probes, no site tests, no curl through egress, no paid jobs, no LLM calls.** I only listed and read files on the AgentLab host and container (`/opt/agent`, systemd, cron, docker inspect, `df`, `du`, `ps`). Nothing was changed. No secret values were read: env and secret files were listed by variable name only, and settings were printed with key fields redacted.

Compared against `agentlab-capability-gaps.md` (written about 8 PM ET). Things in that list are not repeated unless they changed.

## A. NEW gaps (not in the old list), ranked for John

| # | Capability (Grok Bot has it) | AgentLab | Plain-language evidence | Fix | Effort / cost |
|---|---|---|---|---|---|
| 1 | **Push to phone when a job finishes or fails** | **Partial, switched OFF** | The ntfy sender exists in `runner/agentd.py` (~line 1910) but `runner/state/push.json` says `"enabled": false`. Telegram bridge runs but is "idle until token". Alerts go only to the web page. | Turn on ntfy (topic stays secret) or finish the Telegram token. | 10-30 min, free |
| 2 | **Alert from outside when the box or runner dies** | **Missing** | All alerting and the watchdog live inside the same runner/host. Cron has only usage, log scrub, backup, mail poll. No external heartbeat, no canary check that tools still work. If the box dies, nobody is told. | Free dead-man ping (healthchecks.io or UptimeRobot) from cron every 5 min, alerting to email/Telegram. Add a daily canary that runs `ytdl` on a known short clip. | 1-2 h, free |
| 3 | **Retention, cleanup, and real recovery for finished work** | **Missing** | `workspace` is 7.5 GB, of which `jobs/` is 6.9 GB across 195 job folders (largest 1.5 GB). Nothing deletes or archives them. The nightly backup **excludes** jobs, conversations, media, and the Chromium profile (`backup.sh` line 48), so finished videos live on one disk only. The profile in `workspace/desktop` holds every browser login and is not backed up either. Disk is only 25% full now (36 of 150 GB), so this is not urgent, but a server loss costs all footage and logins. | Weekly job: move jobs older than 14 days to B2 (or delete intermediates, keep final MP4 and brief), prune `ytdl-cache`. Add the browser profile to an encrypted backup. Take a Hetzner snapshot schedule (could not verify whether one exists). | 0.5-1 day; B2 about $0.006/GB/mo |
| 4 | **Auto-update of fast-rotting tools** (yt-dlp, gallery-dl, Chromium) | **Missing** | No timer or cron refreshes them. yt-dlp lives in a venv under `/workspace/usage/ytdlp-venv` that was upgraded by hand today. The proxy research already showed the old copy silently failed on YouTube. It will break again within weeks. | Nightly `pip install -U yt-dlp gallery-dl` into the venv, plus the canary from #2 to catch regressions. | 1-2 h, free |
| 5 | **Context compaction tuned to cost** | **Partial, set too loose** | Condenser is `llm_summarizing` with `max_size: 2000` events and `max_tokens: null`. It only fires after 2000 events, or by hard reset when the window overflows. Long Haiku jobs can reach the >100K-token range where the price is 5x. (I did not measure real conversation sizes.) | Trigger on tokens (about 80K) and a much smaller event count (about 100-150). Test on one long job. | 2-3 h; likely a net cost saver |
| 6 | **Leak-free subprocess handling** | **Partial** | 15 `mcp-server-fetch` processes (uv wrapper plus Python, about 82 MB each) are alive in the container, some 6 to 27 minutes old. They are orphans from finished conversations, never reaped, and the machine has 7.7 GB. The `fetch` MCP server is enabled even though `readpage` already does the same job. | Disable the `fetch` MCP server in settings (redundant) or add a reaper for children of ended conversations. | 30 min, free |
| 7 | **Searching past conversations** (like Grok Bot's transcript search) | **Missing (likely)** | `recall` only searches the saved facts store. Past conversations sit in `workspace/conversations` (265 MB) but I found no tool that searches or reads them. "What did we decide on the Dean video?" cannot be answered unless someone saved a note. (From the tool's docstring; I did not open every tool.) | Index conversation events into the memory DB's full-text search and add `recall --history-chat`. | 1 day, free |
| 8 | **Prompt-injection fencing in code** | **Partial (prompt only)** | `AGENTS.md` rule 5 says outside content is data, and only webhook payloads and triggered emails are wrapped in "untrusted DATA" fences in code (`agentd.py` line 1869, `mail-trigger-poll.py` line 52). `readpage`, search, `x-read`, subtitles, and browser text come back unfenced. The container environment carries key variables (Gemini, ElevenLabs, Deepgram, DeepSeek, OpenHands session key), and I found no outbound allowlist for the agent's own shell. A hostile page could ask the agent to send them out. The per-job user sandbox (`job-exec`) may limit this; I did not test it. | Wrap every web-reading tool's output in a fenced block; strip secret env vars inside `job-exec`; keep `AGENTS.md` rule 6. | 0.5-1 day, free |
| 9 | **Parallel work without fighting over one browser** | **Partial** | There is ONE shared Chromium and one process-wide browser connection (`browser-heal` docstring). Two concurrent runs (cap is 2) share tabs, logins, and the screen. Grok Bot gives each agent its own desktop. | Give helpers their own headless browser or pinned tab by default (`browser-shot --url` already uses a separate headless one); keep the shared headed one for logins. | 1-2 days |
| 10 | **Bounded logs** | **Missing** | The agent container uses docker `json-file` logging with no size limit (container log is already 47 MB). The old audit's scrub job handles secrets in files, not size. | Set `max-size`/`max-file` in docker daemon config (needs a container restart; schedule it). | 15 min, free |
| 11 | **Host timezone and cron clarity** | **Minor** | Host is UTC (`timedatectl`), container has `TZ` set, cron lines run in host UTC (backup at 3:00 UTC = 10 PM ET). Chromium follows the exit IP's timezone. Works, but easy to misread when a routine "ran at the wrong time". | Note it in `AGENTS.md`; make routine times explicit in America/New_York. | 15 min |

## B. Things in the old list that are now BUILT (it is stale)

Files on the server dated Nov 25 01:30-01:41 UTC (8:30-8:41 PM ET Nov 24). Built means the tool and code exist. "Dormant" means it needs a key or login I did not check the value of.

| Old row | Now | Status |
|---|---|---|
| Browser file uploads | `tools/browser-upload` | Built |
| Password vault autofill and TOTP | `tools/fill-login`, `fill-worker`, host service `agent-lab-vaultd` on 127.0.0.1:6072, running; logins stored as `LOGIN_<HOST>_USER/PASS/TOTP` | Built. Did not check whether any logins are stored |
| Captcha path | `tools/captcha-solve` (CapSolver/2Captcha) | Built, **dormant**: no `captcha.env` in `secrets/` |
| Stock footage search | `tools/stock-search` | Built, Pixabay key present. No Pexels key |
| SFX | `tools/sfx` | Built. Freesound key not present, falls back to ElevenLabs sound generation |
| X/Twitter reads | `tools/x-read` (no login, no API) | Built, best effort |
| Instagram/TikTok/X/Vimeo/Drive links | `tools/footage` | Built |
| Email-triggered routines | `tools/mail-trigger` + `ops/mail-trigger-poll.py`, cron every 2 min | Built (sender allow-list is required) |
| Telegram | `ops/telegram-bridge.py`, service running | Built, **idle** (see A1) |
| GitHub token | `tools/gh-ready` | Built, needs `GITHUB_TOKEN` secret |
| Browser geolocation | `chrome-keeper` sets timezone and geolocation from the exit IP, falls back to New York | Built. WebGL still SwiftShader, `--no-sandbox --test-type` flags present, no user-agent override |
| Model fallback on provider errors | `agentd.py` lines 347-420: on 5xx/429/overloaded/timeouts it switches to `lab-deepseek` then `fallback-gemini`, restores the original afterwards. 5 retries with 8-64 s backoff in every profile | Built (old list called this partial) |
| Crash resume | Runner watchdog resumes dead or stuck runs from the last checkpoint, handles an agent-server restart, alerts after 2 failures; vision helpers resume after a container restart | Built |
| Fable profile | `lab-fable.json` present | Built |
| Tesseract OCR | Still **not installed** | Still missing |
| Stale sign-in handoff and the yield hook | Not re-checked | Unknown |

## C. Core things that are fine (no action)

- Per-job user sandbox (`job-exec`, landlock library) and a `agent-guard` hook on destructive commands.
- Supervised services with restart (container `restart: unless-stopped`; systemd for chrome, desktop, egress, keys, runner, vaultd). Last container start was 8:29 PM ET today with 0 restarts since.
- Clock sync is on (chrony), firewall allows only SSH plus the web host's IP on 8000/8010/6080.
- Fonts: about 2,600 fonts installed (Google fonts, emoji, CJK/Noto), so Remotion captions and graphics will not fall back to a default.
- Nightly config backup to B2, 14 kept, last one 10 PM ET.
- Usage and cost metering every 15 minutes.

## D. Not checked (out of scope after the scope change, or code is on the web host)

Live egress to Cloudflare/Reddit/LinkedIn/Instagram/TikTok/Google, browser fingerprint pages, behaviour on a real 429/500, restart-resume in practice, how files and large videos reach John through the front end (code lives in the sms repo, not on this box), and upload size limits on the web host.

## Suggested order

1. Today, 1-2 hours total, free: A1 (push), A2 (external heartbeat), A6 (disable the redundant `fetch` MCP), A10 (log limits).
2. This week: A4 (auto-update plus canary), A5 (condenser tuning), A3 (retention plus backup of jobs and browser profile).
3. Next: A8 (fencing), A7 (conversation search), A9 (browser per helper).
