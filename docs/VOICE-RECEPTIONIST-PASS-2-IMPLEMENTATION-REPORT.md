# Voice Receptionist — Pass 2 Implementation Report

## A. Files changed

| File | Why |
|------|-----|
| `src/app/(app)/voice/receptionist/page.tsx` | Wire permanent editor |
| `src/components/voice/receptionist/voice-receptionist-editor.tsx` | Main page shell, dirty tracking, save/publish/test |
| `src/components/voice/receptionist/receptionist-collect-fields-editor.tsx` | Caller fields without AppointmentsStep effects |
| `src/components/voice/receptionist/receptionist-booking-handling-section.tsx` | Booking strategy/behavior + calendar summary (no OAuth mount) |
| `src/lib/solutions/appointment-receptionist/receptionist-editor-ownership.ts` | Dirty groups + wizard step mapping |
| `src/lib/solutions/appointment-receptionist/receptionist-editor-persist.ts` | Sequential multi-group `save_draft` |
| `src/lib/solutions/appointment-receptionist/receptionist-editor-ownership.test.ts` | Merge/ownership tests |
| `src/components/solutions/appointment-receptionist/steps/voice-step.tsx` | `parts` + `showSidePanel` for safe subset render |
| `src/components/solutions/appointment-receptionist/steps/goals-step.tsx` | `compactCapabilities` / `hideSidePanel` for Responsibilities |
| `src/lib/voice/calls/outcome-display.ts` | `deriveCallDetailMaterialOutcomes` |
| `src/lib/voice/calls/outcome-display.test.ts` | Detail multi-outcome test |
| `src/app/(app)/voice/calls/[id]/page.tsx` | Show all material outcomes on detail |
| `docs/VOICE-RECEPTIONIST-PAGE-SPECIFICATION.md` | Implementation guardrails addendum |
| `docs/VOICE-RECEPTIONIST-PASS-2-IMPLEMENTATION-REPORT.md` | This report |

**Unchanged:** `compileVoiceV3AgentConfig`, runtime workers, Prisma schema, publish API semantics.

## B. Component reuse

| Area | Approach |
|------|----------|
| Identity / greeting / voice | `VoiceStep` with `parts` + `showSidePanel={false}` |
| Responsibilities | `GoalsStep` compact rows + dependency links |
| Caller information | New `ReceptionistCollectFieldsEditor` (from appointments UI, no effects) |
| Appointment handling | New `ReceptionistBookingHandlingSection` (calendar status from parent fetch only) |
| Messages/callbacks | `CallbackRequiredFieldsEditor` + checkbox (from call-handling copy) |
| Test | `TestStep` + `onEnsureAgent` → section-aware save |
| Publish | `persistReceptionistActivate` → existing `action: activate` |

## C. Page visual implementation

| Element | Classes |
|---------|---------|
| Outer width | `mx-auto max-w-5xl space-y-8 pb-24 px-4 sm:px-8` |
| Header | `PageHeader` (`mb-6`, H1 `text-2xl`) |
| Sections | `rounded-xl border border-border bg-card p-5 scroll-mt-24` |
| Section gap | `space-y-8` |
| Rows | `divide-y divide-border`, dependency rows `py-4` |
| Sticky footer | `fixed bottom-0 … max-w-5xl` (Call Handling pattern) |
| Nav | `lg:sticky lg:w-48`; mobile chip links |

## D. State ownership

| UI section | Fields (summary) | wizardStepId | API | Compiler |
|------------|------------------|--------------|-----|----------|
| Responsibilities | `capabilities`, `answerWhen`, … | `goals` | POST save_draft | `compileVoiceV3AgentConfig` |
| Identity & greeting | `agentName`, `openingGreeting`, `conversationBehaviors`, … | `information` | same | same |
| Voice | `voiceId`, `speakingPace`, … | `voice` | same | same |
| Caller + booking | `collectFields`, `bookingStrategy`, `bookingBehavior`, … | `appointments` | same | same |
| Messages/callbacks | `callback*`, … | `call-handling` | same | same |
| Publish | full state | `activate` (no step merge) | same | publish path |

## E. Dirty-state implementation

- Baseline snapshot after load and after successful multi-group save.
- `computeDirtyGroups(current, baseline)` compares JSON slices per `merge-wizard-state-on-save` ownership.
- **Save draft:** sequential `persistReceptionistDraftGroups` in order `goals → information → voice → appointments → callHandling`; each request sends **full** in-memory state with that group’s `wizardStepId`.
- Failed group stops the chain; successful groups clear via baseline refresh only on full success.
- **Choice:** sequential (not parallel) so each server merge remains authoritative for the next request.

## F. Draft/published status

Derived from **transitions**, not config JSON diff:

| UI label | Condition |
|----------|-----------|
| Setup required | No `agentId` |
| Unsaved changes | `dirtyGroups.size > 0` |
| Live | `agentStatus === ACTIVE` && !dirty && !pendingPublication |
| Draft saved — publish… | `ACTIVE` && `pendingPublication` after successful `save_draft` in session |
| Draft | Not ACTIVE |

`GET` returns `status` (`ACTIVE`/`DRAFT`). `pendingPublication` is session-local after save on live agent (matches `preserveActiveOnDraftSave` semantics).

## G. Test path

Local edits → **Save draft** (all dirty groups) → `ensureAgentForTest` → `TestStep` → `VoiceV3BrowserCall` → `/api/voice/agents/[id]/v3-wizard-live-test` (draft config).

## H. Publish path

Footer/header **Go live** / **Publish changes** → optional save of dirty groups → `persistReceptionistActivate` → `POST` `action: activate` (existing route, checklist, publish hooks).

## I. Cross-domain links

| Summary | Destination |
|---------|-------------|
| Business hours / knowledge | `/voice/knowledge` |
| Call transfers / notifications | `/voice/call-handling` |
| Calendar | `/integrations` |

## J. Runtime protection

**Compiler/runtime/provider files changed:** NONE

## K. Tests

```bash
npx vitest run src/lib/solutions/appointment-receptionist/receptionist-editor-ownership.test.ts src/lib/voice/calls/outcome-display.test.ts
```

**Result:** 10/10 passed.

## L. Deferred

- Business Knowledge canonical schedule/timezone editor
- Company Brain consolidation, gap reindex, RAG changes
- Owner browser/PSTN certification
- Analytics / Overview Voice passes
- Optional removal of transitional `VoiceReceptionistHub` (unused)

## Call detail (Pass 2 add-on)

List still uses single primary outcome; detail uses `deriveCallDetailMaterialOutcomes` so booked + transfer failed both appear.

---

RECEPTIONIST PASS 2 IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED
