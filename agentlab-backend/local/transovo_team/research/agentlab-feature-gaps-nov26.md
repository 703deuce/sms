# AgentLab: missing USER-FACING features (draft, wrapped up early)

Written Thu Nov 26, 2026, about 5:30 AM ET. Read-only. No test jobs, no spend, no secrets printed.
**Status: PARTIAL.** The parent stopped this early so a fresh agent can finish. Each item is marked
**VERIFIED** (I read server code/config/skills this session) or **NOT CHECKED** (inference or a comparison only).
Hours only. Prices are from memory unless stated, so confirm before buying.

Left out on purpose: proxy/retry/plumbing (see `agentlab-gap-audit-nov26.md`), Haiku routing, Sonnet assist, router intent, Cursor-style coding, phone agent, planned CRM/booking.
Already listed elsewhere and not repeated: push alerts, heartbeat, OCR, `readdoc`, search ladder, injection fencing. The COS-38 doc is `agentlab-builtin-tools.md`. Its roadmap items (kb, Postiz, DocuSeal, Home Assistant, Kokoro, ComfyUI, invoices, forms) are noted only where they overlap.

## What I read on the server (evidence base)
- `/workspace/skills` in the `agent-lab` container: 45 skills. Read in full: connectors, email, routines, publish, orders-subscriptions, shopping-research, browser-extras.
- `connector --help`, `phone --help`, `routine`, `publish`, `preview`, `helper`, `job`, `history-search`, `project-note`, `sonnet-assist` help output.
- `/opt/agent/ops/telegram-bridge.py` header; `runner/state/push.json` (only the `enabled` flag was read: false); crontab.
- A keyword grep over the first-party files in `/opt/agent/tools`, `runner`, `ops` and `phone`, excluding node_modules and vendored packages.
- Hermes repo at `/workspace/gap26/hermes-agent`: listed `tools/`, `plugins/`, `gateway/`, `skills/` and `optional-skills/` only. I did not read the code. File refs below are directory/file names that exist.
- Not done: the front-end (the `agent-lab-chat` UI is on GitHub, not on the box). I also did not check the Claude, ChatGPT or Muse docs again this session; those comparisons are from existing knowledge and the earlier audits.

## Ranked list (by how often real users ask for it)

### MUST

**1. Buy things with approval: checkout, reorder, pay a bill. (Grok Bot, ChatGPT agent shopping checkout, Claude computer use, Muse).** VERIFIED missing.
- Users: "order this", "reorder my usual", "pay this invoice".
- AgentLab: `lab-shopping-research` says "Never add items to a cart… or place an order". `lab-orders-subscriptions` says no logins and no purchases. No card, Stripe or checkout tool in first-party files. `fill-login` exists, so signed-in stores are reachable.
- Build: a `pay` flow in four steps.
  1. The agent fills the cart in the browser.
  2. It sends a read-back (items, total, address) through `ask-user` or the push channel.
  3. John taps approve.
  4. A card-fill helper types the card from the vault service (`vaultd`) without the model seeing it. Extend `fill-login`/`fill-worker`.
  5. Set a per-purchase and per-day limit.
  6. Log a receipt.
- Safer option: a virtual card (Privacy.com or Stripe Issuing) with a spend limit.
- Hermes: `optional-skills/payments/stripe-link-cli`, `optional-skills/productivity/shop`, `tools/browser_vault_tool.py`.
- Hours: 10-14. **Needs John's yes on spend:** the card source, and virtual-card fees if used.

