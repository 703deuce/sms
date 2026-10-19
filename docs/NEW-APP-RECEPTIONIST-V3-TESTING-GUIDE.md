# AI Receptionist V3 — testing guide (new-app)

How to configure the receptionist, run automated checks, test voice in the browser, call on a real phone, and verify calls landed correctly.

**Branch / runtime:** native Voice V3 on `new-app` — no monolith bundle. Internal API: `POST /api/internal/voice-runtime` with `runtime: "native_voice_v3"`.

---

## What you are proving

Three layers must work together:

1. **New-app** (`http://localhost:3100` or your production new-app deploy) — draft, publish, internal tool API
2. **Python V3 worker** — LiveKit + GPT-Live; must call **new-app** (not legacy `:3000`)
3. **LiveKit** — browser test room **or** SIP to your business number

**Important:** On **Test** (`/app/receptionist/test`), the left panel **“Start test call”** (scenarios like “Book a cleaning”) is a **scripted UI demo only**. Real voice is:

- **“Live voice test (LiveKit)”** on the same page, or
- A **PSTN call** to your published business line

---

## 0. One-time environment

### New-app (`new-app/.env` or Coolify env for the `new-app` service)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres for the product |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Browser test + dispatch |
| `TRANSOVO_INTERNAL_API_KEY` | Worker auth to `/api/internal/voice-runtime` |
| `TRANSOVO_PUBLIC_URL` or `NEXT_PUBLIC_APP_URL` | Public URL (Test page “Worker API” check) |
| `DEV_WORKSPACE_ID` (optional) | Pin workspace if you have several |

Start the app:

```bash
cd new-app
pnpm install
pnpm dev
```

Open **http://localhost:3100/app/receptionist**.

There is no separate “create agent” wizard: **one AI Receptionist agent exists per workspace**. You configure it, publish, then call it.

### Python worker (repo root)

Point the worker at **new-app**, not the legacy app:

```bash
export TRANSOVO_BACKEND_URL=http://127.0.0.1:3100   # or https://your-new-app-host
export TRANSOVO_INTERNAL_API_KEY=<same value as on new-app>
export LIVEKIT_URL=wss://...
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
export OPENAI_API_KEY=...

# Must match new-app dispatch (default: transovo-voice-v3)
export VOICE_V3_LIVEKIT_AGENT_NAME=transovo-voice-v3

npm run voice-python:dev    # local dev
# or npm run voice-python:start   # production-style
```

See also `voice-runtime-python/.env.example` and `voice-runtime-python/README.md`.

### Quick automated smoke (no microphone)

With new-app running on port 3100:

```bash
cd new-app
pnpm run test:voice-v3
RECEPTIONIST_TEST_BASE_URL=http://127.0.0.1:3100 pnpm run test:receptionist
```

Both should end in **ALL PASS**. This confirms the native runtime marker and receptionist HTTP APIs — **not** live audio.

---

## 1. Configure the agent (UI walkthrough)

Use the sidebar under **AI Receptionist**:

| Step | Route | What to set |
|------|--------|-------------|
| 1 | **Agent** — `/app/receptionist/agent` | Name, greeting, capabilities (book / answer / transfer), intake fields |
| 2 | **Appointments** — `/app/receptionist/appointments` | If **Book** is on: provider (Microsoft / Google / Calendly), strategy **live** or **link**, at least one enabled appointment type |
| 3 | **Knowledge** — `/app/receptionist/knowledge` | If **Answer** is on: FAQs or sources (publish validation expects this) |
| 4 | **Call handling** — `/app/receptionist/call-handling` | **Pick a phone number** (number picker) — required for publish and PSTN |
| 5 | **Review & publish** — `/app/receptionist/activate` | Fix red checks, then **Publish** |

Draft edits are **not** what inbound SIP uses. **Publish** creates the live `VoiceAgentVersion` the worker loads for production calls.

### Publish failures you should expect (by design)

- Live **booking** with no calendar connected
- **Reschedule** enabled + **Calendly** connected (blocked — use Microsoft/Google for reschedule, or disable reschedule)
- **Transfer** on with no enabled destination
- No **phone number** assigned

More detail: `docs/NEW-APP-RECEPTIONIST-COMPLETION.md`.

---

## 2. Confirm readiness (before calling)

Go to **Test** — `/app/receptionist/test`.

In **Runtime readiness**:

