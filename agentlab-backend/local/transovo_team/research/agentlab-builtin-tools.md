# AgentLab built-in tools: open-source candidates, lean first set, build order

Research only. No server changes were made. Written 2026-11-25 (America/New_York).
Facts come from the GitHub API (license field, stars, last release/push) plus each project's own LICENSE file and docs, read on 2026-11-25. Items marked **(verify)** are from memory or a single secondary source and need a check before anyone builds on them. This is not legal advice. Anything we resell to other owners needs a lawyer's read of the license points below.

## 0. Ground rules that shape every pick

**What AgentLab is today** (from our other research docs): one 4-vCPU / 7.6 GB box, no GPU, already loaded, one owner. Chat is the only control surface. The `phone` CLI and `phone contact` SQLite store are the pattern to copy.

**The pattern: a "tool pack".** Each tool = a skill (tells the agent what to ask first) + a CLI + a SQLite store + an event log with undo + a `--dry-run` mode. The agent runs the CLI; the owner never sees a wizard. When an owner already uses an outside app, a connector adapter exposes the same CLI verbs against that app (e.g. `crm contact upsert` writes to our SQLite or to HubSpot). A full open-source app is added only when it clearly beats this.

**When a lightweight built-in (SQLite + CLI) beats a full app:**
- The owner would only ever talk to it through the agent (no staff logging in, no screens). Most of our owners.
- The data model is small (contacts, notes, tasks, a pipeline, invoices with line items).
- The app's license blocks us from running it for many owners (see matrix below).
- The app needs 2 GB+ RAM plus Postgres/Redis for what is 6 tables.
- We need deterministic code (slot math, consent rules, quiet hours) that the app would only partly enforce.
- We want one shared contact/event store so the phone agent, SMS, invoices and jobs all see the same customer.

