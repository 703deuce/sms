# AgentLab handoff for a fresh Chief of Staff clone

Written Thu Nov 26, 2026, about 6 AM ET, from memory notes, the research files below, and read-only checks of the server today (service list, docker, crontab, backup folder names, `sonnet-assist --help`). The chat history was not available. Each claim is tagged by where it came from:
**[file]** = a file named in section 7, **[mem]** = Chief of Staff memory (workstream or behavior rule), **[srv]** = checked on the server today, **[parent]** = the parent conversation summary or what the parent told John. **(unverified)** = nothing here proves it. Ticket IDs (COS-xx) are from [parent] only.

Everything lives with John Jones as the owner. Speak as John in his accounts. Hours only, never days.

---

## 1. What AgentLab is

One general autonomous agent for a single user (John first), built on **OpenHands 1.63.1** on **root@204.168.139.158** (Hetzner, 4 vCPU / ~7.6 GB, no GPU) [srv][file]. Goal: a full general agent, then a built-in "GoHighLevel / ServiceTitan replacement" for owners (CRM, booking, automations, phone agent), all configured by chatting with the agent [mem]. John's order: it must fully work for him alone first; multi-user separation, security hardening, user spend controls come last [mem].

**Access.** `ssh -i ~/.ssh/agentlab_root_ed25519 -o IdentitiesOnly=yes root@204.168.139.158`. Treat the key like a password: never print, copy, or paste it or any token [parent]. `scp` is slow (~3 s per file); batch copies or use one ssh heredoc [file: gap-fixes-status].

**Services (systemd, all active on Nov 26)** [srv]: `agent-lab-runner` (the run daemon: queue, routines, watchdogs; code `/opt/agent/runner/agentd.py`, also called agentd), `agent-lab-anthropic-shim` (`ops/anthropic_shim.py`, logs to `workspace/runs/anthropic-shim.jsonl`), `agent-lab-keys` (key proxy, `ops/keyproxy.py`; keys never enter agent processes), `agent-lab-embed` (local semantic search, 127.0.0.1:6075), `agent-lab-egress` (proxy gateway 127.0.0.1:18080, PAC on 18081), `agent-lab-chrome` + `agent-lab-desktop` (persistent desktop Chromium), `agent-lab-jobbrowsers`, `agent-lab-helper` (memory/skill/helper daemon), `agent-lab-vaultd` (login vault), `agent-lab-telegram` (idle, no token), `agentlab-connectors` (OAuth broker: Microsoft, Calendly, Salesforce, Zoho). Docker: `agent-lab` (OpenHands agent server, :8000), `agentlab-phone` (LiveKit phone worker), `searxng`.