- **Configuration** → Ready (published + phone + routing checks)
- **Worker API** → Reachable (detail should be `ok`)

If **Worker API** is **Unreachable**:

- `TRANSOVO_INTERNAL_API_KEY` missing on new-app, or
- `TRANSOVO_PUBLIC_URL` / `NEXT_PUBLIC_APP_URL` wrong, or
- Worker not running or `TRANSOVO_BACKEND_URL` still pointing at legacy `:3000`

---

## 3. Real voice test in the browser (recommended first)

On **Test**, use **Live voice test (LiveKit)** — not the scripted example on the left.

1. Choose **Draft** (iterate quickly) or **Live** (**Live** requires a successful publish).
2. Click **Start live test** and allow the microphone.
3. Status should become **connected**; you should hear the agent.
4. Tool events may appear in the panel if the worker sends `tool_event` data messages.

**Success:** You speak, the agent responds, you **End session** cleanly.

**Typical failures:**

- Toast: LiveKit not configured → set `LIVEKIT_*` on new-app
- No agent audio → worker not running or wrong `VOICE_V3_LIVEKIT_AGENT_NAME`
- Check worker logs for dispatch to `transovo-voice-v3` and HTTP to `…/api/internal/voice-runtime`

API used: `POST /api/receptionist/test/livekit` (creates room + dispatch + browser token).

---

## 4. Call it on a real phone (PSTN)

The **Call my phone** control on Test only shows guidance today; PSTN testing is: **dial your assigned business number** after publish.

### Requirements

1. **Published** agent (not draft-only for production SIP).
2. Number assigned in **Call handling**.
3. Number **LiveKit SIP provisioned** (`routingMode: livekit_sip`, active trunk). Publish runs provision + dispatch verification. If publish fails with `not_livekit_provisioned` or `dispatch_rule_not_found`, fix **Numbers / telephony** first — not just routing JSON in the UI.
4. **Call routing / coverage** sends inbound calls to the AI receptionist (Call handling).
5. Python worker running and registered with LiveKit as **`transovo-voice-v3`** (or your configured name).

### Test steps

1. From another phone, call the **business line** shown in Call handling / Overview.
2. Let the agent answer; try a simple flow (hours question, or booking if calendar is connected).
3. Hang up.

Production SIP loads the **published** configuration only (not the current draft).

---

## 5. Verify it worked

### In the UI

- **AI calls** — `/app/receptionist/calls` — new inbound row
- Open the call — summary, transcript (after post-call finalize), tools if recorded

### API spot-check

```bash
curl -s http://127.0.0.1:3100/api/internal/voice-runtime | jq .
# Expect: "runtime": "native_voice_v3"
```

With the same secret the worker uses:

```bash
curl -s -H "Authorization: Bearer $TRANSOVO_INTERNAL_API_KEY" \
  http://127.0.0.1:3100/api/internal/voice-runtime | jq .
```

### Database (optional)

- `voice_calls` — new row; `COMPLETED` after worker calls `finalize_voice_v3_call`
- `voice_tool_executions` — one row per tool invocation (`find_availability`, `book_appointment`, etc.)
- `voice_transcripts` / `voice_recordings` — after post-call payload includes transcript/recording URL

---

## Common “published but calling doesn’t work” causes

| Symptom | Likely cause |
|---------|----------------|
| Worker API unreachable on Test | Wrong URL/secret; worker still on legacy app |
| Browser connects, no agent audio | Worker down or agent name mismatch |
| Publish fails on phone | Number not LiveKit SIP–provisioned |
| Call rings, not AI | Routing policy, coverage, or receptionist paused |
| Booking fails on call | Calendar disconnected (publish should block obvious cases) |
| Wrong tools / old behavior | `TRANSOVO_BACKEND_URL` not pointing at **new-app** |

---

## Recommended order

1. `pnpm dev` in `new-app` + `pnpm run test:voice-v3` and `test:receptionist`
2. Configure agent → assign number → **Publish**
3. **Test → Live voice test** until you get a real conversation
4. PSTN call to the published line
5. Confirm **AI calls** list and call detail

---

## Related docs

- `docs/NEW-APP-RECEPTIONIST-COMPLETION.md` — architecture and what is implemented vs live-only
- `new-app/README.md` — quick start (port 3100)
- `docs/COOLIFY-NEW-APP-WEB.md` — production base directory `new-app`