**When a full app wins:** the owner needs a real UI with several staff (dispatch board, tech phones), the feature is deep and boring to rebuild (accounting, double-entry, payroll, e-signature legal trail), or the model is GPU-heavy (we can't build that anyway).

**Multi-tenant license matrix (the thing that decides "later").** If AgentLab ever serves many owners, we are operating software for third parties. Findings:

| License type | What it means for us | Examples found |
|---|---|---|
| MIT / Apache-2.0 / BSD | Free to run per-tenant or embed | Krayin (MIT), Cal.diy (MIT), Activepieces core (MIT), Umami (MIT), Kokoro (Apache) |
| AGPL-3.0 | Free to use. Obligations (publish source) trigger when you **modify** it and offer it over a network. Running it unmodified as a separate service behind its API is the usual safe lane. Get counsel before reselling | EspoCRM, listmonk, Postiz, Documenso, DocuSeal, Immich, SearXNG, Firecrawl, Plausible CE |
| Open-core (MIT/AGPL + commercial `ee/` folder) | Core is fine. Using the `ee/` features in production needs a paid key | Twenty, Activepieces, Formbricks, Chatwoot, Windmill, OpnForm, Baserow, PostHog, authentik |
| Source-available, hosted-service limits | **Can't run for outside owners** without a commercial deal | **n8n** (Sustainable Use: customers may not author workflows through our UI/API/MCP/agent), **Invoice Ninja** (Elastic 2.0: no hosted service giving access to a substantial set of features; reseller agreement needed), **Akaunting** (BSL: 2 users / 1 company / 1,000 invoices, no accounting service for third parties), **Outline** (BSL: no "Document Service"), **NocoDB** (Sustainable Use), **Dify** (modified Apache: no multi-tenant), **Fish-Speech** (community license: revenue cap; hosted service needs a license) |
| Closed | Not an option | **Cal.com** (closed source since April 2026; the open fork is **Cal.diy**, MIT, no teams/workflows) |

Using these for **John's own business or his own single instance** is fine for all of them. The limits bite only when we operate them for other owners.

**Hosting reality.** Heavy stacks (Twenty, Postiz+Temporal, Odoo, Mautic) should not go on the current box. A second small VM per stack, or per-owner containers (our capability-gaps doc estimated ~$5–15/mo compute per user), is the likely shape. GPU models (music, video, avatar, image) must be rented per second (Modal/RunPod-style) because the box has no GPU.

---

# Part A. Business tools (replace GoHighLevel + ServiceTitan for small local-service businesses)

Columns: License · host cost · agent-drivability · maturity (last release / stars) · multi-tenant fit.

## A1. CRM (for owners who have none)

| Candidate | License | Host cost | Agent-drivability | Maturity | Multi-tenant fit |
|---|---|---|---|---|---|
| **Twenty** | AGPL-3.0 + commercial `ee/` files; CLI/SDK are MIT; has an explicit "Application Exception" so apps that talk to it over its API aren't pulled into AGPL | Docs: 2 GB min, 4 GB comfortable; server + worker + Postgres 16 + Redis | Best of the group: REST + GraphQL, custom objects/fields via metadata API, official MCP server (OAuth or API key), `twenty` CLI (auth, data, api, metadata) | v2.63.0 (2026-11-24), ~61k stars, very active | Workspace model built in. Free self-host includes core CRM; SSO/row-level permissions/audit logs need paid key. Self-host multi-workspace **(verify)** |
| **EspoCRM** | AGPL-3.0 | Light: PHP + MySQL/MariaDB, ~1 GB **(verify)** | Full REST API; official free MCP extension; solid workflow engine; mature | 10.1.4 (2026-11-19), ~3.7k stars, since 2014 | One instance per tenant; light enough to do that |
| **Krayin** | **MIT** | Laravel + MySQL, ~1 GB **(verify)** | REST API package (`krayin/rest-api`, bearer token); smaller feature set | v2.2.8 (2026-11-06), ~24k stars | Freest license for embedding or per-tenant copies |
| **SuiteCRM 8** | AGPL-3.0 | Heavy legacy PHP stack | API v8 (JSON:API); clunky for an agent | 8.10.2 (2026-07-31), slower cadence | Per-tenant instance only |
| **Frappe CRM** | AGPL-3.0 | Needs Frappe bench (MariaDB + several Redis + workers), ~2 GB | Frappe REST for every doctype | v16.4.0 (2026-11-25), ~4k stars; younger | Per-site multi-tenancy is a Frappe feature |
| **Odoo Community** | LGPL-3.0 (CE only) | 2 GB+ with Postgres | XML-RPC/JSON-RPC; newer JSON API **(verify)** | Annual major releases, ~56k stars | Strong but a whole ERP. Field Service, Studio and several other modules are Enterprise-only **(verify)**, so CE won't replace ServiceTitan |

**Verdict.** Built-in first: a `crm` CLI on the existing contact store (contacts, companies, interaction timeline from calls/SMS/email/forms, pipeline stages, tasks, tags, notes, custom fields). For owners who later want a screen, offer **Twenty** as an "upgrade" because its API/MCP/CLI are the best for an agent and the app-exception makes our adapter licensing clean. Keep **EspoCRM** as the lighter fallback and **Krayin** as the MIT option if we ever need to embed per-tenant.

## A2. CRM connectors (owners who already have one)

No open-source app is needed. Build one adapter interface (`contact find/upsert`, `note add`, `deal/stage move`, `task create`, `webhook in`) with per-vendor adapters, and keep our SQLite as the cache/timeline.

| Vendor | Auth/API notes | Order |
|---|---|---|
| HubSpot | OAuth or private-app token, REST, free developer test account | 1st (easiest to test) |
| GoHighLevel | API v2 with OAuth marketplace app; likely the most common among the target owners | 2nd (highest demand) |
| Jobber | GraphQL, OAuth, developer app review | 3rd |
| Pipedrive, Zoho CRM | REST + OAuth | 4th |
| Salesforce | REST + connected app; heavy per-org setup | 5th |
| ServiceTitan | Partner/developer program, per-tenant credentials and approval | Last. Gated by their onboarding, not by code |

Use a managed OAuth layer (e.g. Nango, Composio, Pipedream Connect) only if token storage per owner gets painful **(verify license and pricing before choosing)**. The vault + broker pattern we have for Microsoft may be enough.

## A3. Automations and workflows

| Candidate | License | Host cost | Agent-drivability | Maturity | Multi-tenant |
|---|---|---|---|---|---|
| **n8n** | Sustainable Use (fair-code) + `.ee.` files under enterprise license | ~1 GB + Postgres | Public API + MCP server that can create/edit workflows | n8n@2.49.6 (2026-11-25), ~212k stars | **No** for customer-authored workflows through our agent. OK for John's internal use |
| **Activepieces** | MIT core; `ee/` folders commercial | Postgres + Redis, ~1–2 GB **(verify)** | Every piece exposes MCP; REST API | 0.94.0 (2026-11-25), ~26k stars | Core is MIT; embedding/SSO features are paid |
| **Windmill** | AGPL backend, Apache client, proprietary enterprise snippets | Rust server + workers + Postgres | Code-first (Python/TS/Bash scripts), `wmill` CLI, OpenAPI. Good for agent-written automations | v1.885.0 (2026-11-25), ~19k stars | Workspaces built in; EE for some features |
| Huginn | MIT | Ruby, light | Agents via UI/API; dated | v2026.11.19, ~50k stars | Per-instance |
| Automatisch | AGPL-style, stalled | n/a | n/a | Last release Aug 2025, last push Feb 2026 | **Skip** |

**Verdict.** Don't start with an external engine. The agent is already the workflow brain; what it lacks is a **durable rule store**: `rules add --when missed_call --if business_hours=closed --then sms,crm.note` with delays, conditions, run history and undo, executed by one small worker reading the event log. That covers missed-call text-back, new-lead follow-up, appointment reminders, review requests and overdue-invoice nudges. Add **Activepieces** later as the long-tail "connect any other app" hub (MIT core is safest for multi-tenant). Use n8n only for John's internal flows.

## A4. SMS, A2P campaigns, missed-call text-back

No open-source app worth running. This is Telnyx plus our own code.
- **Telnyx ISV flow (docs):** register each owner's brand, create a campaign per owner, share it to Telnyx, assign numbers only after sharing is ACCEPTED. For campaigns registered outside Telnyx, assign with `POST /v2/10dlc/phoneNumberAssignmentByProfile` using `tcrCampaignId` (never send both IDs).
- **Must be deterministic code, not LLM:** consent ledger (opt-in source and time), STOP/HELP/START handling, quiet hours by recipient timezone, per-owner daily caps, template approval, dry-run mode. This is the real product.
- **Missed-call text-back:** our phone webhook already sees unanswered calls. A rule fires an SMS within seconds, and the thread joins the contact timeline so the agent can continue the conversation.
- **Gate:** 10DLC brand/campaign vetting is an external wait. Start with John's own brand and test numbers, and keep owner-alert texts off during tests (existing rule). Toll-free verification is the alternative lane **(verify)**.
- **Skip:** Chatwoot (MIT core + enterprise dir, v4.20.1, Rails+Postgres+Redis+Sidekiq, multi-GB) as an inbox. Too heavy for what the agent needs.

## A5. Email marketing and sending

| Candidate | License | Host cost | Agent-drivability | Maturity |
|---|---|---|---|---|
| **listmonk** | AGPL-3.0 | Go single binary + Postgres; tens of MB | Clean REST API (lists, subscribers, campaigns, templates, transactional) | v7.0.0-beta.2 (2026-11-10); pin the latest stable 6.x; ~24k stars |
| **Mautic** | GPL-3.0+ | PHP, 2 GB+; heavy | Real marketing-automation journeys; OAuth2 API | 7.2.3 (2026-11-25), ~11k stars |
| **Keila** | AGPL-3.0 | Elixir, light | Newsletters, API | 0.40.2 (2026-11-04), ~2.3k stars |

The real cost is deliverability, not the app: sending domain, SPF/DKIM/DMARC, and a provider (SES, Postmark or Resend) with per-owner subdomains and complaint handling.
**Verdict.** First: built-in `email` CLI that sends one-to-one and small-list mail through a provider API, uses the same consent ledger as SMS, and is triggered by `rules`. Add **listmonk** when an owner wants a real newsletter list (cheap, API-first). Skip Mautic unless an owner demands visual journeys.

## A6. Forms and lead capture

| Candidate | License | Notes |
|---|---|---|
| **OpnForm** | AGPL-3.0 + `Enterprise` dir | Typeform/Tally-style builder; v2.8.6 (2026-11-19); Laravel + Nuxt; has API |
| **Formbricks** | AGPL core + `ee` dir; MIT SDK packages | Survey/feedback focus; 6.2.3 (2026-11-25) |
| HeyForm | AGPL-3.0 | v3.0.8; builder |

**Verdict.** Built-in wins. An owner's lead form is 5–8 fields. The agent generates a hosted page (or embeddable snippet) from a JSON schema, and a POST endpoint writes to `crm`, fires the text-back rule and notifies the owner (alerts honor the on/off settings). Use Formbricks later only for surveys/NPS.

## A7. Invoicing, payments, quotes and estimates

| Candidate | License | Host cost | Agent-drivability | Maturity |
|---|---|---|---|---|
| **Invoice Ninja v5** | Elastic License 2.0 | PHP + MySQL + Redis, 1–2 GB | Large REST API; quotes, recurring invoices, many gateways | v5.14.0 (2026-11-24), ~10.6k stars. Self-host includes all Pro/Enterprise features; $40/yr white-label. **Can't offer as a hosted service to our owners without a reseller agreement** |
| InvoicePlane | MIT (per project; GitHub didn't auto-detect) | PHP | Thin API | v1.7.2 (2026-08-28) |
| Akaunting | BSL 1.1 (see matrix) | PHP | REST | 3.3.2 (2026-11-20). **Skip** for us |
| Dolibarr | GPL-3.0+ | PHP ERP-lite | REST API | 24.0.4 (2026-11-25) |
| Crater | Repo renamed/redirected; effectively unmaintained | n/a | n/a | **Skip** |
| Documenso / DocuSeal | AGPL-3.0 | Light–medium | REST API + embeds, legal signing trail | v2.22.0 / 3.4.0 (Nov 2026) |

**Verdict.** Don't host an invoicing app. Money movement already runs through **Stripe Connect** (John has it), and Square is easy. Build `invoice` / `quote` CLIs that own our line-item data and call Stripe Invoicing / Payment Links (test mode first) or Square Invoices through each owner's connected account. Quotes: good/better/best options, approve-by-link; add **DocuSeal** or **Documenso** only when a signed contract is needed. QuickBooks: needs Intuit app review, so do CSV export now and a sync later. Check Stripe/Square per-invoice fees before promising owners a price **(verify)**.

## A8. Job scheduling and dispatch (the ServiceTitan half)

Cal.com closed its source in April 2026. **Cal.diy** (MIT, v6.2.0 Mar 2026, ~50k stars, API v2) is the open fork but drops teams, workflows and routing forms and is marked "personal, non-production". It also can't do technicians, skills, travel time or arrival windows. Our `phone` booking code already does deterministic slot math on Microsoft calendars.

Open-source field-service projects exist but are all young. None is something to adopt wholesale yet. Star counts weren't checked.

| Project | License | Note |
|---|---|---|
| Openfront Home Services | MIT | Next.js + Keystone + Postgres. Dispatch board, price books, estimates, memberships. **MCP tools for AI agents.** Phase 1 only (calls, booking, dispatch) |
| OpenFieldPro | AGPL | CRM → dispatch → estimates → invoices, tech mobile app; "release-candidate hardening" |
| OpenFieldService | MIT | SQLite, Preact + Hono; has an agent-optimized UI mode (`?agent`) |
| Glove (just-every/run-glove) | MIT | Cloudflare Worker + D1; 2–10 tech trades; agent prepares quotes and dispatch proposals for human approval |
| FieldOpt | AGPL | v0.0.9; dispatch console and auto-router only |

**Verdict.** Build `job` as a built-in: jobs → visits → technicians, skills, service areas, availability windows, arrival-window capacity, and assignment by deterministic code (same discipline as booking). Borrow data-model ideas from Openfront and Glove. For travel time use a pay-per-call routing/geocoding API at first; self-host OSRM/Valhalla only if volume justifies the memory. Re-evaluate Openfront Home Services in a few releases as a possible adopted core.

## A9. Reviews, reputation, Google Business Profile, local SEO

- No credible open-source reputation suite found. Build `review`: after a job is marked paid, send a review-request SMS with the owner's Google review link, and track requested/clicked.
- **Google policy caution:** don't gate requests by sentiment (asking only happy customers). Route unhappy replies to the owner privately *in addition to* sending everyone the link.
- **Later:** Google Business Profile API (read/reply to reviews, posts, hours sync). Access needs Google approval, so apply early. Local SEO: citation and rank audits using SearXNG/Crawl4AI plus Umami for the owner's site.

## A10. Knowledge base

| Candidate | License | Verdict |
|---|---|---|
| Built-in: SQLite FTS5 + embeddings (sqlite-vec or pgvector) | n/a | **Pick.** Short facts stay in the voice prompt; long docs go here. One `kb` CLI used by both agents |
| Outline | BSL 1.1 (no Document Service) | Fine for John; blocked for many owners |
| Open Notebook | MIT, v1.15.1 | NotebookLM-style; see Part B |
| Meilisearch / Qdrant | MIT + BUSL-EE parts / Apache-2.0 | Only if built-in search gets slow |

## A11. Other tools that clearly help a local service business

| Need | Pick | Why |
|---|---|---|
| Site analytics for the owner's website | **Umami** (MIT, v3.5.0, light, Postgres) | "How many visitors this week?" Plausible CE (AGPL) needs ClickHouse (heavier); Matomo (GPL) is PHP/MySQL |
| Document intake (receipts, permits, tax docs) | **Paperless-ngx** (GPL-3.0, v3.5.1, ~48k stars, REST API) | OCR + search; "find the Home Depot receipt from March". Medium priority |
| Time tracking for hourly techs | Kimai (AGPL) / solidtime (AGPL) | Only if owners bill hourly; otherwise job visits cover it |
| Memberships / service plans | Stripe Subscriptions | Lago (AGPL) is overkill |
| Website for the business | Agent builds static site → free static hosting; **Ghost** (MIT, v6.79.0) if they want blog/newsletter | OpenHands already builds sites; the gap is deploy + domain |
| E-signature | DocuSeal / Documenso (AGPL) | See A7 |

---

# Part B. General-user products (open-source alternatives to paid products)

Selection rule: real products people pay for, not utilities, and not things the agent's browser already does. Ranked by wow + usefulness at low cost. "Replaces" names the paid product.

Hosting key: **CPU-OK** = runs on our box or a small VM. **GPU** = rent per second. **Own HW** = lives on the owner's hardware.

## B1. Ranked picks

| # | Product (what it does) | License (flag) | Host cost | Agent-drivability | Maturity (last release, stars) | Replaces |
|---|---|---|---|---|---|---|
| 1 | **Deep research stack:** GPT Researcher + SearXNG + Crawl4AI. Multi-source cited reports | Apache-2.0 / AGPL-3.0 (SearXNG, run unmodified) / Apache-2.0 | CPU-OK; cost is LLM tokens (cheap models). Our Hetzner IP gets blocked by some engines, so route through the residential proxy plan | Python library + API; SearXNG JSON API; Crawl4AI REST/Python | gpt-researcher v3.8.0 (2026-11-09, ~31k); crawl4ai v0.9.6 (2026-11-20, ~88k); SearXNG active (~40k) | ChatGPT/Perplexity Deep Research |
| 2 | **Postiz:** social scheduler for many networks, AI drafts, calendar | AGPL-3.0, no feature gating | Needs Postgres + Redis + Temporal, so a separate VM. You must create each network's developer app (X, LinkedIn, Meta need approval) | Public REST API, webhooks, **CLI**, built-in **MCP** | v2.26.0 (2026-11-13), ~42k | Buffer, Hootsuite, Later |
| 3 | **Kokoro TTS** via Kokoro-FastAPI: natural voices, OpenAI-compatible endpoint | Apache-2.0 | **CPU-OK** (82M model); quality below ElevenLabs but free | One HTTP endpoint | Kokoro-FastAPI v0.10.0 (2026-11-08, ~5.7k); Kokoro itself has no recent releases (last push 2025-08) | ElevenLabs basic voices |
| 4 | **Transcription:** whisper.cpp / faster-whisper (+ WhisperX for speakers) | MIT / MIT / BSD-2 (speaker labels use gated pyannote models, check terms) | CPU-OK for small/base models. Large models are slower than real time on 4 vCPU | CLI | whisper.cpp v1.9.6 (2026-11-23, ~56k); faster-whisper v1.2.1; whisperX v3.8.6 | Otter, Descript transcripts |
| 5 | **Music generation: ACE-Step 1.5**, full songs with lyrics | **MIT** (code) | **GPU**: reported ≥4 GB VRAM for the 2B turbo model, ~6 GB with its LM | Python/REST wrapper we write | v0.1.8 (2026-05-18), ~15k; authors place quality between Suno v4.5 and v5 | Suno, Udio |
| 6 | **Image gen/edit: ComfyUI** (node workflows, any model), plus **rembg** | GPL-3.0 (app) / MIT; each model has its own license | **GPU** for generation; rembg is CPU-OK | Headless HTTP API: submit a workflow JSON, poll the result. Excellent for an agent | ComfyUI v0.46.0 (2026-11-18, ~149k); rembg v2.0.88 (2026-11-24) | Midjourney, Canva Magic, Photoshop gen-fill, remove.bg |
| 7 | **Analytics: Umami** | MIT | CPU-OK, light | REST API | v3.5.0 (2026-11-12), ~40k | Google Analytics, Hotjar-lite |
| 8 | **Home Assistant:** home control and automations | Apache-2.0 | **Own HW**. Our server needs a tunnel (Tailscale or Nabu Casa) | REST + WebSocket API, long-lived token, official MCP server integration **(verify)** | 2026.11.3 (2026-11-23), ~93k | SmartThings, Hubitat, vendor hubs |
| 9 | **Open Notebook:** chat with your documents, **multi-speaker podcast generation** | MIT | CPU-OK + LLM/TTS calls | REST API | v1.15.1 (2026-11-04), ~42k | Google NotebookLM |
| 10 | **Paperless-ngx** (documents) and **Immich** (photos) | GPL-3.0 / AGPL-3.0 | Paperless light. Immich ML is 4 GB+ | REST APIs, with smart search in Immich | v3.5.1 (~48k) / v3.4.2 (~120k) | Evernote scan, Dropbox / Google Photos |
| 11 | **Finance: OpenBB** (data), **TradingAgents** (multi-agent analysis), **Freqtrade** (crypto bot), **Ghostfolio / Actual Budget / Firefly III** (portfolio and budgeting) | Apache-2.0 / Apache-2.0 / GPL-3.0 / AGPL / MIT / AGPL | CPU-OK | OpenBB REST (MCP package **verify**); Freqtrade REST + Telegram; budgeting apps have REST | OpenBB "ODP" release 2026-09-30; TradingAgents v1.0.1 (2026-11-25, ~124k); freqtrade 2026.10 (~57k) | Bloomberg-lite, YNAB, Mint, Wealthfront reports |
| 12 | **Video generation:** Wan2.2, LTX-2 | Wan2.2 Apache-2.0. LTX-2 code Apache-2.0, but **weights** under a community license (free below $10M annual revenue). HunyuanVideo has Tencent's own territory-restricted license | **GPU, large:** LTX-2.x full pipeline reported at 32 GB+ VRAM (A100/H100 class) | Python pipelines, ComfyUI nodes | LTX-2 v1.6.3 (2026-11-24, ~10k); Wan2.2 last push 2026-09 (~19k) | Runway, Pika, Veo, Sora |
| 13 | **Avatar / lip-sync video:** MuseTalk, OpenAvatarChat, Duix-Avatar (HeyGem) | MuseTalk MIT; OpenAvatarChat Apache-2.0; Duix-Avatar custom license; Wav2Lip has no license (research) | **GPU** | Python/Docker | MuseTalk pushed 2026-11-19 (~7k); OpenAvatarChat 0.6.0 (2026-04); Duix-Avatar v1.0.6 (2025-09) | HeyGen, Synthesia, D-ID |
| 14 | **Website/app building:** bolt.diy, Dyad, Webstudio | MIT / Apache-2.0 (+ `src/pro` source-available) / AGPL-3.0 | CPU-OK. Dyad is a desktop app | UI-first, weak for an agent | bolt.diy v1.0.3 (~20k); dyad v1.24.0 (~22k); webstudio 0.314.0 (~9k) | Lovable, Bolt, v0, Webflow |

## B2. Notes on specific picks

- **Voice cloning has license traps.** Chatterbox (MIT code and weights) is reported retired. **F5-TTS code is MIT but its pretrained weights are CC-BY-NC.** Fish-Speech's Oct 2026 license caps commercial use at $500k revenue and requires a license for hosted services. IndexTTS uses bilibili's own license. Coqui XTTS weights are non-commercial. For commercial use stick to **Kokoro, Piper (GPL-3.0, light), Orpheus (Apache-2.0)** and verify Chatterbox/VibeVoice (MIT) terms before relying on them. Any cloning feature needs recorded owner consent and a "voice owner" field.
- **Music:** MusicGen (AudioCraft) has MIT code but non-commercial weights. ACE-Step 1.5 is the clean pick. YuE (Apache-2.0) is heavier.
- **Video editing:** skip OpenCut (MIT, ~99k stars, last release Apr 2026). It is a browser editor for people, and our Remotion/ffmpeg pipeline already covers the agent's side. Video/avatar/music tools should plug into the AI Studio pipeline (see `ai-video-feature-census.md`, `standalone-ai-video-products.md`) rather than become separate products.
- **Postiz vs Mixpost:** Mixpost is MIT but its Pro/Enterprise tier holds features, and its last release was 2026-03. Postiz has an API, CLI and MCP and is far more active.
- **Home Assistant** is the strongest wow for a consumer but only works if the agent can reach the owner's LAN.
- **Vaultwarden / password-free services:** self-hosting a password manager is fine for the owner, but the agent should **not** be given vault access (we have a vault skill for credential handling). For passkey-only sign-in, **Pocket ID** (BSD-2, v2.19.3) is the light OIDC provider; authentik (MIT + enterprise folder) is heavier. Low priority until multi-user.
- **Finance and trading:** research and paper-trading only by default. No live orders without explicit owner approval, spend and loss limits, and an "analysis, not advice" label. Offering it to other people adds regulatory risk, so keep John-only for now.
- **Avoid:** Flowise (archived 2026-08), LangChain `open_deep_research` (archived 2026-08), Dify (multi-tenant prohibition), Open WebUI (branding-preserving custom license), Automatisch (stalled), Cal.com (closed). pocketbase showed as archived on GitHub **(verify)**.
- **Skip because the agent already does it:** browser-use (MIT, ~122k stars) since AgentLab has a browser. AnythingLLM (MIT, v1.20.0) and Khoj (AGPL) are chat-with-your-data apps that duplicate the agent. Mem0 (Apache-2.0, ~69k stars) is an agent-memory library worth a look **only** if our own memory proves weak.

## B3. The combination that makes the agent feel bigger

One chat request, "make me a week of posts about X", chains: **deep research** → script (LLM) → **Kokoro voice** → **ACE-Step** background track → **ComfyUI / video** visuals → **MuseTalk** presenter (optional) → **whisper** captions → **Postiz** schedule → **Umami** results next week. Each step is a separately useful tool, so the chain is the product and none is a dead end.

---

# Part C. Recommendation

## C1. Lean first set (lowest cost, highest leverage)

**Business (all built-in, no new servers except what is noted):**
1. `crm`: SQLite built-in on the phone contact store, plus event log.
2. `sms` + missed-call text-back on Telnyx, with the consent ledger.
3. `rules`: durable automation engine.
4. `invoice` / `quote` on Stripe Connect (test mode), then Square.
5. `form`: hosted lead forms.
6. `job`: scheduling/dispatch core.
7. `review`: request flow.
8. `kb`: FTS + embeddings.
9. CRM connectors: HubSpot, GoHighLevel, Jobber, then the rest.

**Optional apps, only on demand:** Twenty (screens), listmonk (newsletters), Activepieces (long tail), DocuSeal (signatures), Umami (site stats), Paperless-ngx.

**General (cheapest wow first):**
1. Deep research stack.
2. Postiz on its own VM.
3. Kokoro TTS and whisper as endpoints.
4. ACE-Step and ComfyUI on rented GPU.
5. Umami.
6. Home Assistant for John's home, via tunnel.
7. Finance research mode.

## C2. Build order

Each step gates on the one before it. Sizes: S = a CLI plus skill; M = adds an external API or a second service; L = adds compliance review or heavy hosting.

| # | Step | Size | Depends on | Why this position |
|---|---|---|---|---|
| 0 | Tool-pack convention: skill + CLI + SQLite + event log + undo + `--dry-run` + test-mode flags | S | none | Every later tool reuses it |
| 1 | `crm` (promote contact store, add timeline/pipeline/tasks/tags) | S | 0 | Everything else writes to it |
| 2 | `sms` + missed-call text-back | M | 1 | Biggest GoHighLevel feature. External gate: 10DLC vetting, so start with John's own brand |
| 3 | `rules` engine | M | 1, 2 | Turns tools into automations |
| 4 | General track G1: deep research stack | S | 0 | Independent, cheap, immediate payoff. Can run alongside 1–3 |
| 5 | `invoice` / `quote` on Stripe test mode, then Square | M | 1 | Owners get paid |
| 6 | `form` lead capture | S | 1, 2, 3 | Completes the lead → text-back loop |
| 7 | `kb` | S | 0 | Shared by phone and chat |
| 8 | General G2: Postiz on its own VM | M | 0 | Needs platform developer apps, which have their own approval waits. Start those early |
| 9 | `job` scheduling/dispatch | L | 1, 5 | Largest model; designed with deterministic code |
| 10 | `review` requests, then GBP read/reply | M | 2, 5, 9 | Needs paid-job events; GBP access needs Google approval |
| 11 | CRM connectors: HubSpot → GoHighLevel → Jobber → Pipedrive/Zoho → Salesforce → ServiceTitan | M each | 1 | One adapter interface, one vendor at a time |
| 12 | General G3: Kokoro, whisper endpoints | S | 0 | Cheap, plugs into the video studio and phone |
| 13 | General G4: ACE-Step, ComfyUI on rented GPU | L | 12 | Needs a per-second GPU worker and a cost meter |
| 14 | Email campaigns (provider API; listmonk on demand) | M | 2, 3 | Deliverability setup comes first |
| 15 | Umami, Home Assistant, Paperless-ngx, finance research | S–M | 0 | As requested |
| 16 | Optional apps: Twenty, Activepieces, DocuSeal | M | 1, 3 | Only when an owner asks |

## C3. How each is tested by asking the agent in chat

Rules for every test: start from the agent chat, never the CLI. Owner texts/emails stay OFF (John tests "text me" / "email me" at the end). Use dry-run, sandbox or test mode for money and SMS. After each chat, check the stored state (SQLite rows, the event log, the provider's test dashboard), not just the agent's reply. Every setting change must be reversible with "undo that".

| Tool | Chat test | What to verify |
|---|---|---|
| `crm` | "Add Maria Lopez, 571-555-0142, wants a water-heater quote; remember she prefers mornings" → "What do I know about Maria?" → "Move her to quoted; remind me Friday" → "Who haven't I followed up with in 10 days?" | Contact, note, stage, task rows; dedupe by phone; the phone agent sees the same contact on a test call |
| `sms` / text-back | "If I miss a call after hours, text them: sorry we missed you, what do you need?" → place a test call from a test number that goes unanswered | Rule stored, one SMS (dry-run log or test number) within seconds, in the timeline. Then "STOP" from the test number blocks later sends. "Don't text anyone before 9am" holds. "Undo that" restores |
| `rules` | "When a quote sits 3 days with no answer, text a nudge, then email at day 7" with the clock fast-forwarded | Delayed actions fire in order, stop when the customer replies, history lists runs, undo removes the rule |
| `invoice` / `quote` | "Invoice Maria $450 for the water heater, send her a pay link" → pay with a Stripe test card → "Did Maria pay?" | Stripe test-mode invoice, paid webhook updates `crm` and the job. Same flow on Square sandbox. Refund by chat |
| `form` | "Make a contact form for my website that asks name, phone, problem, and address" → submit it | Hosted page works, the lead lands in `crm`, text-back fires in dry-run, the field list changes by chat |
| `job` | "Book an AC repair Tuesday at 2 for Maria; give it to Dan" → "Dan is out Tuesday" → "What's on the board this week?" | Capacity and overlap enforced in code, reassignment proposed, no double-booking, time zones correct |
| `review` | "After each paid job, ask for a Google review two days later" | Request scheduled and sent in dry-run, everyone receives the link (no sentiment gating), click tracking |
| `kb` | "Our warranty is 2 years on labor; add this price sheet (PDF)" → test call asking about warranty and a sheet item | Short fact reaches the voice prompt, long-document answers come from lookup with a source |
| Connectors | "Connect my HubSpot" → "Add Maria to HubSpot and put her in Quoted" | OAuth stored in the vault, record appears in the HubSpot test account, the same verbs work on the built-in store |
| listmonk / email | "Send my customers a holiday hours email" | Only opted-in contacts, unsubscribe works, send goes to a test list first |
| Deep research | "Research the top 5 CRM options for a 3-person HVAC shop and cite sources" | Report with working links, run cost reported, no blocked-engine failures |
| Postiz | "Schedule 3 posts this week about our fall tune-up special, my approval first" | Drafts wait for approval, scheduled in the Postiz test workspace, edits and deletes work |
| TTS / whisper | "Read this paragraph in a calm voice" / "Transcribe this voicemail and summarize" | Audio file returned, transcript word error on a known clip, runtime and cost logged |
| ACE-Step / ComfyUI | "Make a 30-second upbeat jingle for my plumbing shop" / "Remove the background from this van photo" | File produced on rented GPU, cost per run shown to the owner, GPU shuts down afterward |
| Umami | "How many people visited my site this week and from where?" | Numbers match the Umami dashboard |
| Home Assistant | "Turn off the garage light" / "Every night at 11 lock the front door" | State change confirmed by the HA API, automation listed and undoable |
| Finance | "Watch NVDA and tell me what changed; paper-trade a $1,000 idea" | Paper account only; the live-order path refuses without explicit approval |

## C4. Open risks and unknowns

- 10DLC brand/campaign vetting and Google Business Profile API access are external approvals, so start them early.
- Several Part A candidates (Openfront Home Services, OpenFieldPro, Glove) are very young. Star counts and production readiness were not checked.
- Items marked **(verify)** above: RAM figures for PHP stacks, Odoo's JSON API and Enterprise-only modules, Home Assistant and OpenBB MCP details, Twenty's self-host multi-workspace, toll-free verification, Stripe/Square fee terms, Chatterbox/VibeVoice current terms.
- GitHub API star and release numbers are as of 2026-11-25. Rate limiting cut off a few lookups (Khoj, OpenBB release detail).
- Part B GPU costs are per-second rental estimates not priced in this pass. Price one real run of each before committing.