**Layout** [srv]: `/opt/agent/` has `runner/` (agentd, skill_gate, goal_judge, loop_guard, learn_review, queue_policy, visual_gate, state/), `tools/` (the CLIs the agent calls: `readpage`, `egress-fetch`, `codesearch`, `repomap`, `autocheck`, `sonnet-assist`, `phone`, `connector`, `routine`, `fill-login`, `captcha-solve`, `stealth-fetch`, `qrun`, `usage`, `job`, ...), `ops/` (daemons, backup.sh), `embed/`, `oh-home/` (settings.json, hooks.json, `profiles/` incl. lab-anthropic = Haiku), `connectors/`, `phone/`, `secrets/` (never read), `workspace/` (jobs/, skills/, runs/runs.db, usage/, pages/), `backups/`, `tests/`, `AGENTS.md` (the agent's own hard rules). Cron: usage collect and log scrub every 15 min, nightly backup 03:00, mail-trigger poll every 2 min, history index every 5 min, weekly cleanup Sun 09:30 [srv]. (These are existing infrastructure; do not add routines that run just to run, see section 2.)

**Running jobs and tests** [srv][file]. Enqueue through the runs DB, as `tests/cursor_eff/launch.py` does:
`import runlib as R` (path `/opt/agent/tools`, env `RUNS_DB=/opt/agent/workspace/runs/runs.db`), `R.enqueue(db, prompt, "user", title=..., model="lab-anthropic")` returns `(run_id, conversation_id)`. Job folder is `/workspace/jobs/<conversation id>/` inside the container (host `/opt/agent/workspace/jobs/`). `tools/job`, `tools/runs`, `tools/usage --conversation` exist for status and cost. Test suites: `/opt/agent/tests/{hard5_nov25, customer22_nov25, custfix_nov25, cursor_eff}`; local copies in `/workspace/agentlab_tests/`. Lab price for Haiku 5.5: $0.10/M input, $0.50/M output [file: cursor-efficiency-status]. Before restarting the runner or container, make sure no run is active (`SELECT id,status FROM runs WHERE status IN ('running','starting')`) [file: cache-fixes ROLLBACK].

**Phone line** (separate workstream, live): +1 571-547-4814 on Telnyx, LiveKit Cloud project `sms-6w01zoya`, worker container `agentlab-phone`, front end `gpt-live-1` (voice marin, ~$0.05/min), back end Luna `gpt-6-luna`, tools save_message / check_availability / book_appointment / send_booking_link / transfer_call / end_call; calls land in `workspace/runs/phone/calls.db` plus a queued "[Phone call follow-up]" run. Config via `phone set ...` or chat [file: agentlab_phone/ARCHITECTURE.md][mem]. Quick off: `phone set '{"enabled": false}'` or `docker stop agentlab-phone` [file: agentlab_phone/ROLLBACK.md]. The chat front end (`agent-lab-chat`) is in the GitHub repo, not on the box (unverified: repo name and path; the audit says "GitHub").

---

## 2. John's hard rules and preferences (all of them)

**Safety and process**
- Never print secrets, tokens, signed URLs, env values. The root SSH key is a password [parent][file].
- Back up first, write a `ROLLBACK.md` in `/opt/agent/backups/<date>-<name>/`, then change. Re-read shared files (`agentd.py`, `runlib.py`, skills, MCP config) right before each edit; keep edits small [file: gap-fixes-status][parent].
- No new spending without John's OK. Already-paid items (CapSolver ~$6, DataImpulse proxy, Deepgram, ElevenLabs) are fine to use [parent][mem].
- No regex or keyword matching on free-text user input (routing, skill choice, intent). Use an LLM (Haiku router). String matching is only for our own structured data [mem].
- No multi-day estimates; quote hours. Features like these take minutes to hours [mem].
- Build everything discussed first, then cheap per-piece tests, then one real end-to-end test. No one-fix-one-test loops [mem].
- When a test job breaks: fix the cause right away and rerun to confirm, then show John what was wrong and what changed. Still back up first, and ask before spending [mem].
- Tests are real end-to-end jobs people ask for, including ones where the first approach fails; grade whether the agent finds another way and finishes. A site's bot-blocking (Target press-and-hold, Best Buy, etc.) is not the agent's fail: grade it "blocked", don't spend time or money on it. Spend fixing effort on real bugs like wrong skill routing [mem].
- Don't apply review advice John pastes from other bots unless he says to [mem][parent].
- Handle AgentLab work yourself. Don't hand it or reviews to QA, Security, Frontend, New or other team bots. Login/auth hardening is not a priority until John says [mem].
- No background routines or scheduled checks that run just to run (no daily owner report, no 30-minute usage check). Event-driven processes that run only when a job arrives are fine [mem].
- Keep usage minimal. Long jobs: let them run on the server and check about every 5 minutes, don't sit and watch [mem].
- Priority tier OFF [parent]. Don't change prod Transovo or deploy prod on your own [parent]. No Teams messages without approval [parent].
- Handoffs live together in one folder in the `703deuce/sms` repo on master (John, Nov 19) [mem]. This file is only on the box so far; it still needs committing there (needs John's OK to push).

**Models**
- Haiku 5.5 (`lab-anthropic`) runs everything. No Opus, no Fable [mem Nov 26]. Older facts about Opus visual ownership are superseded (the `lab-opus`/`lab-fable` profiles still exist on disk [srv]; `scheduled_profile` remaps them to Haiku [parent]).
- Profit rule: Haiku must finish at least 95% of jobs alone (target 97-98%) [mem].
- Sonnet 5.5 is only a minimal helper with a small context and short output, never the main agent, never takes over. Use only when it makes a real difference, as little as possible, without cutting corners [mem][parent].
- No per-job or daily caps for users; plan usage is the only limit [parent][srv: sonnet-assist help].
- Users never choose the model; routing is automatic [mem].
- Haiku compaction stays at an emergency backstop only (about 190K by John's decision; effective runner value is 75K via `agent-lab-runner.service.d/stage-split.conf`, per the coding status file). Don't tighten it (quality dropped on the premium documentary rerun) [mem][file: cursor-efficiency-status]. (Unverified: why the two numbers differ; check before touching.)
- Router job is narrow and ordered: (1) work out what the person really means (people are indirect), (2) pick skills from that, (3) ask one clarifying question if genuinely ambiguous or odd, rather than guess. Clear requests proceed without asking. Nothing else [mem][parent].
- Skills and prompts load on demand: small core, small focused skills, the system (not the model) enforces must-read files [mem].

**Phone agent** [mem unless noted]
- Don't touch the A2P numbers +1 571-749-1060 and +1 571-407-3615, or the toll-free +1 866-602-0680 config. Texts go out from the toll-free +1 866-602-0680. Transfer number (703) 816-6017 (also +17038166017 [parent]).
- Don't ring John except for transfer tests. Calls need approval, at most 1-2 per approval. Owner texts and emails stay OFF during tests (`notify.when=off`, email/sms false in `workspace/runs/phone/config.json`) [file: cache-fixes ROLLBACK][parent].
- Transfer accept takes a spoken yes OR press 1.
- Target: 97-98% of calls end correctly, graded only on outcomes (wrong info, missing/wrong booking or message, claimed action that didn't happen, failed transfer or emergency, caller repeating themselves several times). Brief talk-over is not an error; GPT Live is full-duplex, so stopping when talked over is correct.
- Backchannels ("mm-hm", "I see") are wanted. Response time is measured to the agent's first speech. Don't hand-write backchannel phrases into the prompt; follow the docs default.
- Tests are realistic after-hours calls only (normal booking, urgent transfer, angry caller, prices/hours, message, spam, holiday, rambler, changed mind, interrupter). No unrealistic cases like two people booked on one call.
- Don't tune by trial-and-error calls: analyze transcripts and docs offline, then confirm with one or two calls.
- Owner setup and changes go through AgentLab chat the way a customer would, not wizards or direct server edits; anything the agent can't change itself is a bug. Temporary overrides auto-expire. Time zones and slot math are deterministic code. GPT Live must never be blocked by the backend.
- Kept `gpt-live-1`; dropped `gpt-live-1.1` for now (less reliable at backend handoffs).

---

## 3. Done

Backups are under `/opt/agent/backups/` on the server; folder names carry the date (a `T..Z` suffix is UTC). Each has a ROLLBACK.md [srv].

| Area | State | Backup / evidence |
|---|---|---|
| Haiku default and routing | Haiku default Nov 24; Opus/Fable later turned off; `scheduled_profile` remaps them; `/models` reports haiku_only [parent][mem] | `2026-11-24-haiku-default`, `2026-11-25-haiku-only`, `2026-11-24-model-routing`, `2026-11-24-model-ownership` (older visual-owner design, now unused) |
| Cache work (COS-4) | One shared prompt prefix: `current_datetime` set to "", a `[Clock]` hook supplies time after the cache breakpoint, MCP args `--job auto`, 5m retention; one tools_sha across jobs; shim log shows high cache reads [parent][file] | `2026-11-26-cache-prefix`, `-cache-breakpoints`, `-cache-fixes`; audit scripts and output in `/workspace/agentlab_cache/` (`cache_audit2.txt` compares console vs server counts per day) |
| Sonnet assist modes | `sonnet-assist --mode code/visual/plan/math/legal`, about 22k input tokens, 8k output, `code-rescue` is an alias, every call logged, no caps [srv] | `sonnet-rescue-20261126T093726Z`, `sonnet-assist-20261126T095442Z` |
| Router intent | `skill_gate.py` ROUTER_SYSTEM returns intent, skills, `ambiguous`, `clarify_question` in the same Haiku call; `attach()` adds `[Intent]` and `[Ask first]` after the cache breakpoint; about +$0.00003 per call; `goal_judge.py` is separate, at finish [parent] | `router-intent-20261126T091051` |
| Phone settings and emergency email | Owner settings, emergency email decoupled from other alerts [srv backups exist; details unverified beyond the folder names] | `phone-owner-settings-20261126T083341`, `phone-emergency-uncouple-20261126T090209`, `phone-emergency-email-20261126T090723` |
| Phone line itself | Live as in section 1; architecture, GPT Live notes, offline call triage (partial: 16 of 110 calls read by hand), competitor study [file] | `2026-11-25-phone`; `/workspace/agentlab_phone/` |
| Proxy egress | DataImpulse residential gateway on :18080; rule since Nov 25: any blocked site retries residential, then mobile; normal sites stay direct. Earlier caps 300 MB/job, 1 GB/day, 80% alert (unverified whether still enforced); YouTube via `ytdl` / `yt-transcript` (yt-dlp 2026.11.23) [mem] | `2026-11-24-proxy-egress`, `2026-11-25-egress-fallback`; `research/agent-egress-proxies.md` |
| Capability phases | Phase 1 (handoff fix, Pixabay, TikTok/IG/X footage, SFX) and phase 2 (Telegram bridge built but idle, email-triggered jobs, captcha solver, browser uploads, price/hotel/maps playbooks, X reads without API, geolocation) approved by John; front-desk jobs skip the queue (`max_concurrent=4` for helpers, `max_frontdesk=8`) [mem] | `2026-11-24-buildout-p1/p2`, `2026-11-25-frontdesk-queue`, `2026-11-25-hard5-fixes` |
| Crash recovery | On crash: resume once in the same conversation and folder; refuse a second owner; if the retry fails, stop and report [mem] | `2026-11-25-crash-recovery` |
| CapSolver | Key is in `/workspace/secrets/captcha.env` inside the container (host `/opt/agent/workspace/secrets/captcha.env`); `captcha-solve --check` ready; about $6 balance (Nov 24). The earlier audit wrongly said "no key". Now called automatically by the blocked-site ladder (caps 3 per job, 15 per day, log `/workspace/usage/captcha-solves.jsonl`) [file] | |
| Hermes borrows and core 8 | Loop guard, goal judge, learn review, history search, browser-run, job-browser, 3-tier fetch etc. [file: gap-audit table] | `2026-11-25-hermes-borrows`, `-core8`; notes in `/workspace/agentlab_fix/` |
| Gap-fix items done | See section 4A [file] | `gap-fixes-20261126-101834` |
| Research written | `research/`: model routing, capability gaps (Nov 24), hidden gaps (Nov 24), builtin tools roadmap (Nov 25, COS-38), gap audit (Nov 26), feature gaps (Nov 26, partial) | |

---

## 4. In progress (exact state and next steps)

### 4A. Gap fixes (from `agentlab-gap-audit-nov26.md`). Paused at a safe point; spend about $0.01 [file: gap-fixes-status]
Backup `/opt/agent/backups/gap-fixes-20261126-101834/` has `files.tgz`, `crontab.txt`, `ROLLBACK.md`, and `staged-copies/` (new files, M5 patch script, `lab-doctor`). Local copies `/workspace/gap26/new/`, originals `/workspace/gap26/srv/`, Hermes clone `/workspace/gap26/hermes-agent` (read Hermes code there). Server was consistent when paused; crontab untouched.

**Done and tested:**
- S1: 429 backoff (honors Retry-After, cap 20 s, 2 retries on the same tier before paid tiers).
- S3: fetch cache, 20 min, `/workspace/usage/webcache`, `--no-cache` flag.
- M1: Chrome-TLS `curl_cffi` tier plus `altroutes.rescue()` (stealth browser direct, stealth browser residential with CapSolver, Wayback copy, search candidates, then `ask-user` hint), wired into `readpage` and `egress-fetch`; routes logged to `<job>/log/routes.jsonl`. Live test on g2.com (DataDome): all live routes 403, Wayback copy returned (2024).
- S4: `tools/stealth-fetch` (patchright, in `/workspace/usage/stealthvenv`). Passes example.com; does NOT beat DataDome. Not tested on other hard sites.
- S7 (partial): `tools/egress/fence.py` wraps untrusted web text and redacts key-shaped strings; used in `readpage` and `egress-fetch` only.
- N6: `readpage` spills pages over `--max` to `<job>/log/web/<hash>.txt` (code in place, never run on a long page).
- M5: `normalize_view_image()` and new `deliver_view()` loop in `runner/agentd.py` (shrinks to 1568 px, under 3.5 MB; reports failures instead of dropping silently). Unit-tested only. **Not live: the runner needs `systemctl restart agent-lab-runner` when no job is running.** No real oversized-image job has run.

**Partly done, with what is left:**
- M4 heartbeat/self-test: `lab-doctor` written but NOT installed on the server and never run. Copy to `/opt/agent/ops/lab-doctor` (chmod 755), run `lab-doctor --verbose`, fix false failures, then add two cron lines (every 5 min `--quiet`, weekly `--deep`). Writes `runner/state/doctor.json` and `heartbeat.json`, one deduped page notification on failure, optional dead-man ping from `/opt/agent/secrets/heartbeat.env`. Push and texts stay off. Note: John's no-routines rule is about checks that burn usage for no reason; `lab-doctor` is code with no LLM calls (unverified that John accepts it as a cron; confirm in one line before installing).
- S7: apply the fence to `x-read`, `yt-transcript`, `search` snippets, `mcp-fetch-egress`.
- S6 secrets: check which env var NAMES the job shell sees and strip key variables in the sandbox (a post-tool redaction hook is likely not possible in OpenHands).
- S2 search ladder: `ddgs` and `rapidocr-onnxruntime` installed in the stealth venv; add rungs to `tools/search` (read Hermes `plugins/web/keyless_mcp.py`). SearXNG has DuckDuckGo disabled.
- S8 readdoc: write `tools/readdoc` (pdftotext, pypdf, pdfplumber, pandoc, LibreOffice, then OCR).
- M2: edit `runner/goal_judge.py` so `blocked_by_site` with fewer than 3 route types in `log/routes.jsonl` sends one "try these routes" message (counts as one of its 2 extra rounds; fail open). The ladder's rule: a job may end "blocked" only after at least 3 different routes are logged [parent].

**Not started:** M3 provider-outage handling (shared `provider-health.json`, scheduled-run retry at 5/15/30 min, one catch-up for a missed routine, deduped failure alerts; edit `agentd.py` around the fallback code ~lines 563-636 and the routine scheduler ~1539; re-read first, COS-43 touches that file); S5 (dead `bgjob`s in the `[Recovery]` note); S9 non-download YouTube route; N1 JS dialogs/iframes; N2 empty-response guard; N3 skill curator; N4 script tool; N5 URL log per job. No real Haiku jobs have been run for the blocked-site ladder or image shrink: do those as the small tests after building.
Also still open from the Nov 24 hidden-gap list: push to phone (`runner/state/push.json` `enabled:false`; built but off until John OKs), no outside heartbeat, job retention/offsite backup of job folders (see `agentlab-hidden-gaps.md` row 3).

### 4B. Cursor-style coding efficiency (COS-43). All 5 pieces built and live; proof only partly done [file: cursor-efficiency-status]
Backup `/opt/agent/backups/cursor-efficiency-20261126T095533Z/` (ROLLBACK.md; quick off `touch /opt/agent/tools/flags/AUTOCHECK_OFF`). Built: (1) `codesearch` semantic+BM25 search over job repos via `agent-lab-embed` (tree-sitter chunking, content-hash embedding cache, auto-index of repos from jobs in the last 2 h); (2) `repomap` (PageRank, ~1k tokens); (3) OpenHands `grep`/`glob` tools added to `oh-home/settings.json` (same tool list for every job, so the cache holds); (4) long output as files (`qrun` default; `write_transcript()` writes `<job>/log/history/transcript-N.md` before each condensation); (5) `autocheck` hooks (pre/post/stop) that report only new failures. Untouched on purpose: code-rescue/sonnet-assist/keyproxy files, skill_gate, phone worker.
Results (h1 more-itertools fix, 2 runs each): before PASS, FAIL; after PASS, PASS; after used fewer calls and minutes; cost $0.01-0.024 per run. **Caveat in the file: the after agents did not call codesearch/repomap/grep/glob on this task, so the gain is not proven to come from the new tools; n=2 is noisy.** Total spend about $0.08.
**Left (do these):**
1. Run `python3 /opt/agent/tests/cursor_eff/launch_proof.py` (staged, never run), then check the reply and events for grep/glob calls, the autocheck deny reaching a live job, 3 codesearch top hits plus `repomap.txt`, and where long output lands (qrun to `log/out/`; plain terminal clipped).
2. Force a condensation live (`POST /api/conversations/{cid}/condense`, or a run past 75K) and confirm `log/history/transcript-1.md` and the restore note.
3. Optional: codesearch ranking favors docs over code (ky Retry-After query missed `Ky.#calculateRetryDelay`; "peekable" query hit at #5).
4. Watch `agent-lab-embed` memory (~2.2 GB after indexing; MemoryHigh 2200M, Max 2500M); if throttled lower `MAX_ROOT_FILES` or batch size.
Then give John the before/after table and ask whether he wants the optional Haiku vs Sonnet coding head-to-head.

### 4C. Real feature gaps (draft, partial) [file: agentlab-feature-gaps-nov26]
Verified on the server by reading skills/code; Hermes code NOT read line by line (only file names); front end, Reddit demand check, current Claude/ChatGPT/Muse behavior NOT checked; which routines are active and what `mail-send` allows now also unchecked. Hours from the file:
- **Must:** (1) buy things with approval, checkout/reorder/pay bill, 10-14 h, needs John's yes on card source or virtual-card fees; (2) booking restaurants/flights/hotels/appointments, 8-12 h + 6-8 h; (3) order/return/cancel actions behind a login, 6-8 h; (4) messaging apps, Telegram live needs only a bot token (1-2 h), then SMS-to-agent, WhatsApp, Slack, Discord at 3-5 h each; (5) watch and alert (price/stock/page/RSS) on top of `routine --script`, 4-6 h; (6) Google tools (Gmail, Calendar, Drive, Sheets), 6-10 h, John's call on the route (OAuth in testing mode vs IMAP app password vs service account; John earlier excluded integrations needing OAuth app review [mem]).
- **Should:** daily briefing (3-4 h; must be opt-in, see no-routines rule), meeting join and notes (8-12 h free route via Hermes' Meet bot; Recall.ai needs a yes), outbound errand calls `phone dial` (6-8 h, each call needs approval), maps/weather/stock `lookup` CLI (3-5 h), interactive pages with small JSON store (6-10 h), projects (4-6 h), PDF form fill (4-6 h), voice in chat (4-8 h, front end), skills hub (4-6 h).
- **Nice:** learn from screen recording (14-20 h), work on John's own computer (10-16 h), document Q&A (overlaps COS-38 `kb`), finance model skills (3-5 h), notes tools (3-4 h each), photo tools (2-3 h, check `rembg` first).
- Paused next steps: finish the unchecked items above, then build; the file's own suggested order is Telegram + watch + lookup + briefing (~12 h, free), then approval step + checkout/booking/orders (~25-30 h, needs John's yes on spend), then Google/meetings/errand calls/pages/PDF.

### 4D. Thread rollover for AgentLab (NOT STARTED; requirements from the parent, source [parent])
Why: John (t1117u/t1118u) wants a fresh clone of Chief of Staff so old context stops costing usage, while it still knows what is done, in progress and being considered [parent]. This handoff file is the first piece. Rollover requirements to build, in this order of use:
- **(a) Pinned facts word for word.** Durable facts (rules, decisions, IDs, paths, open work) are carried over verbatim, never summarized. Keep them in one pinned file the new thread loads at start (this file's sections 2 and 5 are the seed; copy the memory rule text exactly, not paraphrased, when promoting them). Unverified: the file format and where it lives.
- **(b) Search over the full saved transcript.** The new thread can pull old detail on demand through keyword + semantic search over the whole old transcript. Starting point: the box already has `history-search` (indexed every 5 min by cron) for AgentLab conversations and the `agent-lab-embed` service with BM25 + vectors [srv]; whether either can index this Chief of Staff transcript is unverified. The parent's `SearchTranscripts` / `ReadTranscript` tools exist but returned "no record" in my session, so confirm the clone can read the old transcript.
- **(c) Completeness check before switching.** A quick Haiku pass reads the old thread and the handoff and verifies every open item, rule and decision in the old thread appears in the handoff, then fills any gap. Use an LLM, not regex or keyword matching (John's rule). Keep the prompt small to save usage. Do not switch until the pass reports no missing items.
- **(d) Recall test.** Ask the new thread questions whose answers exist only in the old history (e.g. an exact rule wording, a backup folder name, a ticket ID, an earlier decision) and check each answer against the source. Small set, realistic questions, one run (John: small cheap tests, usage minimal). Pass only if answers match; fix the handoff or the search and rerun.

---

## 5. Under consideration, or waiting on John

- **Phone post-call ideas** (from the Nov 26 write-up; the competitor study is `agentlab_phone/COMPETITORS.md`, the post-call write-up itself is NOT saved as a file, only in the parent chat). 12 ideas; **top 5 (about 2-4 h each):** (1) after-call research brief on the caller, (2) job-prep notes on the calendar event, (3) draft quote/estimate sent only after owner approval, (4) approval-gated no-book and estimate-sent follow-ups, (5) FAQ gaps turned into researched answers approved into the phone prompt. Others: weekly opt-in call report with a missed-revenue sketch, owner-approved confirm/reschedule callbacks, owner phones the agent to give instructions, call vendors for the owner, push to CRM/Sheets/Slack without Zapier (rides along with the CRM), payment/deposit link after booking (later; Stripe Connect, then Square, then QuickBooks which needs app review [mem]). The existing post-call hook queues a run after each call but only posts the message today [parent]. John will pick the next build from this.
- **GHL / ServiceTitan automation list** (ranked, evidence from Reddit/forums; NOT saved as a file; John said table-stakes ones like missed-call text-back, reminders and review requests are out): (1) silent-failure watchdog, test lead/call through the owner's setup and fix what broke; (2) books reconciler, Jobber/Housecall Pro vs QuickBooks duplicates and drift; (3) A2P/10DLC registration fixer; (4) zero-touch setup from the owner's website and Google profile; (5) price-increase planner; (6) Google Local Services Ads lead auditor; (7) tech notes to invoice. Thinner: warranty claims from serial plates, supplier-price margin watcher, review replies. The agent writes to Jobber/HCP/ServiceTitan APIs or the sites directly. My earlier pick was 1+2 together, then 4, then 3; John said he only wanted to know, and that the core agent comes first, so none of this starts yet.
- **Built-in open-source CRM + calendar/booking (COS-45, queued)**: the third thing in John's order (coding work, phone write-up, then this). Users can still connect their own (Calendly, HubSpot, etc.). Design lean from `research/agentlab-builtin-tools.md` (COS-38): a "tool pack" = skill + CLI + SQLite store + event log with undo + `--dry-run`, with connector adapters when the owner has their own app; a full open-source app only when it clearly beats that. Starts after the gap fixes and coding proof, and after John answers. No new spending without his OK.
- **Front-end Haiku ceiling test**: find how far Haiku gets with shadcn/Tailwind alone (no kit), section by section then assembled, avoid a templated look. **Held until John says go.**
- **Router owner-setup line (COS-40 follow-up)**: give the router a line about the owner's setup (phone agent live). Awaiting John.
- **Optional Haiku vs Sonnet coding head-to-head.** Awaiting John.
- **Paid extras awaiting a yes:** a cloud stealth browser (Browserbase / Bright Data; my advice, hold: it helps against fingerprint/IP blocks but still loses on Glassdoor, G2, Target; revisit only if real jobs keep failing), a second Anthropic key, a Brave or Tavily search key. Push alerts and phone texts stay off until John OKs. Not paid, no ask needed: CapSolver.
- **Other older open items:** Telegram needs a bot token; Google access (also needed for Google Business Profile/local SEO) is undecided; John still needs to verify the Outlook account [parent]; older tickets COS-5, 6, 9, 13, 17, 18, 19, 27, 38 are open (details NOT in any file I have; check the task tracker).

---

## 6. Suggested order

1. Finish the gap fixes: install and run `lab-doctor`, M2 (goal_judge), S7/S6/S2/S8 leftovers, M3 outage and missed-run handling, then S5/S9 and the N items. Restart the runner when idle to make M5 live. Then small real tests: one blocked-site job through the ladder, one oversized-image job, one provider-outage simulation.
2. Finish the coding proof (4B items 1-3), report the before/after table. (Can run alongside step 1 on different files; the server is shared, re-read before each edit, and don't restart services mid-run.)
3. Finish and build the feature gaps (4C), starting with the free ones, and ask John for yes on spend before checkout or booking.
4. Thread rollover (4D): build (a)-(d), run the completeness check and the recall test, then switch to the new thread. If John wants the switch before the other work finishes, do it first, since the handoff is already written.
5. Built-in CRM + booking (COS-45), then whichever phone post-call idea John picks, then the automation list.
Front-end test only on John's "go".

---

## 7. File index

| What | Where |
|---|---|
| Gap fixes status | `/workspace/transovo_team/research/gap-fixes-status.md` |
| Cursor-efficiency status | `/workspace/transovo_team/research/cursor-efficiency-status.md` |
| Feature gaps (partial) | `/workspace/transovo_team/research/agentlab-feature-gaps-nov26.md` |
| Gap audit vs Hermes/Grok/Claude/ChatGPT/Muse | `.../research/agentlab-gap-audit-nov26.md` |
| Capability gaps Nov 24 (Grok vs AgentLab, 46 KB) | `.../research/agentlab-capability-gaps.md` |
| Hidden infrastructure gaps | `.../research/agentlab-hidden-gaps.md` |
| Model routing research | `.../research/agentlab-model-routing.md`, `haiku-vs-opus-*.md`, `haiku-default-lean-context.md`, `model-routing-production-agents.md`, `prompt-tool-caching-production-agents.md` |
| Built-in tools / CRM roadmap (COS-38) | `.../research/agentlab-builtin-tools.md` |
| Proxy research | `.../research/agent-egress-proxies.md`, `proxy-live-test-nov24/` |
| Phone notes | `/workspace/agentlab_phone/` (ARCHITECTURE, COMPETITORS, GPTLIVE_NOTES, CALL_TRIAGE, ROLLBACK, `src/`, `docs11/` OpenAI Live docs) |
| Cache audit | `/workspace/agentlab_cache/` |
| Earlier fix notes and results | `/workspace/agentlab_fix/` (FIXES.md, RESULTS.md, HERMES_BORROWS.md, CORE8.md, ROLLBACKs) |
| Test outputs | `/workspace/agentlab_tests/` (hard5, customer22, custfix, block_diag, deanrayj_* runs) |
| Gap-fix working copies and Hermes clone | `/workspace/gap26/` |
| Other working dirs | `/workspace/agentlab-pt`, `-mo`, `-cr` (crash recovery), `-egress-src`, `-stage` |
| Server backups | `/opt/agent/backups/` (see section 3) |
| Server test harness | `/opt/agent/tests/` |
| Agent's own rules | `/opt/agent/AGENTS.md`; skills in `/opt/agent/workspace/skills/` (45 skills at the audit) |
| Team context | `/workspace/transovo_team/TEAM.md`, `HANDOFF.md` (Transovo app, not AgentLab) |
| Not saved anywhere (only in the parent chat) | phone post-call write-up, GHL/ServiceTitan automation research, the COS ticket list |


## Repo note (John, Nov 26)
Only the AgentLab front end lives in the 703deuce/sms repo. The server and backend exist only on the AgentLab server (204.168.139.158), not in any repo. The rule about putting handoffs in the repo applies to production Transovo, not AgentLab.

## Credentials on this box (shared computer, so you already have all of these; never print values)
- SSH: `~/.ssh/agentlab_root_ed25519` (AgentLab server root), `~/.ssh/grokbot_hetzner_ed25519`, and `~/.ssh/config` for host aliases.
- `/workspace/secrets/`: `dataimpulse_proxy.env` (residential/mobile proxy), `pixabay.env`, `livetest_job.token`, `motion_production.env`, `motion_runner.env`, `transovo_coordinator_admin.key`.
- GitHub: `gh` is logged in as 703deuce through GITHUB_TOKEN. The cursor-github connector is also available.
- Supabase: the user-Supabase connector.
- Server-side keys (Anthropic, OpenAI/GPT Live, LiveKit, SIP/Twilio, CapSolver, connectors) live on the AgentLab server under `/opt/agent/secrets/` and `/opt/agent/workspace/secrets/`. They are served through `agent-lab-keys`. Don't read them unless a task needs it, and never print them.
- Repo backup (John, Nov 26): back up AgentLab server code, configs, skills and docs into an agent folder in 703deuce/sms through a branch and PR. Never commit raw keys. Back up secrets only encrypted.
