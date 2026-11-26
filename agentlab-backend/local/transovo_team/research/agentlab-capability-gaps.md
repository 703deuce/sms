# AgentLab capability-gap audit (Grok Bot vs AgentLab)

## Single-user full list (Nov 24, John's scope)

Written Tue Nov 24, 2026, about 8:00 PM ET. Read-only; nothing on the server was changed. The proxy, `ytdl` / `yt-transcript`, yt-dlp upgrade, and browser PAC work are being deployed by another worker and are marked **in progress** — not touched.

**Scope (from John):** compare every capability Grok Bot genuinely has and uses with what AgentLab has today, at a finer grain, ranked by impact on John using AgentLab himself for Transovo work (research, footage gathering, video editing, Motion Studio, general web tasks).

- Excluded: scaling to many users (isolation, tenant separation, spend caps or approvals for users, security hardening) and moving renders to Modal (John will get a bigger VPS later).
- Excluded: integrations that need an OAuth app review (Google Drive, Gmail API). Logins go through a password vault plus the browser. API keys and simple tokens are fine.
- Costs marked "~" are estimates from memory of public pricing; confirm before buying.

### Already in progress — do not start or change

As of 7:53–8:00 PM ET the other worker had already written, and in some cases started, the following. The live Chromium process is already running with `--proxy-pac-url=http://127.0.0.1:18081/proxy.pac`, `--lang=en-US`, and the block-images extension. `AGENTS.md` already documents the YouTube size tiers.

| Item | What is on the server now | Status |
|---|---|---|
| Residential egress gateway | `EGRESS_PROXY` default `http://127.0.0.1:18080`; `tools/egress/proxy.pac` allowlists YouTube, googlevideo, selected Google hosts, and Amazon (AWS/payments stay DIRECT); `secrets/dataimpulse_proxy.env` present (not read) | In progress |
| YouTube tools and size tiers | `ytdl`, `yt-transcript`, `yt-dlp` → `ytdl`; tiers transcript / frames (240p) / full; 5 retries on a new sticky IP; cache under `/workspace/usage/ytdl-cache/` | In progress |
| yt-dlp upgrade | Wrapper prefers `/workspace/usage/ytdlp-venv/bin/yt-dlp`; that venv has yt-dlp 2026.11.23 (the system copy was 2026.10.26 earlier today) | In progress |
| Browser proxying | `chrome-keeper` launches Chromium with the PAC, `TZ=America/New_York`, and `egress/block-images-ext` | In progress; flags are on the live process |
| Proxy meter | `egress-usage` reads `/workspace/usage/egress` | In progress |

Remaining browser-identity work after that lands (geolocation matched to the exit IP, SwiftShader/WebGL tells) is listed below as a follow-on, not as a new proxy project.

### What AgentLab already has (not gaps)

These match what Grok Bot uses, closely enough that they are not on the work list:

- Headed 1920x1080 desktop, live screen on the Agent Lab page, persistent Chromium profile, screenshots (`browser-shot`, `desktop-shot`), and computer-use of GUI apps (`vision-act` / `helper --vision`).
- Hand the screen to John (`handoff` + "I'm done") — see the stale-handoff bug under quick wins.
- PDF reading (`pdftotext`, `pypdf`, `readpage`, `look` / `watch-media` on PDFs).
- Document, spreadsheet and slide generation (`python-docx`, `openpyxl`, `python-pptx`, LibreOffice, pandoc).
- Image generation and editing (Gemini nano-banana and KIE), video generation (KIE wan).
- Watching and understanding videos (`agent_view` / `look` frames, `watch-media` to Gemini for picture + sound).
- TTS (ElevenLabs flash; `edge-tts` is also installed as a free fallback).
- Transcription (Deepgram nova-3 with word times and speakers; local faster-whisper on CPU).
- File conversion (ffmpeg, sox, ImageMagick, pandoc, soffice, poppler).
- Music generation (ElevenLabs Music via `scripts/gen_music.py`, about $0.15/min with a $2 cap in the script).
- Own email inbox (`anthony-9640@agentmail.to`): receive, list, read, wait for signup codes (`mail-inbox wait --code`), reply to a thread, attach files. New mail is restricted (see gaps).
- Cron, one-off reminders, and secret-URL webhook routines (one active daily job).
- Durable memory (`remember` / `recall` / `project-note`) and a skills mechanism (`agent_skill`, `save-skill`) — the library itself is thin (3 skills).
- Parallel helpers and background jobs (`helper`, `bgjob`); default cap is 2 concurrent runs.
- Task tracking (`agent_task_start`, `agent_verify`, checkpoints, completion hook).
- Usage totals by day and conversation (LLM + helpers + media). Not yet split by model in the CLI.
- Shareable report pages (`publish` → `https://transovo.ai/app/agent-lab/pages/<slug>`, Chart.js allowed).
- Fetching pages to markdown (`readpage`: trafilatura + readability, Playwright fallback, PDFs too). Blocked sites still fail until the proxy work is finished.
- Browser downloads land in `/workspace/desktop/downloads`. Files John attaches arrive under `uploads/` in the job folder.
- MCP install for API-key servers (`agent_mcp_find` / `connect`); context7 docs has been used. No OAuth (out of scope).
- Nightly offsite backups to Backblaze B2.

### Ranked work for John

Grouped by effort. Ranked inside each group by impact on John's own Transovo work.

#### Quick wins (under 1 day, free or nearly free)

