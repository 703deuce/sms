# AgentLab phone line: architecture (Nov 25, 2026)

## TL;DR
- Number: **+1 571-547-4814** (Telnyx, local, no A2P campaign). Untouched: +1 571-749-1060 and +1 571-407-3615 (both A2P), +1 866-602-0680 (toll-free platform sender).
- Voice: **real LiveKit Agents worker** (livekit-agents 1.8.13, same version as the old Transovo worker) using **OpenAI GPT Live** (`gpt-live-1`, voice `marin`) as the full-duplex front end, with `delegation="responses"` to the **Luna** backend model (`gpt-6-luna`) for reasoning/tool calls. It is not a Telnyx AI Assistant or any other provider. Telnyx only carries the call (SIP).
- LiveKit: **LiveKit Cloud** project `sms-6w01zoya` (Germany 2 region), confirmed by worker registration; the self-hosted `voice.transovo.ai` LiveKit isn't used.
- AgentLab is the "brain behind the phone". Config lives in a file the AgentLab agent edits from chat (`phone set ...`), and every call lands in AgentLab as a call log row, a notification and a follow-up run.

## Call path
```
Caller -> PSTN -> Telnyx number +15715474814
   -> Telnyx FQDN connection "Transovo LiveKit Inbound" (3037959952799893412, FQDN 2tzwfcliuex.sip.livekit.cloud, inbound auth by FQDN/IP)
   -> LiveKit Cloud inbound trunk  ST_jfXYgG4kqoxu "agentlab-phone-inbound" (only this number)
   -> dispatch rule SDR_miJSdHZm3Kwe "agentlab-phone-dispatch" (individual room "agentlab-phone-call-*", agent "agentlab-phone")
   -> worker container `agentlab-phone` on AgentLab host 204.168.139.158 (docker, --network host, uid 10001)
        AgentSession(llm=GPTLiveModel(gpt-live-1, voice, delegation=responses, responses_options={model: gpt-6-luna}))
        on_enter: generate_reply(greeting) with one retry (GPT Live is server-driven and silent until asked)
        tools (run in the worker, called by Luna): save_message, check_availability, book_appointment,
              send_booking_link, transfer_call, end_call (LiveKit EndCallTool)
   -> on hang-up: transcript (from conversation_item_added) + Haiku summary/extraction
        -> /workspace/runs/phone/calls.db (table calls) + calls/<id>.md
        -> runs.db notification (kind=phone) + queued AgentLab run (source=webhook, "[Phone call follow-up]")
```
Transfers/outbound: LiveKit outbound trunk `ST_YeCHXEYQL8uS` "agentlab-phone-outbound" -> `sip.telnyx.com` with **SIP digest credentials** of a new Telnyx credential connection "AgentLab LiveKit Outbound" (3101291759108360086, Default outbound voice profile) and `X-Telnyx-Username` header on the first INVITE (per Telnyx/LiveKit docs). Transfer is a **bridge**: the worker dials the owner into the same room, then closes the GPT Live session (stops voice billing) and deletes the room when either side hangs up. No SIP REFER.

### Why credential auth for outbound (not IP)
Telnyx and LiveKit docs both say LiveKit Cloud outbound must use credential (digest) auth: LiveKit Cloud egress IPs are shared, so IP auth can match the wrong Telnyx connection. Inbound stays FQDN/IP-routed as before. The Coolify env already had `TELNYX_SIP_OUTBOUND_USERNAME/PASSWORD` (plus `TELNYX_TELEPHONY_CREDENTIAL_ID`), but that username matches **no** current Telnyx credential connection or telephony credential, so LiveKit outbound got **403 Forbidden**. That is the root cause of broken outbound/transfer on the old trunk `ST_WkXbpBk5wokm`, which uses the same stale credentials. A separate free credential connection keeps AgentLab isolated from prod. The SIP credential is a trunk secret, not an app login.

## Owner-editable config (no wizard)
File: `/opt/agent/workspace/runs/phone/config.json` (container: `/workspace/runs/phone/config.json`). It is read at the start of every call, so there's no restart. AgentLab CLI `phone` (in `/opt/agent/tools`) with skill `lab-phone-agent`:
- `phone status`, `phone config`, `phone set '<json patch>'` (validated), `phone set-followups '[...]'`
- `phone calls [--open]`, `phone call <id>`, `phone handled <id> --note`

