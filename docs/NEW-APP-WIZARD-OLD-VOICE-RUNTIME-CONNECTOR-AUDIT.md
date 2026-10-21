# New-app wizard + old voice runtime — connector audit

**Question:** Can we keep the new wizard/UI and use the old (“golden”) voice backend without re-porting and without dragging in legacy platform baggage?

**Date:** October 2026  
**Context:** Production shape today vs desired “front connectors only” architecture.

---

## Short answer

**Yes — you can keep the new wizard/UI and treat the voice runtime as a fixed “old air” backend**, but only if you stop running a **second copy** of that backend inside `new-app`. Right now production is roughly:

```
New wizard (new-app) → publish to DB → new-app /api/internal/voice-runtime → copied voice-v3 in new-app
```

What you want is:

```
New wizard (new-app) → publish to DB → **one** voice runtime (monolith `src/lib/voice-v3`) ← same Python worker
```

That is **architecturally sound** and **safer than continuing to maintain two runtimes**, as long as you do not also run the full legacy monolith UI, workers, and side paths on the same calls.

---

## What is already shared (good news)

| Layer | Shared? | Notes |
|--------|---------|--------|
| Database / Prisma | **Yes** | One `prisma/schema.prisma`; new-app publish writes `VoiceAgent` / `VoiceAgentVersion` (same tables the old path reads). |
| Python LiveKit worker | **Yes** | `voice-runtime-python` only talks HTTP to `TRANSOVO_BACKEND_URL` + `/api/internal/voice-runtime` — it does not care which UI you use. |
| Tool contracts (`update_intake`, FIND/BOOK, etc.) | **Same design** | Problem has been **duplicate TypeScript trees drifting**, not a different product model. |
| Booking to calendar | **Runtime-owned** | Voice books via `book-dispatch` / Microsoft (or Calendly per wizard), not via the Appointments **page** unless you explicitly wire a strategy to internal appointments APIs. |

So “front connectors only” is realistic: **editor → publish bundle → session resolve → tool execute**. The wizard is already trying to be that connector.

---

## What is *not* the same today (why it feels broken)

Two different **session resolve** paths:

| | **Monolith (old air)** | **new-app (current prod web)** |
|--|------------------------|--------------------------------|
| DID → agent | `resolveAgentByCalledNumber` (legacy telephony provisioning) | `resolveReceptionistByCalledNumber` + Phone foundation |
| Config load | `resolveVoiceV3AgentConfigForAgent` from published version | `compileReceptionistRuntimeBundle` + **extra** gates (`runtimeProfile`, IVR tool strip, editor digest, etc.) |
| Tool execute | `src/lib/voice-v3/*` | **`new-app/lib/server/voice-v3/*`** (ported copy) |

So you are **not** on “old backend unchanged.” You are on **old architecture + new-app reimplementation**, which is where things get forgotten (`liveContextEvents`, delegation scoping, profile coalesce, etc.).

Pointing the worker at a **second** URL (monolith container) without aligning **number assignment + publish shape** would fail in a *different* way — not magic fix.

---

## Three ways to get what you want (safest → riskiest)

### 1. **Recommended: UI in new-app, runtime = monolith code in one process (no duplicate tree)**

- **Keep:** all new-app pages/wizard/publish/phone UX.
- **Change:** `new-app/app/api/internal/voice-runtime/route.ts` (and friends) become **thin delegates** to `src/lib/voice-v3` and `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` (or a small shared package), not `new-app/lib/server/voice-v3`.
- **Do not ship:** re-porting tools, prompts, or dispatch logic in `new-app/lib/server/voice-v3` for execution.

**Safety:** **High** if CI fails when execution code is not the monolith path (one source of truth).  
**Risk:** Build/tsconfig coupling — must be deliberate (workspace package or allowed imports), not accidental `../../src` spaghetti everywhere.

### 2. **Split services: new-app UI + monolith “voice API” only**

- Coolify app A: `new-app` (UI + publish only; optional read-only APIs).
- Coolify app B: minimal legacy deploy exposing **only** `/api/internal/voice-runtime` + Prisma.
- Worker: `TRANSOVO_BACKEND_URL` → app B.

**Safety:** **Medium** — ops and auth secrets must match; **DID routing** on B must see numbers published from A (`VoiceAgentPhoneNumber` / assignments). new-app’s Phone foundation must write what B’s `resolveAgentByCalledNumber` expects, or B’s resolve must be updated once to match new-app routing (one-time bridge).

**Avoid:** running full monolith (campaigns, old `/voice`, embedded workers) on the same DB/calls.

### 3. **Keep current layout but “parity gate forever”**

- Continue duplicated `new-app/lib/server/voice-v3` with `verify-golden-runtime-parity.ts`.