1. **Fix the stale sign-in handoff, make handoffs expire, and repair the hook that should pause the agent while John has the screen.** A test handoff from Nov 23, 7:18 PM ET is still "waiting" (it expired at 7:48 PM ET that night and was never cleared), so by the code the agent should be locked out of desktop clicks. Browser tool calls have still been succeeding, which suggests the yield hook is not matching `browser_*`. Free. About half a day.
2. **Pexels and Pixabay stock-search tool, with a licence field on every clip.** Both APIs are free; no keys are on the server today. Half a day to a day. High impact for Motion Studio.
3. **Footage-gathering skills** for Instagram, TikTok, X, Vimeo, and public Drive/Dropbox links, plus when to use transcript vs 240p vs full (YouTube tiers are already being written into `AGENTS.md`). Free. About a day.
4. **Install `gallery-dl` (and `instaloader` if useful) and wrap them through the egress gateway** once the proxy is up, so Instagram, TikTok and X downloads have a real tool rather than a raw `yt-dlp` hope. Free software. Half a day.
5. **Freesound (or similar) SFX search and download.** Free API. Half a day. Motion Studio already scores with ElevenLabs Music but has no SFX library.
6. **A Telegram bot so John can message AgentLab from his phone** and get the reply there. Bot token only, no app review. Free. Under a day. (Slack and Discord are similar and listed under medium.)
7. **Email-triggered routines:** point an AgentMail inbound webhook at the routine webhook that already exists. Free. Half a day.
8. **Put a GitHub personal access token in the vault and log `gh` in**, so helpers can push and open PRs. `gh` is installed and currently reports "not logged into any GitHub hosts". Token only, no OAuth app. Free. Half a day.
9. **Per-model breakdown in `usage`.** Media calls already log a `model` field in `usage.jsonl`; the CLI only prints LLM vs media totals by day and conversation. Free. Half a day.
10. **Install Tesseract OCR** for text in screenshots and stills (not on the box now). Free apt package. About an hour.

#### Medium (1–3 days)

1. **Better web search.** SearXNG is live with only Yahoo, Brave, Mojeek and Wikipedia enabled (Google, Bing and DuckDuckGo are disabled). It falls back to Gemini-with-Google-Search when it finds nothing, but everyday research is weaker than Grok Bot's search index. Add Brave Search or Tavily as the primary API and keep SearXNG as backup. Brave has a free tier, then about $5 per 1,000 queries (~). About a day.
2. **Password-adjacent follow-on: TOTP plus a captcha path.** Email one-time codes already work (`mail-inbox wait --code`). Add `pyotp` for authenticator codes stored in the vault; for captchas, use the residential IP first, then CapSolver or 2Captcha (about $1–3 per 1,000 solves, ~), plus a short press-and-hold playbook using the existing desktop `click` / `--hold-ms` tools, with handoff to John as the last resort. 1–2 days. (Full vault autofill is in Bigger.)
3. **Browser file uploads without a handoff.** Downloads already work. File pickers are documented as "hand off to Rick." Add a `setInputFiles` / desktop helper that attaches a path from the job folder. Free. About a day.
4. **Product and price search.** Grok Bot uses a real catalog tool. AgentLab can only search the web or browse a store (Amazon is in the PAC allowlist). A skill plus the headed browser unblocks most of this; a catalog API is optional later. Free if browser-only. 1–2 days.
5. **Flights, hotels, and maps/places playbooks** for the headed browser (the same way Grok Bot does it — no new API required). Free. 1–2 days.
6. **X / Twitter reads** via a simple-token service (for example twitterapi.io or similar) or a logged-in browser session once the vault exists. The official X API is expensive (on the order of $200/mo, ~) and is not the first choice. 1–2 days.
7. **An SMS inbox for verification codes** (Twilio or a receive-SMS number). About $1–2/mo (~). About a day. Email codes already work; this covers the sites that only text.
8. **Outbound email to anyone, as a draft John approves.** Today new mail can only go to the inbox and anthony@transovo.ai; replies to a thread in the inbox are allowed. Keep the allow-list for unattended sends. Free. 1–2 days.
9. **Supabase or Postgres access with a service-role or API key** (MCP or `psql`). No client and no keys are installed. Free software. About a day.
10. **Light auto-review for John only:** confirm with him before sending mail off the allow-list, before a large paid media or LLM call, and before a `git push`. Not a multi-user spend-cap system. Free. 1–2 days.
11. **A Slack or Discord channel** with a bot token (private workspace, no app review). Free. 1–2 days.
12. **Remaining browser identity after the PAC work:** set geolocation to the exit IP (timezone is already America/New_York), and reduce the SwiftShader WebGL tell. Software free; uses the existing proxy budget. 1–2 days. Do not start this until the other worker has finished the PAC deploy.
13. **Learn-from-demonstration:** turn a screen recording of John doing a task into a reusable skill (the Grok Bot skill of the same name). Free. 2–3 days.

#### Bigger (3+ days, or a paid product decision)