The keys mirror the old wizard's after-hours choices (any combination):
- `options.take_message` (callback message)
- `options.appointments`: `off` | `request` (collect details, AgentLab books after) | `live` (check real free/busy and book during the call) | `send_link` (text the booking link)
- `options.transfer` + `transfer.number` + `transfer.when` (plain-language condition; the model judges it, no keyword matching)
- `during_business_hours`: `answer` | `transfer`; `mode`: `after_hours` | `always`; `business_hours`, `timezone`
- `greeting`, `assistant_name`, `voice` (marin/cedar/beacon/cinder/stone/vesper), `business_info`, `extra_instructions`
- `booking.*` (calendar id, length, buffer, days ahead, min notice, hold TTL, title, link)
- `sms.*`: `enabled`, `from` (default platform toll-free +18666020680, no per-tenant A2P), `text_caller_confirmation`, `text_booking_link`. A tenant's own local number needs A2P first. Off by default; no texts were sent in tests.
- `after_call.run_agent`, `after_call.instructions`, `after_call.follow_ups` (plain-language list, e.g. "email me a summary")
- `enabled` (hard off switch)

## Live booking with double-booking protection (built, waiting on Microsoft sign-in)
`worker/calendar_ms.py`:
1. Run `check_availability` for live free/busy (Graph `calendarView` through the connector broker). It returns free slots inside business/booking hours and skips slots that another call holds.
2. `book_appointment` takes an **atomic hold** first: SQLite `slot_holds` with `BEGIN IMMEDIATE`, keyed (calendar, slot) with an overlap check and a TTL (default 5 min). A second caller can't hold an overlapping slot (unit-tested: overlap refused, adjacent allowed).
3. Re-check free/busy, then create the event (Graph `POST /events` with a `transactionId` for idempotency, and an invite if the caller gave an email).
4. Re-check after writing. If any other busy event overlaps, delete ours and offer another time. The agent says "booked" only after this passes. The hold becomes `booked`.
5. If the calendar isn't connected, `live` silently downgrades to `request` for that call, so it never promises a booking it can't make.
The post-call AgentLab run verifies the booking (reads the event back) per the skill.

## Connectors (one-click OAuth) for AgentLab
- Host service `agentlab-connectors` (`/opt/agent/connectors/broker.py`, systemd). The API is on 127.0.0.1:6081 and the callback listener on 127.0.0.1:6082, behind Caddy at `https://agentlab.transovo.ai/oauth/*`.
- It reuses the existing Transovo app registrations (MICROSOFT_*, CALENDLY_*, SALESFORCE_*, ZOHO_* copied host-only into `/opt/agent/secrets/phone.env`). Tokens are stored host-only in `/opt/agent/secrets/connectors/*.json` (0600), and refresh is automatic.
- Agent CLI `connector status | link <p> | call <p> <METHOD> <path> ...`, with skill `lab-connectors` (Calendar, Outlook mail, Teams, Bookings, OneDrive/SharePoint, Calendly, Salesforce, Zoho recipes).
- Microsoft scopes requested: openid profile email offline_access User.Read Calendars.ReadWrite Contacts.Read Mail.ReadWrite Mail.Send Chat.ReadWrite ChannelMessage.Send Team.ReadBasic.All Channel.ReadBasic.All Files.ReadWrite.All Sites.ReadWrite.All Bookings.ReadWrite.All.
  The prod Transovo app only ever requested `openid profile email offline_access User.Read Calendars.ReadWrite Contacts.Read`, so that's all that is known to be consented. Mail, Teams, Files and Bookings use dynamic consent at sign-in, and some (ChannelMessage.Send, Bookings, Sites) may need tenant admin consent. `connector status` shows what was actually granted.
- **Blocked on John:** DNS `agentlab.transovo.ai` A -> 204.168.139.158, ports 80/443 open, and these redirect URIs added to each app:
  `https://agentlab.transovo.ai/oauth/microsoft/callback`, `.../oauth/calendly/callback`, `.../oauth/salesforce/callback`, `.../oauth/zoho/callback`.

