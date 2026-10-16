# Voice V3 — Cert agent vs wizard capability parity audit

## Objective

Prove the appointment receptionist **wizard** can enable the same **Voice V3 tool catalog** as the proven **cert M365** agent—not that every published agent has identical tools by default.

## Runtime architecture (single engine)

| Layer | Model | Instructions source |
|-------|--------|---------------------|
| Amy (spoken) | `gpt-live-1` | `buildLiveFrontendInstructions()` |
| Astra / Luna (tools) | `gpt-6-luna` | `buildAstraBackendInstructions()` |

Tool registration: `listVoiceV3AstraToolNamesForConfig()` → LiveKit session `toolSchemas` (`resolveVoiceV3LiveKitSession`).

## Why default wizard ≠ cert tool count (expected)

| Setting | Cert reference | Wizard default |
|---------|----------------|----------------|
| `bookingStrategy` | `MICROSOFT_365` | `REQUEST_ONLY` (no connected calendar + `book_directly` not satisfied) |
| Calendar tools | Enabled | **Excluded by design** |
| `submit_appointment_request` | Off | On |

## Proven in CI (compiled layer)

Script: `scripts/test-voice-v3-capability-parity-audit.ts`

When the wizard snapshot matches **Microsoft 365 direct booking** (calendar connected, `bookingStrategy: MICROSOFT_365`, `book_directly`, provider connection id at compile):

- Same calendar tool surface as cert: `set_scheduling_preference`, `find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, `cancel_appointment` (when reschedule/cancel capabilities enabled).
- `transfer_call` registers only when `transfer.enabled` **and** at least one valid destination (wizard default advertises transfer in UI but omits tool without a destination phone).

Emit full matrix JSON:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-v3-cert-wizard-capability-parity-audit.ts
```

## `transfer_call` investigation

- **Not a separate Python path** — same Astra catalog as other tools.
- **Gating:** `capabilities.transfer_calls` + `transfer.enabled` (requires compiled destinations/routes) — see `voice-tool-catalog.ts` and `compile-transfer-config.ts`.
- **Prompt fix:** Amy/delegation sections now use **effective runtime tools**, not capability flags alone.

## Prompt alignment fixes (this pass)

- Astra cross-tool calendar workflows **conditional** on enabled tools / booking strategy.
- Amy capability summary + delegation policy match **registered** tools.
- Connection greeting + Amy opening greeting **coordinated** when `telephony.connectionGreetingMode` is active.
- Wizard knowledge: only **authoritative** knowledge item statuses in BUSINESS FACTS; placeholder “Add your business…” copy excluded.

## Matrix template (fill per environment)

| Tool | Cert | Wizard control | Wizard compiled (M365 fixture) | Python registration | Live executor | Status |
|------|------|----------------|--------------------------------|---------------------|---------------|--------|
| update_intake | ✓ | collect fields | ✓ | session bootstrap | ✓ | PASS (CI) |
| set_scheduling_preference | ✓ | M365 book | ✓ | same | needs PSTN | BLOCKED w/o prod |
| find_availability | ✓ | M365 book | ✓ | same | needs calendar | BLOCKED w/o prod |
| book_appointment | ✓ | M365 book | ✓ | same | needs calendar | BLOCKED w/o prod |
| submit_appointment_request | — | request only | ✓ (default) | same | — | PASS (CI) |
| transfer_call | ✓* | transfer + E.164 | ✓ with destination | same | needs PSTN | BLOCKED w/o prod |
| request_callback | ✓ | callback setting | ✓ | same | — | PASS (CI) |
| take_message | ✓ | take messages | ✓ | same | — | PASS (CI) |
| end_call | ✓ | always | ✓ | native Python | — | PASS (CI) |

\*Cert may omit transfer unless destinations configured on that agent.

## Production proof still required

CI proves **compiler + catalog + prompts**. It does **not** replace:

1. Wizard UI → Save Draft → reload → Publish on isolated agent `cmu42zyel…`
2. `resolveVoiceV3LiveKitSession` tool list on that `publishedVersionId`
3. Live FIND/BOOK against authorized Microsoft test calendar + cleanup

Use `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md` deploy + manual PSTN smoke when `DATABASE_URL` / workspace access is available.

## Production proof checklist (after PR #677 deploy)

1. Merge and deploy `cursor/voice-v3-wizard-capability-parity-f350` (PR #677).
2. In the **real wizard UI** on isolated agent `cmu42zyel…` / **+15714073615**:
   - Microsoft 365 **direct booking**
   - Connected authorized test calendar
   - Save Draft → hard reload → verify UI
   - Publish / Activate
3. **Inspect published compile** (prod container with `DATABASE_URL`):

```bash
WORKSPACE_ID=ws_1 AGENT_ID=cmu42zyel1c4x01090c6s335z \
  COMPARE_AGENT_ID=cmshz2lc25c622c4i58303501 \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/voice-v3-published-agent-tools-inspect.ts
```

Expect `compiledBookingStrategy: MICROSOFT_365`, `m365CalendarToolsComplete: true`, and seven calendar-related tools in `compiledAstraTools` when reschedule/cancel capabilities are on.

4. **PSTN smoke:** call business line → ask availability → one safe book → confirm Graph event → delete test event.
5. **UX:** single appropriate intro (connection + Amy coordinated); no phantom reply after silence.

CI parity ≠ step 3–5. Step 3 catches wizard→publish gaps; steps 4–5 catch executor/calendar/runtime gaps.