1. **A password vault that fills the browser without the model seeing the password, plus TOTP.** This is the main remaining sign-in gap. AgentLab's vault today holds API keys for MCP servers; it cannot autofill a site login, and `AGENTS.md` forbids asking for passwords in chat, so every login is a handoff to John. Vaultwarden or Bitwarden CLI is free. 3–4 days. Highest-impact item after the proxy work.
2. **Voice memos on the Agent Lab page** (John records a note, Deepgram transcribes it). Deepgram is already billed per minute (~$0.0043/min). 2–3 days.
3. **Join Meet or Zoom and pull a transcript** (Recall.ai or Meeting BaaS, about $0.50–0.70/hr, ~). 2–3 days. Useful for client feedback; not core clipping.
4. **Phone calls** (Twilio plus a voice model, or Vapi/Retell, about $0.07–0.15/min, ~). 3–5 days. Low value for Transovo's core jobs.
5. **A card vault with a per-purchase approval** so the agent can buy stock footage or a tool when John taps yes. 3+ days. Only if John wants the agent to pay for things; otherwise keep payments human-only.
6. **Richer interactive Pages** like Grok Bot canvases. 3+ days. Today's `publish` already covers shareable reports and charts.
7. **Cloud coding agents.** `claude-agent-acp`, `codex-acp` and `tiny-agents` are installed and unused; helpers already code in worktrees but cannot push until the GitHub token (quick win #8) is in. Wiring a cloud agent is 2–3 days and is optional once `gh` works.

### Full inventory (finer grain)

Legend: **Y** = AgentLab has it, **P** = partial, **N** = no, **IP** = in progress (do not touch). Effort is to close the gap. "Grok Bot" means this assistant, as actually used.

| # | Capability | AgentLab | Evidence (read-only) | Concrete fix | Cost / effort | Impact for John's own work |
|---|---|---|---|---|---|---|
| 1 | Residential-IP egress for hard sites | **IP** | PAC, gateway, `ytdl` / `yt-transcript`, `dataimpulse_proxy.env` | Finish the other worker's deploy; do not start a second one | ~$1/GB (already topped up $5) | P0 — unblocks YouTube and Amazon |
| 2 | Browser proxy via PAC, US TZ, block images | **IP** | Live Chromium has `--proxy-pac-url` and block-images ext; `chrome-keeper` sets `TZ=America/New_York` | Let the other worker finish | included | P0 |
| 3 | YouTube transcript + 240p/full tiers, retry, cache | **IP** | `tools/ytdl`, `tools/yt-transcript`; `AGENTS.md` tiers 1–3 | Let the other worker finish | included | P0 |
| 4 | Browser geolocation / WebGL coherence | **P** | TZ is New York; IP was Hetzner Helsinki (will change for allowlisted sites); WebGL is SwiftShader | After PAC is done: geolocation override to the exit IP; optional camoufox/patchright | free; 1–2 days | P1 — Amazon and logged-in sites still flag VMs |
| 5 | Headed desktop, live screen, screenshots | **Y** | `agent-lab-desktop`, `browser-shot`, `desktop-shot`, `agent_view` | n/a | n/a | already has |
| 6 | Computer use of GUI apps | **Y** | `vision-act`, `helper --vision` (deepseek-flash / gemini-flash) | Keep; optional reliability eval later | n/a | already has |
| 7 | Hand John the screen (sign-in, passkey, hard captcha) | **P** | `handoff` + Live screen + "I'm done"; a Nov 23 test handoff is still `waiting`; expiry is not enforced; `desktop-yield` hook may not match `browser_*` | Expire and clear handoffs; fix the hook; ntfy already pushes "needs_rick" | free; 0.5 day | P1 — every login depends on this today |
| 8 | Password vault + browser autofill (model never sees the password) | **N** | Vault is OpenHands secrets for MCP env vars only; no fill tool; AGENTS.md: never ask for passwords in chat, hand off instead | Vaultwarden/Bitwarden CLI + a `fill-login` tool that types into the page without returning the value | free; 3–4 days | P1 — highest remaining sign-in gap |
| 9 | One-time codes from email | **Y** | `mail-inbox wait --code` | n/a | n/a | already has |
| 10 | TOTP / authenticator 2FA | **N** | no `pyotp`; no TOTP in tools or env names | Store seeds in the vault; `pyotp` | free; folds into #8, or 0.5 day alone | P1 with #8 |
| 11 | SMS / phone-number verification | **N** | no Twilio (or similar) in env or tools | A receive-SMS number (Twilio or a rented inbox) | ~$1–2/mo; 1 day | P2 — only for sites that will not email a code |
| 12 | Captcha solving (reCAPTCHA, hCaptcha, Turnstile) | **N** | grep found no CapSolver/2Captcha/anticaptcha; no stealth browser packages | Residential IP first; then a solver; handoff last | ~$1–3 / 1,000; 1–2 days | P1 — unattended runs stall here |
| 13 | Press-and-hold (Cloudflare-style) | **P** | Desktop `click` and `key --hold-ms` exist; no playbook; vision-act could try it | A short skill: screenshot, locate the box, hold, verify | free; hours, with #12 | P1 |
| 14 | File downloads in the browser | **Y** | `desktop-open` docs: downloads go to `/workspace/desktop/downloads` | n/a | n/a | already has |
| 15 | File uploads in the browser | **P** | AGENTS.md: "file pickers: hand off to Rick." No `setInputFiles` helper | CDP / Playwright `setInputFiles` or a desktop picker helper | free; 1 day | P1 — uploading footage to a tool or form |
| 16 | PDF reading | **Y** | poppler, pypdf, `readpage` on PDFs, `watch-media` / `look` | n/a | n/a | already has |
| 17 | OCR on images / screenshots | **N** | `tesseract` is missing; vision models can read text but are costlier | `apt install tesseract-ocr` | free; 1 hour | P2 |
| 18 | Doc / spreadsheet / slide generation | **Y** | python-docx 1.2, openpyxl 3.1.5, python-pptx 1.0.2, LibreOffice, pandoc | n/a | n/a | already has |
| 19 | Image generation and editing | **Y** | `image-gen` / `image-edit` (Gemini nano-banana-2.1); `gen-image` (KIE) | n/a | paid per call, already metered | already has |
| 20 | Video generation | **Y** | `gen-video` (KIE wan/3-0-video) | n/a | paid per second, already metered | already has |
| 21 | Watch and understand user videos | **Y** | `watch-media`, `look --frames`, `agent_view`; uploads land in `uploads/` | n/a | Gemini / look costs already metered | already has |
| 22 | Web search quality | **P** | SearXNG: Yahoo, Brave, Mojeek, Wikipedia on; Google/Bing/DDG off; Gemini Google Search fallback when empty. `AGENTS.md` still mentions Bing, which is disabled | Brave Search or Tavily as primary; keep SearXNG | free tier then ~$5/1k; 1 day | P1 — everyday research |
| 23 | Fetch pages to markdown | **Y** | `readpage` (trafilatura, markdownify, Playwright, PDFs) | Blocked sites wait on the proxy work | n/a | already has, plus IP |
| 24 | X / Twitter reads | **N** | no X client, no token, no skill; `gallery-dl` / `snscrape` / `twscrape` missing | Token-based Twitter API proxy, or logged-in browser after #8 | cheap token APIs or skip official $200/mo; 1–2 days | P1 for trend/reference research |
| 25 | Product and price search | **N** | no catalog tool; only `search` + browser | Skill + headed browser; optional catalog API later | free; 1–2 days | P2 for Transovo, useful for general web tasks |
| 26 | Maps and places search | **N** | no Places/Mapbox key; no maps skill. Grok Bot does this via search + a residential browser, not a special API | Playbook for Google Maps in the headed browser, after PAC/geo | free; 1–2 days (with #5 in Medium) | P2 |
| 27 | Flights and hotels search | **N** | no playbooks; AGENTS.md only uses "flights and hotels" as a writing-structure example; Booking.com cookies exist from a past test | Site playbooks for Google Flights / Booking / Airbnb in the browser | free; 1–2 days | P2 — general web, not core video |
| 28 | Weather | **P** | no dedicated API; both Grok Bot and AgentLab can do this through web search | None required; quality follows #22 | n/a | already good enough once search is |
| 29 | Own email: receive, sign-up codes | **Y** | AgentMail inbox; `mail-inbox list/read/wait --code` | n/a | n/a | already has |
| 30 | Own email: send to anyone | **P** | `mail-send --to` only to the inbox and anthony@transovo.ai; `--reply` can answer a thread in the inbox; sends are logged | Draft-and-approve for other recipients; keep the allow-list for unattended mail | free; 1–2 days | P1 if the agent must write to a vendor or a form that is not a reply |
| 31 | Read John's Gmail / Outlook | **N** (and out of scope) | would need OAuth app review | Out of scope. Use the AgentMail inbox, or John forwards | n/a | excluded |
| 32 | SMS and phone-number verification | **N** | see #11 | see #11 | see #11 | P2 |
| 33 | Phone calls | **N** | no Twilio voice, Vapi or Retell | Twilio + a voice model, or Vapi/Retell | ~$0.07–0.15/min; 3–5 days | P2, low for core jobs |
| 34 | Join meetings and transcripts | **N** | no Recall.ai / Meeting BaaS / Meet or Zoom bot | Recall.ai or Meeting BaaS | ~$0.50–0.70/hr; 2–3 days | P2 — client reviews |
| 35 | Slack / Teams / iMessage / Telegram / Discord | **N** (ntfy only) | one-way ntfy push to John's phone (`push_worker`); no Slack, Teams, Telegram or Discord. Grok Bot actually uses Slack, Teams and iMessage; Telegram and Discord are not first-party in this bot, but a bot token would add them | Telegram first (quick win); Slack or Discord with a bot token (medium). Teams/iMessage need more platform work and are lower value here | free; 0.5–2 days | P1 — so John can talk to the lab from his phone |
| 36 | Scheduled routines (cron, one-off) | **Y** | `routine add --cron`, `remind --at`; 6 rows in `runs.db`, 1 active daily cron | n/a | n/a | already has |
| 37 | Webhook-triggered routines | **Y** | `routine add --webhook`; 1 webhook run already recorded | n/a | n/a | already has |
| 38 | Email-triggered routines | **N** | no AgentMail → routine hook | AgentMail inbound webhook to the existing routine URL | free; 0.5 day | P1 — "when this email arrives, do X" |
| 39 | GitHub-triggered routines | **N** | no GitHub token, so no webhook from a repo either | After the `gh` token: a repo webhook to the same routine URL | free; hours, after quick win #8 | P2 |
| 40 | Durable memory and recall | **Y** | `memory.db`, `remember` / `recall` / `forget` / `project-note`; injected by `agent-context` | n/a | n/a | already has |
| 41 | Skills library | **P** | mechanism is complete (`agent_skill`, `save-skill`); only 3 skills (working method, run-failure report, motion-studio-production). Grok Bot has many site playbooks | Write footage, search, and sign-in skills; John can also `save-skill` as they go | free; 1 day for the first set | P1 |
| 42 | Learn from demonstration | **N** | no skill or tool for turning a screen recording into a skill | Port the Grok Bot skill: record on the live desktop, transcribe the steps, write SKILL.md | free; 2–3 days | P2, high leverage once it exists |
| 43 | Parallel subagents | **Y** | `helper`, `helper --vision`, `bgjob`; default `max_concurrent` is 2 (config table empty) | Leave the cap; John is getting a bigger VPS later | n/a | already has (throughput will grow with the VPS) |
| 44 | Cloud coding agents and GitHub PRs | **P** | helpers can code in git worktrees; `gh` has no credentials; `claude-agent-acp`, `codex-acp`, `tiny-agents` are installed and unused | PAT in the vault + `gh auth` (quick win). Cloud agents optional later | free token; 0.5 day, or 2–3 days for a cloud agent | P1 for shipping code; P2 for cloud agents |
| 45 | Supabase / database access | **N** | no supabase, psycopg, or `psql` client; no SUPABASE keys in env names | Official MCP or `psql` with a service-role key (API key, not OAuth) | free software; 1 day | P1 if John wants the lab on Transovo's DB |
| 46 | Payments with a card vault | **N** | no card tooling; hard rule 3 says no spend-approval steps | Only if John wants the agent to buy things: a virtual card and a per-purchase "Pay" step. Otherwise leave payments to John | 3+ days | P2 |
| 47 | Dashboards and shareable pages | **Y** | `publish`; front-end routes `app/agent-lab/pages` and `api/agent-lab/pages`; URL in AGENTS.md | n/a (richer canvases are optional, Bigger #6) | n/a | already has |
| 48 | Usage per model | **P** | `usage` / `usage --conversation` totals LLM + media; `usage.jsonl` has a `model` field on media rows; `summary.json` has no per-model rollup | Add a per-model table to `usage` | free; 0.5 day | P1 — John asked for this in the model-routing plan |
| 49 | Task tracking | **Y** | `agent_task_start`, `agent_verify`, `log/task.json`, stop hook | n/a | n/a | already has |
| 50 | Auto-review for risky actions (for John, not multi-user) | **P** | Landlock sandbox, `agent-guard` (blocks rm/mv outside the job folder), `redactlib`; no confirm-before-send or confirm-before-expensive-call. Hard rule 3 refuses spend caps | Prompt John before off-list email, large paid calls, and `git push` | free; 1–2 days | P1, narrowly |
| 51 | Voice memos (John records, agent listens) | **N** | no recorder on the Agent Lab page; audio files can already be transcribed if John uploads them | A record control on the page → Deepgram | Deepgram ~$0.0043/min; 2–3 days | P2 |
| 52 | TTS (agent speaks) | **Y** | `tts` (ElevenLabs flash, ~$0.04 / 1,000 chars); `edge-tts` installed as free fallback, already mentioned in the motion-studio skill | Optionally mention `edge-tts` in AGENTS.md | already paid / free fallback | already has |
| 53 | Translation | **P** | no dedicated translate CLI; the LLM, Gemini `look` / `watch-media`, and Deepgram can handle many languages | Usually enough. Optional: a thin `translate` wrapper around Gemini | free-to-metered; hours if wanted | P2 |
| 54 | File conversion (ffmpeg and others) | **Y** | ffmpeg 7.1.5, sox, ImageMagick, pandoc, soffice, poppler, zip/7z | n/a (rclone is missing if John later wants cloud-copy via keys) | n/a | already has |
| 55 | Download from Instagram, TikTok, X and similar | **N** | `ytdl` is YouTube-specific (11-character id, YouTube bot-check retry). `gallery-dl`, `instaloader`, `twscrape` are not installed. Generic `yt-dlp` can try other sites but has no cookies, no skill, and no wrapper through the gateway | `gallery-dl` + cookies from the persistent profile + egress; skills for each site | free software; 0.5–2 days after the proxy is up | P1 — footage gathering |
| 56 | Stock footage APIs | **N** | no Pexels, Pixabay, Unsplash, or Storyblocks keys or tools | Pexels + Pixabay first (free); Storyblocks/Artgrid only if John has a licence | free; 0.5–1 day | P1 — Motion Studio |
| 57 | Music | **Y** | ElevenLabs Music, `$0.15/min`, `$2` cap in `gen_music.py` | n/a | already metered | already has |
| 58 | SFX library | **N** | sox can edit sound; no Freesound (or similar) tool or key | Freesound API | free; 0.5 day | P1 — finishing a cut |
| 59 | Transcription (Whisper / Deepgram) | **Y** | Deepgram nova-3 (`transcribe`); faster-whisper 1.2.1 local (CPU, use small/base) | Prefer Deepgram when timing or speakers matter (already documented) | ~$0.0043/min | already has |

### Suggested order for John (single-user only)

1. Let the proxy / `ytdl` / PAC worker finish. Do not overlap with it.
2. Same day, the stale-handoff fix (quick win 1) — it is independent and already biting.
3. Then the footage cluster, which is most of the Transovo value: stock APIs, SFX, gallery-dl, and the skills (quick wins 2–5).
4. Then reach and plumbing: Telegram, email-triggered routines, GitHub token, per-model usage (quick wins 6–9).
5. Then search quality, captcha/TOTP, file uploads, and the vault + autofill (the last is the biggest remaining piece).
6. Leave meetings, phone, payments, voice memos, and richer canvases until he actually needs them.

---

## Earlier audit (Nov 24 afternoon; includes multi-user, Modal, and OAuth, now out of scope)

The original write-up follows for the record. Treat the single-user section above as the working list. Items in that earlier top 10 about isolating users, moving renders to Modal, spend caps for users, and Google OAuth are out of scope per John.

## Bottom line

AgentLab is much further along than "OpenHands plus a prompt". It already has: a persistent headed Chromium with a live screen and a sign-in handoff to John, a vision actor for GUI work, its own email inbox, cron/webhook/one-off routines, durable memory with hybrid recall, a skills library, parallel helpers, a per-job Landlock sandbox, per-conversation usage tracking, whole-video understanding (Gemini), TTS, Deepgram transcription, image and video generation, SearXNG search, an MCP registry, nightly offsite backups, and a full video toolchain (ffmpeg, Remotion, Motion Canvas, Revideo, manim and others).

What is missing falls into four buckets:
1. **The network and browser identity.** The server is a datacenter IP in Finland, and the browser claims New York. Plain pages, Amazon and YouTube all hit walls.
2. **Accounts.** Sign-in works only by handing the screen to John. There is no credential fill, no TOTP and no captcha solving. The browser has no YouTube or Google login.
3. **Multi-user.** Everything is built for one owner: one browser profile, one memory, one inbox, one token, two concurrent runs.
4. **Reach.** The owner can only talk to it from the Agent Lab web page. There are no chat channels, no email triggers, no OAuth connectors, no meetings or phone, and no X reads.

## Ranked top-10 fix list

| # | Fix | Prio | Cost | Effort |
|---|-----|------|------|--------|
| 1 | Residential egress for hard sites, wired as a gateway with allowlist, per-job byte meter and retry-on-new-IP (the COS-7 plan, already approved in spirit; waiting on John's go) | P0 | ~$1/GB; ~0.4 MB per transcript, ~4 MB per 3½-min 240p video, so about $0.0004–0.004 per video | 1–2 days |
| 2 | Make the browser look like one person: proxy for the browser too, timezone/locale/geolocation matched to the exit IP, real GPU-less WebGL fix, sticky session, block images | P0 | ~$1/GB (images blocked cut it 57–72%); software free | 2–3 days |
| 3 | Isolate users: one browser profile, memory, inbox, vault and usage meter per user, with per-user quotas. Today there is one owner ("Rick"), one profile and one token | P0 before the first outside user | per user ~$5–15/mo compute if one container each (Hetzner / Modal / Daytona); Browserbase-style hosted browsers ~$0.10/hr (~) | 2–4 weeks |
| 4 | Move heavy rendering off the 4-vCPU box. One run pins a core at 99% now, only 2 runs execute at once, and there is no GPU | P0 for user jobs | Modal/RunPod per-second billing; existing `motion-render-worker` work can be reused | 3–5 days to route renders, then ongoing |
| 5 | Credential vault that fills sign-ins without the model seeing the password, plus TOTP codes | P1 | Bitwarden/Vaultwarden free; 1Password service accounts ~$8/user/mo (~) | 3–4 days |
| 6 | Captcha path for unattended runs: residential IP first, then a solver (CapSolver / 2Captcha), handoff to John as the last resort | P1 | ~$1–3 per 1,000 solves (~) | 1–2 days |
| 7 | Footage-gathering playbooks as skills (YouTube tiers, Instagram, TikTok, X, Vimeo, Drive/Dropbox links, stock APIs like Pexels and Pixabay, licence check) | P1 | skill writing only; Pexels/Pixabay free; Storyblocks/Artgrid are paid contracts | 1–2 days |
| 8 | Reliability fixes on the shared desktop: clear the stale sign-in handoff, make handoffs expire, make the "don't fight John for the browser" hook actually fire, handle the ~4% browser disconnects | P1 | free | 0.5 day |
| 9 | Spend caps and approval cards for anything that costs money or leaves the box. Hard rule 3 today says "no spending caps, no approval steps", fine for John but unsafe for users | P1 before users | free (policy + code) | 2–3 days |
| 10 | Reach: email-triggered routines (AgentMail webhook to routine webhook), a Slack or Telegram channel for John, and OAuth connectors (GitHub, Google Drive) so agents can push code and ingest user files | P1/P2 | AgentMail webhooks free on current plan (~); Slack/Telegram bots free | 2–4 days |

Not in the top 10, deliberately: payments, meetings and phone calls, X reads, 1Password. They are P2 for Transovo's core jobs. See the table.

## Surprises

- **The stale handoff.** `/status` on the desktop service shows a sign-in handoff "waiting" since Nov 23 7:18 PM ET (a httpbin form test, expired 7:48 PM). Expiry is never enforced, so `rick_busy` has been true for about 24 hours. By the code, that returns 409 to every agent desktop click/type and should make the `browser_*` hook wait 9 minutes then deny. I found browser tool calls succeeding after that time (437 OK, 21 errors across 458 browser observations, newest Nov 24 12:30 PM ET), so the hook is probably not matching `browser_*` calls. Net effect: the protection that stops the agent fighting John for the screen is likely not working, and desktop-input calls are blocked. Fix is one POST to `/handoff/done` plus an expiry check.
- **The browser contradicts itself.** Chromium reports time zone America/New_York, while the IP is Hetzner Helsinki (AS24940). WebGL reports "SwiftShader" (software rendering), which anti-bot systems read as a headless VM. It is headed and `navigator.webdriver` is false, which is good.
- **No site logins.** The profile has 60 cookies, mostly Wikipedia, Google consent, Booking and test sites. None is a YouTube or Google sign-in. So even with handoff working, nothing is logged in where Transovo needs it.
- **Email works, but it is one-way by design.** The inbox `anthony-9640@agentmail.to` works. Sends are restricted to two addresses (the inbox and anthony@transovo.ai). That is safe, but the agent cannot sign up for a service and write back to a stranger, and has no access to John's Gmail or Outlook.
- **Backups are fine.** Nightly offsite copy to Backblaze B2 is working, with 14 retained.
- **Network is locked down.** UFW allows only SSH plus ports 8000/8010/6080 from the Transovo host (128.140.102.51). Good. The live-screen link the tool prints is correctly marked as closed to the internet.
- **MCP is API-key only.** It can search the registry and install keyed servers (context7 "docs" is the only one used), but there is no OAuth flow, so no Drive, GitHub or Supabase.
- **`gh` has no credentials,** so a helper can make a worktree and commits but cannot push or open a PR.
- **Only 3 skills** (two process skills plus `motion-studio-production`) versus dozens of site playbooks on Grok Bot. That matters most for footage gathering.

## Probes run (all read-only)

| Question | Result | Evidence |
|---|---|---|
| Can its browser sign in to sites? | Only by handoff to John. It cannot type secrets itself, and AGENTS.md forbids asking for them in chat. | `desktop-service.py` handoff API; AGENTS.md "Sign-ins... hand off to Rick"; `/status` shows a handoff record |
| Does the browser pass basic checks? | `webdriver=false`, UA Chrome/156 on Linux, 5 plugins, `window.chrome` present. Fails coherence: tz New York vs Helsinki IP; WebGL = SwiftShader. | CDP `Runtime.evaluate` on the Wikipedia tab |
| Can it solve captchas? | No solver. No `2captcha`, `capsolver`, `anticaptcha`, `undetected`, `camoufox`, `patchright` anywhere in tools, runner, ops, skills or pip. The vision actor could read a simple image captcha but not reCAPTCHA or Turnstile. | grep of /opt/agent plus `pip list` |
| Does it have an email address? | Yes: `anthony-9640@agentmail.to` (AgentMail). Reads and waits for codes. Sends only to the two allowed addresses. | `mail-address`, `mail-inbox list`, `secrets/agentmail.env` variable names |
| Can it see video frames? | Yes. `agent_view` / `look` for frames; `watch-media` sends the whole video and audio to Gemini. | tools/look, tools/watch-media, AGENTS.md |
| Does it have a scheduler? | Yes. 6 routines on file (1 active cron "Daily agent run failures" at 8:00 AM ET). Cron, one-off `remind`, and secret-URL webhooks. No email, GitHub or event triggers. | `runs.db`, `tools/runcli.py`, `agentd.py` |
| Concurrency | Default 2 concurrent runs (`max_concurrent`, config table empty). | `agentd.py` line ~961 |
| Egress identity | 204.168.139.158, Hetzner Helsinki. | `ipinfo.io` from inside the container |
| Tooling versions | yt-dlp 2026.10.26 (current in the container), ffmpeg 7.1.5, deno 2.9.8, faster-whisper 1.2.1 (CPU only), opencv 5.1. | `docker exec agent-lab` |
| Activity so far | 166 runs since Nov 23: 145 user, 3 routine, 4 helper, 1 reminder, 1 webhook; 13 failed or stopped. | `runs.db` |

Note: the earlier COS-7 yt-dlp finding (a month out of date) does not match what I saw inside the container (2026.10.26). The host and container copies may differ; check that the tool the agents actually call is the new one.

## Full table

Legend: Y = yes, P = partial, N = no. Prio: P0 blocks core jobs, P1 needed soon, P2 later.

| # | Grok Bot capability | AgentLab? | Evidence | Why it matters for Transovo | Fix (open source / service) | Cost / effort | Prio |
|---|---|---|---|---|---|---|---|
| 1 | Persistent **residential-IP** browser | **N** (browser P) | Chromium persists (`chrome-keeper`, profile `/workspace/desktop/chrome-profile`) but egress is Hetzner; no proxy flags in its command line | YouTube, Amazon and any reputation-gated site block the server; research and footage gathering fail | DataImpulse residential $1/GB (mobile $2); Decodo $4/GB as backup. Gateway, allowlist, sticky region-pinned IP, byte meter. See COS-7 | ~$1/GB; 1–2 days | P0 |
| 2 | Browser identity coherence (headed, tz/geo match, real fingerprint) | **P** | Headed on Xvfb, `webdriver=false`; but tz New York vs Finland IP; WebGL SwiftShader; UA Linux | Even with a residential IP the page can still flag it. Amazon stayed blocked through the proxy with plain fetches in the COS-7 test | Set tz/locale/geolocation from the exit IP's geo; try patchright or camoufox (free); fallback hosted stealth browsers (Browserbase, Steel, Bright Data Scraping Browser) | software free; 2–3 days | P0 |
| 3 | **Headed desktop** + live screen | **Y** | `agent-lab-desktop.service` (Xvfb, x11vnc, noVNC), `desktop-shot/open/click/type/key/drag/scroll/zoom`, Live screen page | Lets John watch and take over | n/a | n/a | n/a |
| 4 | **Computer-use** for GUI apps | **Y** | `tools/vision-act` with deepseek-flash / gemini-flash, `helper --vision` | Editing tools, web UIs with no API | Keep. Add an eval set for reliability | 1 day to test | P2 |
| 5 | **Sign-in handling**: password vault fill | **N** | No fill mechanism in browser tools; OpenHands secrets reach MCP servers as env vars only | Footage on private or logged-in sites (Instagram, Patreon, Frame.io, Drive); user accounts | Bitwarden CLI or Vaultwarden; a `fill-login` tool that reads the vault and types into the page without returning the value; `pyotp` for TOTP | free; 3–4 days | P1 |
| 6 | Sign-in: **2FA / one-time codes** | **P** | Email codes: `mail-inbox wait --code`. No TOTP, no SMS codes | Sign-ups and logins that use email codes work. Authenticator and SMS codes do not | `pyotp` with seeds in the vault; a phone-number service (Twilio, or a rented SMS-receive number) for SMS codes | ~$1–2/mo per number (~); 1–2 days | P2 |
| 7 | Sign-in: **hand the screen to the user** | **Y** | `/handoff`, "I'm done" button, Live screen on transovo.ai/app/agent-lab | The fallback for captcha, passkey, hard 2FA | Fix stale handoff and make it expire; also push a phone alert (ntfy exists) | 0.5 day | P1 |
| 8 | **Captcha** solving | **N** | No solver anywhere (grep). Handoff is the only path | Unattended and scheduled runs stall at a captcha | Residential IP lowers frequency; CapSolver / 2Captcha for reCAPTCHA, hCaptcha, Turnstile; handoff last | ~$1–3 per 1,000 (~); 1–2 days | P1 |
| 9 | **Credential vault** and 1Password | **P** | Front-end `api/agent-lab/vault`; OpenHands encrypted secrets store; `agent_mcp_connect secrets=[...]` | Holds API keys. Does not hold site logins | Same as row 5. 1Password only if John already uses it | see row 5 | P1 |
| 10 | **Payments** with the user's card via approval cards | **N** | No card tooling; hard rule 3 says no spend caps | Not needed for Transovo's core jobs. Needed only if agents buy stock footage or tools | Keep payments human-only. If needed later: a virtual card with a limit, per-purchase approval card | n/a now | P2 |
| 11 | Own **email inbox**, read and send | **P** | AgentMail `anthony-9640@agentmail.to`; `mail-inbox`, `mail-send`; sends allowed only to the inbox and anthony@transovo.ai (`MAIL_ALLOW_TO`) | Sign-ups, receipts, code capture work. Cannot write to customers or vendors | Keep the allow-list; add per-user inboxes (AgentMail supports many); add an approve-then-send step for other recipients | free tier (~); 1–2 days | P1 |
| 12 | Send/read **John's Gmail / Outlook** | **N** | No Google/Microsoft connector; MCP has no OAuth | Pulling a client's footage link from John's email; replying as him | Google/Microsoft MCP with OAuth (needs OAuth support, row 24) | 2–3 days | P2 |
| 13 | **Outbound messages drafted for approval** | **N** | No draft-then-approve flow; `mail-send` is allow-list only | Needed before agents talk to users or customers | Approval card in the Agent Lab page; the agent posts a draft, John taps send | 2 days | P1 (with row 20) |
| 14 | **Slack / Teams / SMS** channels | **N** | Only the Agent Lab web page plus one-way ntfy push (`push_worker`) | John can't message the agent from his phone; users can't reach it | Telegram or Slack bot to the runner's API (free); Transovo's SMS worker must not be touched; use a separate Twilio number if SMS is wanted | free–$1/mo; 1–2 days | P1 |
| 15 | **Scheduled and event-triggered routines** | **P** | Cron, `remind`, and secret-URL webhooks (`routine add --cron --webhook`); 6 on file | Daily research, monitors, jobs on a schedule work. No email or GitHub triggers | AgentMail webhook to routine webhook for email triggers; GitHub webhook to the same URL | free; 0.5–1 day | P1 |
| 16 | **Durable memory** | **Y** | `memory.db`, `remember/recall/forget/project-note`, hybrid recall injected by `agent-context` hook | Rick's rules persist | Keep. Needs per-user scoping (row 26) | n/a | n/a |
| 17 | **Skills library** | **P** | Only 3 skills in `/opt/agent/workspace/skills` (working method, run-failure report, motion-studio-production); `save-skill` exists | Grok Bot has dozens of site playbooks. Missing ones: YouTube, Amazon, Instagram, TikTok, X, stock sites | Port playbooks as skills; start with footage gathering | 1–2 days | P1 |
| 18 | **Parallel subagents** | **Y** | `helper` (own job folder, git worktree), `helper --vision`, `bgjob`; but `max_concurrent=2` | Parallel research and renders. Throttled by concurrency 2 and 4 vCPUs | Raise the cap only after row 4 | with row 4 | P0 (via row 4) |
| 19 | **Cloud coding agents** | **P** | Helpers can code in worktrees; `gh` installed with no credentials | Agents can't push fixes or open PRs | GitHub App or fine-grained token in the vault, scoped to one repo; Cursor SDK cloud agents if wanted | 1 day | P2 |
| 20 | **Approval gates** and **auto-review safety** | **P** | `agent-guard` blocks rm/mv outside the job folder; kernel Landlock sandbox (`job-sandbox`); `redactlib` scrubs logs and push text; hard rules 2, 5, 6. No approval cards, no spend caps by design | Fine for one trusted owner; not safe for outside users | Spend caps per user and per job, approval card for paid calls above a threshold and any outbound send | 2–3 days | P1 |
| 21 | **MCP connectors with OAuth** | **P** | `agent_mcp_find/connect/list/remove`; installs log shows context7 only; no OAuth code in `agentd.py` | GitHub, Drive, Supabase, Slack | Add an OAuth broker (MCP OAuth or Composio/Nango) | 2–4 days; Nango self-host free | P1/P2 |
| 22 | **Web search and fetch** | **Y** | SearXNG container; `search`, `search --videos`, `readpage`; Gemini search fallback | Research | Keep. Blocked pages go through row 1 | n/a | n/a |
| 23 | **X / Twitter reads** | **N** | None; X needs login or API | Trend and reference research | X API (paid tier ~$200/mo, ~), or a logged-in browser via row 5, or skip | high; skip for now | P2 |
| 24 | **Video understanding** | **Y** | `watch-media` (whole video + audio to Gemini), `look --frames`, `agent_view`, `scenedetect`, `faster-whisper`, Deepgram `transcribe` | Core clipping work | Keep. CPU-only whisper is slow; use Deepgram ~$0.0043/min | n/a | n/a |
| 25 | **Image and video generation**; file conversion; PDFs | **Y** | `image-gen/edit` (Gemini), `gen-image/gen-video` (KIE), `tts` (ElevenLabs), LibreOffice, pandoc, poppler, pypdf | Motion Studio assets | Keep | n/a | n/a |
| 26 | **Multi-user isolation** | **N** | One browser profile, one memory DB, one inbox, one `AGENT_LAB_TOKEN`; AGENTS.md is written for "Rick"; the runner has `bot_id` but no user scoping | Blocks letting any customer use it; also leaks logins across users | Container (or sandbox) per user; per-user profile, vault, memory, inbox; quotas | ~$5–15/user/mo; 2–4 weeks | P0 at first outside user |
| 27 | **Compute capacity** | **P** | 4 vCPU, 7.6 GB, no GPU; load ~2; one process at 99% CPU during the audit; concurrency 2 | Renders (Remotion, ffmpeg, skia) and local whisper compete; user jobs queue | Burst renders to Modal / RunPod; Hetzner larger box or dedicated GPU box only if needed | pay per second; 3–5 days | P0 |
| 28 | **Pages and dashboards** | **P** | `workspace/pages`, front-end `api/agent-lab/pages` and `pages/` route (not audited in depth) | Showing results to users | Keep; test with a real report | 0.5 day | P2 |
| 29 | **Meetings** (Meet/Zoom, transcripts) | **N** | None | Client calls, feedback sessions | Recall.ai or Meeting BaaS API (~$0.5–0.7/hr, ~) | 2–3 days | P2 |
| 30 | **Phone calls** | **N** | None | Support calls | Twilio plus a voice model, or Vapi/Retell (~$0.07–0.15/min, ~) | 3–5 days | P2 |
| 31 | **Per-task tracking** | **Y** | `agent_task_start`, `agent_verify`, `log/task.json`, `agent-complete` stop hook, milestones, checkpoints | Quality gate on every job | Keep | n/a | n/a |
| 32 | **Usage and spend visibility** | **P** | `usage`, `usage --conversation`, `collect-usage` cron every 15 min, `usage.jsonl`, front-end `models` route | Works for John. No per-user spend, no per-model split in the UI, no alerts at thresholds | Add per-user and per-model rollups, daily alert at 80% of the budget (also wanted for the proxy meter) | 1–2 days | P1 |
| 33 | **Background reliability** | **P** | Failure report routine, `agent-complete`, LLM fallback profiles (Gemini, OpenAI, Opus), nightly backup to B2. Browser tool errors 21 of 458 (4.6%, mostly "no close frame") | Long jobs fail quietly | Auto-restart the browser on repeated CDP errors (there is an `ops/browser-heal`); fix row 7 stale handoff | 0.5 day | P1 |
| 34 | **File intake from users** (Drive/Dropbox/WeTransfer links, uploads) | **P** | Front-end `files` and `upload`; yt-dlp and curl for public links; no Drive OAuth | User footage arrives as links | yt-dlp / `rclone` for public links; Drive via row 21 | 1–2 days | P1 |
| 35 | **Footage sourcing** (stock APIs, licence checks) | **N** | No Pexels/Pixabay/Storyblocks keys in `.env`; no licence skill | The Transovo core: finding footage with rights | Pexels and Pixabay APIs (free); see `t2v-stock-video-market.md`; add licence field to every clip record | free; 1–2 days | P1 |

## Suggested order

1. **This week:** rows 1 and 2 (proxy + coherent browser), row 7/33 hygiene (a half day), row 17 footage skills. These unblock John's own research and footage jobs.
2. **Before the first outside user:** rows 26, 27, 20, 32, 13. Do not invite anyone until these are in.
3. **Soon after:** rows 5, 8, 14, 15, 21, 34.
4. **Later or skip:** rows 10, 12, 23, 29, 30.

## Method and limits

- Read AGENTS.md (the agents' operating prompt), `runner/agentd.py`, `tools/*`, `ops/desktop/desktop-service.py`, `oh-home/hooks.json`, the container's tool versions, the runs database (read-only), the conversation event files, and the front-end route list on GitHub (`new-app/app/api/agent-lab/*`).
- Not audited: the front-end component code (`agent-lab-chat`), the prompt behaviour of each model profile, and the OpenHands server's own auth. I did not run a live captcha or sign-in attempt, so "no solver" is from a code search, not a failed attempt.
- Secrets: only variable names were read. No values were printed.