**2. Book things: restaurants, flights, hotels, appointments. (Grok Bot, ChatGPT agent, Claude).** VERIFIED missing.
- AgentLab: `lab-travel-planning`, `lab-local-recommendations` and `lab-site-lookups` all say "no booking". No OpenTable or Resy code.
- Build: a booking skill per site, driven by the headed browser and `fill-login`, ending in the same approval step as #1. Resy and OpenTable have public availability endpoints (Grok Bot's playbooks use them). Add Google Calendar/Outlook event creation (Outlook already works through `connector`).
- Hours: 8-12 for restaurants and appointments, plus 6-8 for flights/hotels. Free, except the booking itself (see #1).

**3. Order, return and subscription actions (track, return, cancel, refund, price-adjust). (Grok Bot, ChatGPT agent).** VERIFIED missing.
- AgentLab: `lab-orders-subscriptions` is public pages only. It "can't complete those without a login", but `fill-login` and the vault exist.
- Build: a skill that signs in with `fill-login`, finds the order, starts the return or cancellation, and stops at an approval step. It saves proof (screenshot and confirmation email through `mail-inbox`). Add a "what did I buy from X" read from the order history page or receipt email.
- Hours: 6-8 (rides on #1's approval step). Free.

**4. Reach the agent from where people are: Telegram live, then WhatsApp/SMS/Slack/Discord/iMessage. (Hermes has about 25 platforms. ChatGPT and Claude have mobile apps.)** VERIFIED.
- AgentLab: a Telegram bridge exists but is idle (no token, installed disabled). A grep found no Slack, WhatsApp, Discord or iMessage code. Chat is otherwise only the web page.
- Build: finish Telegram (token only, about 1 h). Add SMS-to-agent on the existing Telnyx/Twilio line. Add WhatsApp via a cloud API or Slack via a bot token as a second step.
- Hermes: `plugins/platforms/{telegram,slack,discord,whatsapp,whatsapp_cloud,signal,sms,email,teams,...}`, `gateway/platforms/`, `tools/react_to_message_tool.py`.
- Hours: 1-2 (Telegram), then 3-5 per extra channel. Free, except SMS per-message fees.

**5. Watch and alert: price drops, back-in-stock, page changes, news/RSS. (ChatGPT Tasks/Pulse, Grok Bot routines, Hermes.)** VERIFIED partly built.
- AgentLab: zero-token `routine --script` watch routines exist, so the engine is there. There is no price/stock watcher skill, no watch list, and no RSS/feed reader. A grep for price-watch, restock, feedparser and rss found nothing. `phone watch` only diffs the owner's own site.
- Build: a `watch` tool. Each entry has a URL or product, a selector or an LLM-read value, a threshold and a schedule. It sits on top of `routine --script`, keeps one `watches.json`, and notifies only on change. Add `feedparser` and a "list my watches" view.
- Hermes: `skills/productivity/product-price-monitor`, `skills/research/competitor-news-monitor`, `optional-skills/research/{blogwatcher,rss-feeds}`, `optional-skills/devops/watchers`.
- Hours: 4-6. Free (cheap fetches, with proxy bytes only on blocked sites).

**6. Google account tools: Gmail, Calendar, Drive, Docs, Sheets. (ChatGPT connectors, Claude connectors, Grok Bot, Hermes `google-workspace`.)** VERIFIED missing.
- AgentLab: `connector` supports only Microsoft, Calendly, Salesforce and Zoho. There is no Google code and no IMAP client (no himalaya or imaplib).
- Decision for John: Google OAuth needs app verification for mail and Drive scopes. A personal Google Cloud project in "testing" mode with John as the test user avoids review for a single user. An app password with IMAP, or a service-account Sheet, are no-review routes.
- Build: add `google` to the connector broker, or install `himalaya` (IMAP/SMTP CLI) for mail only.
- Hermes: `skills/productivity/google-workspace`, `skills/email/{himalaya,email-inbox-triage}`.
- Hours: 6-10 for Calendar, Gmail and Sheets. Free.

### SHOULD

**7. Proactive daily briefing and "what needs me" digest (ChatGPT Pulse, Claude Cowork scheduled tasks, Grok Bot).** VERIFIED partly.
- AgentLab: routines can run on a schedule. There is no default briefing, and no preference-driven one. `phone briefing` covers phone calls only. I did not list which routines are active (the last audit said one daily job).
- Build: a `briefing` skill that reads calendar (Outlook), mail (Outlook through `connector`), phone calls, open watches and job failures. It posts one page or message at a set time. Opt-in.
- Hermes: `skills/productivity/weekly-review-planning`.
- Hours: 3-4. Free (a small amount of Haiku per day).

**8. Meetings: join Meet/Zoom/Teams, take notes, answer in chat. (Grok Bot meetings, Hermes `google_meet`/`teams_pipeline`, Claude/ChatGPT via connectors.)** VERIFIED missing.
- AgentLab: no meeting-bot code (grep for recall.ai, meetingbaas and zoom found only browser helpers). A personal Microsoft account cannot use Teams meetings (documented in `lab-connectors`).
- Build:
  - A paid meeting-bot API (Recall.ai or Meeting BaaS, about $0.50-0.70/hour, unverified), or
  - Hermes' open-source `plugins/google_meet/meet_bot.py` with `audio_bridge.py` (headless Chromium joins and records), then Deepgram, which is already billed.
  - Output a summary, action items and decisions through the existing `transcribe`.
- Hermes also has `skills/productivity/{meeting-action-items,teams-meeting-pipeline}`.
- Hours: 8-12 for the free route. Free route spend is Deepgram minutes only. **Needs John's yes** if using Recall.ai.

**9. Phone calls on the owner's behalf: "call the restaurant", "call the vendor about my order". (Grok Bot phone calls, ChatGPT/Claude via agent mode.)** VERIFIED missing as a user feature.
- AgentLab: the outbound trunk and `create_sip_participant` exist (`phone/worker/main.py` transfers, `testcall.py`, `aicaller.py`). The `phone` CLI has no command to place a call for the owner. The phone line is inbound only.
- Build: `phone dial <number> --goal "…" --rules "…"`. It starts a worker room with a goal prompt, a hard time limit and a "may I confirm/pay" rule list, then posts the transcript and result. Needs an approval before each call (John's rule: calls need approval). It overlaps the phone workstream, so check with whoever owns it.
- Hermes: `optional-skills/productivity/telephony`.
- Hours: 6-8. Spend is per-minute call cost on the existing LiveKit/GPT Live setup. **Each call needs approval.**

**10. Maps, places, weather, stock quotes and other "everyday lookups" as real data tools. (Grok Bot, ChatGPT, Hermes `maps`.)** VERIFIED no tools. A grep for weather, geocode, nominatim, overpass, yfinance and stooq found nothing first-party.
- Today the agent reads web pages for these, which is slow and unreliable.
- Build: one `lookup` CLI over free APIs:
  - Open-Meteo for weather.
  - Nominatim and OSRM or Overpass for geocoding, distance and drive time.
  - yfinance or Stooq for quotes.
  - Optional sports and time-zone endpoints.
- Hermes: `skills/productivity/maps`, `optional-skills/finance/stocks`.
- Hours: 3-5. Free.

**11. Interactive apps and pages, not only static reports (Claude artifacts and Projects, ChatGPT canvas, Grok Bot Pages).** VERIFIED (static only).
- AgentLab: `publish` and `preview` write static HTML (Chart.js allowed) to `/workspace/pages/<slug>`. There is no backend, form handling or storage, so there are no trackers, calculators that save, or small apps.
- Build: allow a small JSON store per page (a `pages/<slug>/data` endpoint with a secret token), plus an edit-in-place loop. A free "deploy site" route (a Cloudflare Pages or temporary deploy) can serve a full app.
- Hermes: `optional-skills/web-development/{publish-site,cloudflare-temporary-deploy,page-agent}`, `optional-skills/productivity/live-dashboard`.
- Hours: 6-10. Free. The route that serves the pages is on the web host and not checked.

**12. Projects: a named workspace with its own instructions, files and chat history (Claude Projects, ChatGPT Projects).** VERIFIED partial.
- AgentLab has `project-note` (dated markdown notes per slug) and `recall`. There are no per-project files, standing instructions or chat grouping. The UI side is NOT CHECKED.
- Build: `project <slug>` with an `instructions.md` and an `inputs/` folder. The router attaches it to runs that match. Add `history-search --project`.
- Hours: 4-6 (backend), plus a UI part on the front-end repo.

**13. Fill and sign PDF forms (IRS, DMV, school, medical). (Common in Claude and ChatGPT use. Hermes `pdf`/`microsoft-office`.)** VERIFIED missing as a tool or skill.
- AgentLab: `pypdf` is installed. No skill or tool for AcroForm fields, flattening or positioned text on non-fillable PDFs. No e-sign.
- Build: a `fillpdf` CLI. It tries AcroForm fields with `pypdf`, then falls back to rendering the page, locating blanks with vision and stamping text with `reportlab`. The agent shows the filled preview before saving. DocuSeal for signing is already on the COS-38 roadmap.
- Hermes: `skills/productivity/pdf`.
- Hours: 4-6. Free.

**14. Voice in and out of the chat (voice memos in, spoken replies out, hands-free mode). (ChatGPT voice, Grok Bot voice memos, Hermes `voice_mode`/`voice_live`, Muse.)** NOT CHECKED (front-end).
- On the server AgentLab has the parts: ElevenLabs/edge-tts and Deepgram. I could not tell whether the chat page records or plays them.
- Build: record button, `transcribe`, and an optional "read it to me" button, on the chat page. Telegram voice notes come with #4.
- Hermes: `tools/voice_mode.py`, `tools/wake_word.py`, `tools/streaming_tts_consumer.py`, `gateway/run_voice.py`.
- Hours: 4-8, mostly front-end.

**15. Install and share skills from outside (skills hub), and improve them. (Hermes `skills_hub*`, Claude skills, Grok Bot skills.)** NOT CHECKED beyond a file list.
- AgentLab has `save-skill` and the skill gate. I found no browse, search or install-from-registry command. Hermes has install from GitHub, ClawHub and skills.sh sources with a security scan (`tools/skills_hub*.py`, `tools/skills_guard.py`).
- Build: `skill search | install <repo path>` with a content scan, off by default.
- Hours: 4-6. Free.

### NICE

**16. Learn a task from a screen recording (Grok Bot `learn-from-demonstration`).** VERIFIED unbuilt (already in the Nov 24 list, row 13). 2-3 days there, so 14-20 h. Needs a recorder on John's side.

**17. Work on John's own computer or browser (Claude Cowork and computer use, Grok Bot machines).** NOT CHECKED. AgentLab only drives its own server desktop. A local bridge (the Playwright MCP extension, or a small remote agent) would be needed. 10-16 h. Free.

**18. Document Q&A and podcast over John's files, NotebookLM style.** VERIFIED the phone has `phone kb`, and nothing general exists. COS-38 already lists `kb` and Open Notebook, so it is not new. Skip it here unless that roadmap stalls.

**19. Finance models (DCF, comps, 3-statement) and a study/flashcard mode.** VERIFIED there are no such skills (`sonnet-assist --mode math` only). Hermes: `optional-skills/finance/*`, `optional-skills/productivity/memento-flashcards`. 3-5 h per skill pack, free.

**20. Notes tools: Obsidian, Notion, Apple Notes/Reminders.** VERIFIED no code. Notion has a token API. Hermes: `skills/note-taking/obsidian`, `skills/apple/*`. 3-4 h each.

**21. Photo tools: background removal, upscale, object removal.** NOT CHECKED. `rembg` appears only in a prompt and the router, not as a tool I could confirm. COS-38 lists rembg and ComfyUI, so check first. 2-3 h for `rembg` on CPU.

## Not checked, and why (for the fresh agent)
- Front-end chat features: voice, projects UI, mid-run message queue, mobile/PWA, share links. The code is in the GitHub front-end repo.
- Hermes code reads for items 1, 5, 8, 9, 13. I only confirmed the file names exist.
- Current Claude Cowork, ChatGPT agent/Pulse and Muse behaviour. Take these from the `agentlab-gap-audit-nov26.md` Sources section or re-check.
- Whether any routines are active today, and what `mail-send` allows now (the lab-email text was truncated at "ONLY to Rick's own address").
- A Reddit/forum demand check to confirm the ranking. The ranking is my judgment from the earlier GoHighLevel/ServiceTitan research and general usage, not new evidence.

## Suggested order (about 55-75 h for items 1-13, no new spend except where marked)
1. Telegram live (#4 first step), watch tool (#5), lookup tool (#10), daily briefing (#7): about 12 h, all free.
2. Approval step plus checkout, booking, order actions (#1-#3): about 25-30 h. Needs John's yes on spend.
3. Google tools (#6), meetings (#8), outbound errand calls (#9), interactive pages (#11), PDF forms (#13).