## What existed before (old Transovo receptionist) and what was wrong
- Code: `703deuce/sms` `voice-runtime-python/transovo_voice` (~9.4k lines). It ran on Coolify app `transovo-voice` (container `tgjridm6…`) as two processes: `legacy` (agent `transovo-voice-runtime`, STT/LLM/TTS pipeline: Deepgram Flux + DeepSeek + ElevenLabs) and `v3` (agent `transovo-voice-v3`, GPT Live + Luna). Each call bootstrapped config over HTTP from `https://transovo.ai` (`resolve_session_config`) and ran tools through the Next.js backend (`execute_voice_v3_livekit_tool`).
- History: 142 commits on the voice runtime (Sep 19 to Oct 27), including many variants: legacy pipeline, V3 GPT Live, REFER transfers, Telnyx Call Control bridge, LiveKit bridge, MCTB TeXML, OpenAI SIP direct ("Transovo Voice V3 Basic OpenAI Live SIP" FQDN to sip.api.openai.com), and Telnyx AI Assistants (many TeXML apps). The working era was V3 (GPT Live via LiveKit), commit `cd75ff03` (Sep 20) "proactive greeting on LiveKit session connect", later "golden-era" `a4a63466c` restored in `369b11627` (Oct 24).
- **"On answer it didn't do what it was supposed to" (root cause):** GPT Live is server-driven and doesn't speak until it hears audio unless the app calls `generate_reply()` on enter. `cd75ff03` added that greeting, but the **currently deployed** `voice_v3/session.py` has no `on_enter`/`generate_reply` (it regressed in the later restores). So the caller got dead air and the call depended on who spoke first. Also, every call waited on a cross-server HTTP bootstrap to transovo.ai (60s timeout, retries) **before** the session started, which added more silence on pickup. Fix: greeting with retry in `on_enter`, and config read from a local file in milliseconds.
- **Calendar "set up but not connecting" (root causes):** (1) Documented in `docs/AR-MICROSOFT-OAUTH-ROOT-CAUSE-2026-10-11.md`: duplicate Microsoft connection rows for the same account (split brain), where sync used the row whose refresh token was dead (`invalid_grant`). (2) Seen now: the web app container uses Supabase `ztccppxodhgdyejkuuax` while the voice worker and sms-worker containers point at `azurgysigroeizdrlxgx`. Rows written by one aren't seen by the other. (3) `LIVEKIT_SIP_URI` differs between web (`2tzwfcliuex…`) and workers (`sms-6w01zoya…`). Fix in the new design: one token store per provider on the AgentLab host, with refresh under a lock. Bookings happen in AgentLab or in the worker through the same broker, so there's no second database.
- **Transfers/outbound:** stale Telnyx SIP credentials (403), see above.
- Stale variants (not deleted; they belong to prod Transovo): legacy pipeline profile, the Telnyx AI Assistant TeXML apps, "Transovo Voice V3 Basic OpenAI Live SIP" FQDN connection and its Call Control app, MCTB TeXML/Call Control apps, and the self-hosted LiveKit at voice.transovo.ai. Mark them as historical; this setup uses none of them.

## Changes to shared/prod resources (all reversible)
- LiveKit Cloud: +15715474814 moved off `ST_vewjyLgDxVda` (transovo-telnyx-inbound) onto the new trunk. Side effect: the update normalized that trunk's list and dropped the duplicate no-"+" aliases (`18663464256`, `15717491060`, `15714073615`). Telnyx sends +E.164 (`dnis_number_format +e164`), so the "+" forms still match. The before-state is in `livekit_sip_before.json`.
- Telnyx: re-asserted +15715474814 on its existing FQDN connection (no change), and created the credential connection "AgentLab LiveKit Outbound".
- No Coolify/Transovo app change and no deploy.

## Multi-tenant later
`provision.py` (host): `inventory`, `search --area 571` (no spend), `order <num> --i-have-approval` (refuses without it), `attach <num> --agent <name>` (Telnyx connection -> per-agent LiveKit inbound trunk + dispatch rule), `detach`, `outbound-trunk`. Per tenant: its own agent name/worker or one worker reading per-number config, its own config dir, connectors per tenant.