**Safety:** **Low for your goal** — you already feel this: one fix on one side, forgotten on the other. Fits “don’t redo backend,” but **you are redoing it in practice**.

---

## What you should **not** pull in

To avoid “other stuff that messes it up”:

- Do **not** resurrect full legacy customer app on `3000` for day-to-day.
- Do **not** re-enable embedded SMS/MCTB workers, old `/voice/setup` editors, or Telnyx **sideband** path unless you intentionally want that transport again (LiveKit path is different; see `docs/VOICE-V3-LIVEKIT-DELEGATION-TOOL-CONTINUATION.md`).
- Do **not** add another compensating layer (hint engines, extra planners) on top of a broken connector — fix **one execution host** first.

Worker + LiveKit + GPT-Live delegation loop should stay as-is; only **which Node app executes `update_intake` / FIND / BOOK** should be pinned.

---

## “Booking goes to our booking”

Clarify two products:

1. **Voice runtime booking** — wizard `appointments` / calendar connection → existing `find-dispatch` / `book-dispatch` (Graph/Calendly). This is what PSTN uses today.
2. **New Appointments UI** (`/appointments`, types, public book) — separate unless you add a **booking strategy** that writes to the same internal appointment pipeline.

The wizard can stay the **connector** for (1) without importing the whole appointments frontend stack into voice. Parity is: **published connection IDs, service IDs, timezone, intake fields** — not copying appointment list pages into the worker.

---

## Feasibility verdict

| Question | Answer |
|----------|--------|
| Can we hook new wizard to old runtime? | **Yes** — same DB + same internal API contract + single execution codebase (option 1 or 2). |
| Is it safe? | **Safer than today** if you eliminate the duplicate runtime; **unsafe** if you run two divergent executors or full monolith alongside new-app without boundaries. |
| Without extra baggage? | **Yes**, if scope is locked to: publish, DID assignment, `resolve_voice_v3_livekit_session`, `execute_voice_v3_livekit_tool`, forensics/flush — nothing else from legacy nav. |
| Will intake/tools “just work” like before? | **Only** on the monolith execution path (or proven-identical delegate). Your pain matches **copy drift**, not missing product intent. |

---

## Practical recommendation

1. **Decide the single runtime owner:** monolith `src/lib/voice-v3` (recommended), not `new-app/lib/server/voice-v3`.
2. **Keep** new-app for wizard, publish, overview, phone UX.
3. **One integration test:** publish from new-app → worker resolve session → simulate `update_intake` → `set_scheduling_preference` → `find_availability` on the **chosen** execution host.
4. **Defer** “recovery hints” and prompt experiments until that path is the only executor.

**Smallest high-impact implementation:** internal voice-runtime in new-app delegates to monolith modules and production stops using the copied executor in `new-app/lib/server/voice-v3` (parity gate becomes “imports monolith” instead of “23 files byte-match”). Scope that without touching MCTB, campaigns, or legacy `/voice` pages.

**Implemented (Option 1 variant):** see `docs/VOICE-V3-NEW-APP-AUTHORITY-CONNECTOR.md` and `packages/transovo-voice-v3-runtime/`. Authority = `src/lib/voice-v3`; new-app executors are build-synced; LiveKit execute path goes through `voice-v3-runtime-connector`.

---

## Related docs in repo

| Doc | Purpose |
|-----|---------|
| `docs/COOLIFY-NEW-APP-WEB.md` | new-app as production web container |
| `docs/VOICE-V3-GOLDEN-ERA-NEW-APP-PARITY-AUDIT.md` | Prompt/tool drift audit |
| `docs/VOICE-V3-LIVEKIT-DELEGATION-TOOL-CONTINUATION.md` | LiveKit vs sideband tool completion |
| `docs/VOICE-V3-GOLDEN-ERA-FRONT-TO-BACK-RECEPTIONIST.md` | End-to-end receptionist stack |
| `voice-runtime-python/.env.example` | `TRANSOVO_BACKEND_URL`, internal API key |

---

## Reference paths (code)

| Area | Monolith | new-app |
|------|----------|---------|
| Internal API | `src/app/api/internal/voice-runtime/route.ts` | `new-app/app/api/internal/voice-runtime/route.ts` |
| LiveKit session resolve | `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` | `new-app/lib/server/voice-v3/resolve-livekit-session.ts` |
| Tool execute (LiveKit) | `executeVoiceV3ToolForLiveKit` in same bridge file | `new-app/lib/server/voice-v3/execute-tool.ts` |
| Publish | Legacy wizard paths | `new-app/lib/server/receptionist/agent-service.ts` (`publishReceptionist`) |
| Worker client | `voice-runtime-python/transovo_voice/integrations/backend_client.py` | (same worker) |
