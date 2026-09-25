# Voice AI Receptionist — Permanent Page Specification

**Route:** `/voice/receptionist`  
**Pass:** Read-only design / source inspection (no implementation)  
**Authority:** Existing Transovo UI + `appointment-receptionist` wizard state, save API, and V3 compile chain  
**Transitional UI (Pass 1):** `src/components/voice/voice-receptionist-hub.tsx` remains until Pass 2 approval

---

## 1. Executive Design Decision

The permanent Receptionist page is a **configuration editor** (not a wizard, dashboard, or technical agent builder). It answers: *Who is my receptionist, what is it responsible for, and how should it interact with callers?*

**Frame:** Reuse the **Call Handling operational editor** layout (`max-w-5xl`, `PageHeader`, section stack, sticky save/publish footer) rather than the Pass 1 hub width (`max-w-[1200px]`). Receptionist is dense configuration; Call Handling already proves the Voice product can edit wizard-owned fields outside the stepper without forking persistence.

**Navigation inside the page:** **Pattern C — compact vertical in-page section nav** (anchor links + `scroll-mt-*` on sections), modeled on `src/components/mctb/setup-view.tsx` section cards (`id`, `scroll-mt-24`, `Card`/`bordered` blocks). Do **not** add horizontal tabs or seven primary routes. Six conceptual sections fit one scrollable editor with sticky section nav on `lg+` only.

**Save/publish:** Identical chain to wizard — `POST /api/solutions/appointment-receptionist` with `action: save_draft | activate`, `wizardStepId` per `merge-wizard-state-on-save.ts`, `buildWizardAgentConfig` → `updateVoiceAgentDraft` → (on activate) publish path. No new persistence layer.

**Split wizard steps onto one page:** Extract **presentation** from existing step components (`GoalsStep`, `InformationStep`, `VoiceStep`, `AppointmentsStep`, `CallHandlingStep` subsets, `TestStep`) via thin section wrappers that pass `state` / `patch` and **omit** `SidePanel` on narrow layouts. Phone, full transfer editors, spam, recording, and activate checklist stay **linked**, not embedded.

**Prerequisite (Calls — Pass 2, not Receptionist):** Call **list** may show one primary outcome (`deriveCallListOutcomeDisplay`). **Call detail** must show **all** material deterministic results (e.g. appointment booked + transfer failed). Do not let list precedence leak into detail.

---

## 2. Existing Transovo Visual Primitives

| Primitive | Component / pattern | Source file | Existing page(s) | Actual classes / tokens | Receptionist use |
|-----------|---------------------|-------------|------------------|-------------------------|------------------|
| Content container (Voice config) | `div` wrapper | `call-handling-operational-page.tsx` | `/voice/call-handling` | `mx-auto max-w-5xl space-y-8 pb-24` | **Primary page container** |
| Content container (Voice ops) | `div` wrapper | `voice/calls/page.tsx`, Pass 1 hub | Calls, Receptionist hub | `mx-auto max-w-[1200px] px-4 py-6 sm:px-8` | **Do not use** for permanent editor |
| Page header | `PageHeader` | `src/components/ui/page-header.tsx` | Call Handling, Knowledge, Overview | `mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`; H1 `font-display text-2xl font-semibold tracking-tight`; description `mt-1 max-w-2xl text-sm text-muted-foreground`; actions `flex flex-wrap items-center gap-2` | Page title + status + Test + Publish |
| Primary button | `Button variant="primary"` | `src/components/ui/button.tsx` | Widespread | `size="sm"` in headers | Publish / Go live |
| Secondary button | `Button variant="outline"` | same | Call Handling links | `size="sm"` | Test receptionist (secondary to publish when draft exists) |
| Status badge | `StatusPill` | `appointment-receptionist/ui.tsx` | Wizard steps | `rounded-full px-2 py-0.5 text-[11px] font-medium` + tone classes | Live / Draft / Unpublished |
| Alt status (MCTB wizard) | `mctb-va-status-pill` | `mctb-voice-agent.css` | MCTB voice agent | `--active` / `--draft` / `--warn` borders & backgrounds | Optional if Voice shell aligns with MCTB pills; prefer `StatusPill` in shared Voice shell |
| Warning / banner | Inline alert | Call Handling | `/voice/call-handling` | `rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive` | Save/publish errors |
| Info banner | `InfoCallout` | `appointment-receptionist/ui.tsx` | Wizard | `rounded-xl border border-accent/20 bg-accent/5 px-3.5 py-3 text-xs` | Dependency hints (calendar, knowledge) |
| Bordered section | `Card` or bordered `div` | Call Handling, wizard | Call Handling `Card className="p-5"`; wizard `rounded-xl border border-border bg-card p-4` | `border-border`, `rounded-xl`, `bg-card` | One bordered block per major section (not per field) |
| Settings group | Stacked `space-y-*` inside bordered section | wizard steps | Voice / Appointments steps | `space-y-4` / `space-y-6` | Section interiors |
| Settings row | Flex row (wizard) | `RadioRow`, capability rows in `goals-step` | Goals, Responsibilities | `flex … rounded-xl border px-4 py-3` or hub `dl` rows `px-5 py-4` | **Standard row** (see §16) |
| Form label | `Label` | `src/components/ui/input.tsx` | All forms | `mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90` | All fields |
| Supporting description | `p` under label | wizard | — | `text-xs text-muted-foreground` / `mt-1 text-sm text-muted-foreground` | Row and field help |
| Select | `Select` or native `select` | `input.tsx` / wizard | Appointments, Information | `h-10 rounded-[10px] border border-border …` | Short enums |
| Toggle | Native checkbox | wizard editors | Appointments, call-handling | `type="checkbox"` + label (no shared `Switch` in `components/ui`) | Capabilities and booleans |
| Textarea | `Textarea` | `input.tsx` | Voice, Information | `min-h-24` default; wizard greetings use `min-h-[72px]`–`min-h-24` | Greeting, guardrails |
| Segmented control | Muted button group | `test-step.tsx` | Test step | `flex gap-1 rounded-lg bg-muted p-1` + selected `bg-card shadow-sm` | Optional sub-mode (e.g. test browser vs phone info) |
| Local navigation (routes) | `VoiceSubNav` | `voice-subnav.tsx` | Knowledge (if used) | Horizontal `border-b-2` tabs | **Not** for Receptionist sections (in-page anchors instead) |
| Sticky footer | Fixed bar | `call-handling-operational-page.tsx` | Call Handling | `fixed bottom-0 … border-t bg-background/95 backdrop-blur`; inner `max-w-5xl` | Save draft + Publish (dominant action by state) |
| Unsaved / draft | Text + pill | hub, wizard | Receptionist hub, Activate | “Draft — publish required…” | Header pill + footer copy |
| Empty state | Dashed border center | `test-step.tsx` | Test | `rounded-xl border border-dashed p-6 text-center` | First-use |
| Loading | Text / pulse | hub, Call Handling | Receptionist hub | `text-sm text-muted-foreground` | Skeleton: optional `animate-pulse` blocks matching section layout |
| Error state | Destructive text/border | hub, Call Handling | — | Same as warning banner | Retry via reload / dismiss |
| Responsive form | Grid | `voice-step.tsx` | Voice | `grid gap-6 lg:grid-cols-2`; fields `sm:grid-cols-2` | Identity pairs, voice grid |
| Section anchor | `Card id= scroll-mt-24` | `mctb/setup-view.tsx` | MCTB setup | `scroll-mt-24 space-y-4 p-5` | Each of six sections |

---

## 3. Existing Wizard Component Inventory

| Wizard step | Component | Source | Key props | State fields (owned step) | Wizard-only deps | Save `wizardStepId` | Outside wizard? |
|-------------|-----------|--------|-----------|---------------------------|------------------|---------------------|-----------------|
| Goals | `GoalsStep` | `steps/goals-step.tsx` | `state`, `patch`, `hireMode?`, `presentation?` | `capabilities`, `answerWhen`, `solutionName`, `preset`, `outcomeSlug` | `SelectableCard`, `SidePanel`, preset copy | `goals` | **Adapter** — drop `SidePanel`/`hireMode`; keep cards for operating mode |
| Phone | `PhoneStep` | `steps/phone-step.tsx` | `state`, `patch` | phone, ring, recording, connection greeting | Stepper, continue | `phone` | **Link only** on Receptionist (ingress summary) |
| Information | `InformationStep` | `steps/information-step.tsx` | `state`, `patch`, `presentation?` | identity, greeting, behaviors, guardrails, knowledge*, timezone, schedule | KB scan UI, `BusinessScheduleEditor` | `information` | **Adapter** — KB UI → link to `/voice/knowledge`; keep identity/greeting/behaviors |
| Appointments | `AppointmentsStep` | `steps/appointments-step.tsx` | `state`, `patch`, `presentation?` | calendar*, booking strategy, types, collectFields, qualification | OAuth connect flows, `SidePanel` | `appointments` | **Adapter** — calendar connect → Integrations link; keep strategy + intake |
| Call Handling | `CallHandlingStep` | `steps/call-handling-step.tsx` | `state`, `patch`, `presentation?` | transfers*, callbacks*, urgency*, maturity* | Full transfer/waterfall editors | `call-handling` | **Partial** — message/callback toggles only; link rest to `/voice/call-handling` |
| Voice | `VoiceStep` | `steps/voice-step.tsx` | `state`, `patch`, `presentation?` | `voiceId`, pace, interruption, accent, identity duplicate | TTS preview API, `SidePanel` | `voice` | **Reuse** identity+voice blocks; merge with Information fields carefully on save |
| Test | `TestStep` | `steps/test-step.tsx` | `state`, `patch`, `onEnsureAgent?`, `presentation?` | `testScenario`, `lastTestPassed` | `onEnsureAgent` → `persist(save_draft)` | `test` | **Reuse** in drawer/modal or anchored panel via `onEnsureAgent` from page shell |
| Activate | `ActivateStep` | `steps/activate-step.tsx` | `state`, `onActivate`, `onGoToTest` | `activationMode`, `scheduledAt` | Readiness rows, checklist | `activate` | **Publish UI only** — checklist in publish confirm, not full page |

**Shared UI:** `SelectableCard`, `RadioRow`, `InfoCallout`, `StatusPill`, `SidePanel` — `appointment-receptionist/ui.tsx`.

**Extracted editors (Call Handling page already uses):** `CallbackRequiredFieldsEditor`, `UrgencyRulesEditor` (stay on Call Handling), `EmergencyTransferEditor`, `operating-maturity-editor` (hours/on-call), `spam-unwanted-calls-editor`.

**Extraction risks:**

- **Voice vs Information:** Both touch `agentName`, `openingGreeting`, `conversationBehaviors`. `merge-wizard-state-on-save` assigns identity/greeting to **`information`**, voice persona to **`voice`**. Permanent section saves must use the correct `wizardStepId` per touched fields (see §24).
- **`capabilities` in both `goals` and `call-handling` STEP_OWNED_FIELDS:** Saving Responsibilities must use `wizardStepId: "goals"` (not call-handling) unless only call-handling-owned capability side-effects are changed.
- **Test:** Requires `save_draft` before browser session — page must expose same `ensureAgentForTest` behavior.

---

## 4. Page Frame Specification

| Element | Existing token/class | Source reference | Receptionist use |
|---------|-------------------|------------------|------------------|
| Max content width | `max-w-5xl` (64rem / 1024px) | `call-handling-operational-page.tsx` | Page root |
| Desktop horizontal padding | Inherited from app shell; section internals `p-4`–`p-5` | Call Handling `Card p-5`, wizard `p-4` | Shell: default app layout; sections `p-5` |
| Mobile horizontal padding | App shell `px-4`; wizard cards `p-4` | Calls `px-4 sm:px-8` | Match shell `px-4 sm:px-8` on outer wrapper if shell does not pad |
| Top page spacing | `PageHeader` `mb-6` | `page-header.tsx` | Below header before nav |
| Bottom page spacing | `pb-24` | Call Handling | Clear sticky footer |
| Header-to-content gap | `mb-6` (header) + section nav `mb-5` | `VoiceSubNav` `mb-5` | ~`mb-5` after optional status banner |
| Major section gap | `space-y-8` | Call Handling root | Between sections |
| Internal section padding | `p-5` (Card) or `p-4` (wizard card) | Call Handling / wizard | `p-5` for section shell |
| Row vertical padding | `py-3` (RadioRow) / `py-4` (hub dl) | `ui.tsx` / hub | `py-4` standard row |
| Row horizontal padding | `px-4` (RadioRow) / `px-5` (hub) | same | `px-5` in bordered section |
| Control column (desktop) | Right column `shrink-0` switches; max `max-w-md` inputs | appointments-step | See §18–19 |
| Two-column gap | `gap-6` (`lg:grid-cols-2`) | `voice-step.tsx` | Identity & voice grid only |

**Outer wrapper (recommended):**

```text
div.mx-auto.max-w-5xl.space-y-8.pb-24.px-4.sm:px-8 (if needed)
```

Align with Call Handling, not Pass 1 `max-w-[1200px]`.

---

## 5. Header Specification

### Desktop

| Region | Content | Component |
|--------|---------|-----------|
| Left | **H1:** `Receptionist` | `PageHeader` title |
| Left | **Description:** One line, operational — e.g. configure how your AI receptionist speaks, collects information, and helps callers (match `text-sm text-muted-foreground`, max-w-2xl; inspect Call Handling tone) | `PageHeader` description |
| Right | **Status:** Live · Draft · Unpublished changes · Never activated | `StatusPill` or text + icon (not color-only) |
| Right | **Test receptionist** | `Button variant="outline" size="sm"` → opens test panel / scroll to `#test` |
| Right | **Primary:** Publish changes / Go live / hidden when live+no diff | `Button variant="primary" size="sm"` |

**Max three right-side affordances:** status pill (or combined with label), Test, one primary publish.

### Mobile

Same stack as `PageHeader`: title block full width, actions `flex-wrap gap-2` below. Primary publish remains visible without horizontal scroll.

---

## 6. Draft/Publish State Specification

Trace `GET /api/solutions/appointment-receptionist` → `data.status` (`ACTIVE` | `DRAFT` | …) and `data.state`; compare draft config to published via agent record when Pass 2 implements dirty detection (optional: shallow JSON compare of `buildWizardAgentConfig(state)` vs published).

| Customer state | Header status | Banner | Primary action | Footer |
|----------------|---------------|--------|----------------|--------|
| Never activated (no `agentId`) | Draft / Setup required | `InfoCallout` → Start setup or inline first-use | **Go live** disabled until required fields | Save draft creates agent (`create_draft`) |
| Active, no unpublished draft | **Live** (`StatusPill` success) | None | None (Test only) | Save draft still allowed; copy: “Changes save to draft until you publish.” |
| Active, unpublished draft | **Unpublished changes** (warning) | Optional: “Live callers still use published config until you publish.” | **Publish changes** | Save draft |
| Draft only (never published) | Draft | “Not live yet” | **Go live** (`activate`) | Save draft |
| Publishing | Live/Draft + spinner | — | Disabled “Publishing…” | Disabled |
| Publish failed | Error banner | `border-destructive/40` + checklist issues from API | **Retry publish** | Preserve local state |

**Semantics (locked):** `save_draft` on `ACTIVE` agent uses `preserveActiveOnDraftSave` — live runtime stays on published until `activate`. UI must **never** imply draft save alone changed live behavior.

**Reuse:** Call Handling sticky footer pattern for Save; add **Publish** as primary when `unpublished` detected. MCTB `mctb-va-status-pill` optional visual parity.

---

## 7. Local Navigation Decision

**Chosen: C — compact vertical in-page navigation** (anchor list), `lg:sticky lg:top-4 lg:w-48 shrink-0`, hidden below `lg` replaced by **horizontal chip strip** (`flex flex-wrap gap-1`) under banner.

**Why not tabs:** Six sections, single save domain, Call Handling precedent (single page). **Why not horizontal only:** Section titles are long; vertical nav matches MCTB setup mental model without route churn.

**Sections (anchors):**

1. `#identity-voice`
2. `#greeting-conversation`
3. `#responsibilities`
4. `#caller-information`
5. `#appointment-handling`
6. `#messages-callbacks`

`#test` is page-level (header action), not seventh nav item.

Each section: `id` + `scroll-mt-24` (account for sticky app header).

---

## 8. Identity & Voice Specification

**Container:** One `section` → bordered `div.rounded-xl.border.border-border.bg-card.p-5` (not one card per field).

**Hierarchy:**

1. **Section title** — `h2.text-sm.font-semibold` (match Call Handling section titles)
2. **Subgroups** (stack `space-y-6`):
   - **Identity** — reuse `VoiceStep` grid `lg:grid-cols-2`: Agent name, Role/business display name, Language (if shown), Timezone (`state.timezone` from information ownership — field lives information step but displays here; save with `information` if only timezone changes)
   - **Voice** — voice cards grid from `VoiceStep` (`SelectableCard` + preview button); speaking pace, accent, interruption, backchannel, pause patience — controls as in `voice-step.tsx`
   - **Preview** — adjacent to selected voice row; `POST /api/voice/tts-preview`; hidden `<audio>` element

**Row layout:** Labels above controls (`Label` + `Input`). Voice selection: 2-column grid on `lg+`, single column mobile.

**Mobile:** Voice cards full width; preview button below selection.

**Save:** `wizardStepId: "voice"` for voice-owned fields; `wizardStepId: "information"` for `agentName`, `role`, `tone`, `speakingStyle`, `language`, `timezone` when edited in this section.

---

## 9. Greeting & Conversation Specification

**Fields (from `information` / `voice` steps):**

- Opening greeting — `Textarea`, `max 500` chars, character count + preview line (from `VoiceStep`)
- `speaksFirst` if exposed
- **Conversation behaviors** — checkboxes: `keepBrief`, `oneQuestionAtATime`, `confirmDetails`, `neverInventPricing`, `neverInventAvailability` (`conversationBehaviors` object)
- **Guardrails** — textarea or structured list from Information step (no raw system prompt)
- **Advanced conversation behavior** (disclosure): `interruptionStyle`, `callerPausePatience`, `backchannelLevel` if not placed in Identity & Voice

**Always visible:** Greeting, one-question-at-a-time, confirm details, pricing/availability guardrails.

**Behind disclosure:** `<details>` or “Advanced conversation behavior” button expanding interruption/patience controls (reuse copy from `VoiceStep`).

**Textarea:** Default `min-h-24`; greeting can use `rows={4}` equivalent.

**Save:** `wizardStepId: "information"`.

---

## 10. Responsibilities Specification

Reuse **GoalsStep** capability model: `SelectableCard` or compact rows (prefer **compact rows** for permanent page — see §16).

| Capability | Editable here? | Control | Elsewhere |
|------------|----------------|---------|-----------|
| Answer business questions | Toggle | `capabilities` includes `answer_questions` | Knowledge → `/voice/knowledge` |
| Take messages | Toggle | `take_messages` | Message behavior §13 |
| Schedule appointments | Toggle | `book_appointments` | §12 + Integrations |
| Reschedule / Cancel | Toggle | `reschedule`, `cancel` | §12 |
| Qualify callers | Toggle | `qualify_callers` | §11 |
| Transfer calls | Toggle + status | `transfer_calls` | **Manage →** `/voice/call-handling` |
| Send SMS confirmations | Toggle | `send_sms_confirmations` | Appointments behavior |

**Operating mode** (`answerWhen`): `RadioRow` list from GoalsStep (main / overflow / after-hours) — single choice.

**Row anatomy:**

```text
[Title text-sm font-medium]
[Description text-xs text-muted-foreground max-w-prose]
                    [StatusPill | checkbox]  [Link Manage →]
```

**Dependency:** Transfer enabled but no destination → `StatusPill` warning + link Call Handling. Booking enabled but calendar disconnected → warning + Integrations link.

**Save:** `wizardStepId: "goals"`.

---

## 11. Caller Information Specification

Reuse **AppointmentsStep** collect-fields list (`state.collectFields`): rows with label, enabled, required, qualification flags; add custom field actions.

| Interaction | Behavior |
|-------------|----------|
| Row structure | Border-b `divide-y` inside section; each row `flex flex-col sm:flex-row sm:items-center gap-2 py-3` |
| Required | Checkbox “Required” |
| Reorder | Up/down buttons per row if wizard supports order (appointments-step uses array order — **no drag-only**) |
| Add field | Primary outline button “Add question” |
| Edit | Inline label `Input` |
| Delete | Icon button with confirm for custom fields |
| Qualification | `qualificationRules`, ZIP lists — subsection when `qualify_callers` on; reuse appointments-step editors |

**Save:** `wizardStepId: "appointments"`.

---

## 12. Appointment Handling Specification

Reuse **AppointmentsStep** core without full calendar OAuth UI.

| Topic | Receptionist owns | Link only |
|-------|-------------------|-----------|
| Booking strategy | `BOOK` (`MICROSOFT_365`), `REQUEST_ONLY`, `SEND_LINK` — `RadioRow` / cards | Calendly redirect already normalized to MS in MCTB |
| Appointment types | Summary + “Manage in Appointments” when Transovo calendar | `/appointments/types` |
| Booking behavior | `bookingBehavior.*` checkboxes | — |
| Calendar connection | Status row: “Microsoft Calendar connected” / “Connect calendar →” | `/integrations` or calendar API OAuth entry used in step |
| Calendly / provider pick | Status only | Integrations |

**Separation copy:** “Amy uses your connected calendar” vs “Configure services in Appointments.”

**Save:** `wizardStepId: "appointments"`.

---

## 13. Messages & Callbacks Specification

**Receptionist owns (conversational):**

- Message-taking enabled (capability + call-handling checkboxes that are conversational, not SLA)
- Callback requests enabled — `callbackRequestsEnabled`
- Callback field policy — `CallbackRequiredFieldsEditor` (subset from call-handling step)
- `callbackUseAniByDefault`, `callbackAskPreferredTime`, `callbackConfirmNumber`

**Call Handling owns (operational):**

- After-hours notification recipients, urgency rules, on-call, transfer waterfall, spam — link only

**Reconciliation:** Show callback **permission and what Amy asks** here; show **who gets notified and when** on Call Handling only.

**Save:** `wizardStepId: "call-handling"` for callback* fields; do not save transfer destinations from this section.

---

## 14. Cross-Domain Dependency Treatment

| Dependency | When shown | Treatment |
|------------|------------|-----------|
| Business Knowledge | `answer_questions` on | Row: “Business Knowledge” — status from KB API / `knowledgeBaseEnabled` — **Manage →** `/voice/knowledge` |
| Calendar | Booking capabilities | §12 status row |
| Call transfers | `transfer_calls` | Effective status from `transferWizardValidationIssues` / destinations — **Manage →** `/voice/call-handling` |
| Phone / ingress | Test / Go live | One row: assigned number or **Set up in Call Handling** → ingress panel |
| Business hours | After-hours mode | Summary from `ensureWizardOperatingMaturity` — **Business Knowledge** or Call Handling hours editor link |
| After-hours behavior | Overflow / after-hours | Link Call Handling — no duplicate editors |

No dashboard grid — max **one summary row per dependency**, only when a enabled capability needs it.

---

## 15. Test Receptionist Treatment

| Item | Specification |
|------|----------------|
| Placement | **Header** secondary: “Test receptionist”; optional anchor `#test` section with embedded `TestStep` UI |
| Workflow | Reuse `TestStep` + `VoiceV3BrowserCall` |
| Prepare | `onEnsureAgent` → `POST save_draft` (same as `wizard.ensureAgentForTest`) |
| **Draft vs live** | **Browser test uses draft config** — API comment `wizard-browser-live-test` / `v3-wizard-live-test`: “draft Voice V3 config”; Test step copy: “current saved **draft** configuration” |
| Unpublished changes | User must save draft before test; show inline error from `prepareLiveTest` |
| Phone mode tab | “After activate (phone)” — informational; PSTN uses published routing (no change in Pass 2 spec) |
| Latest test | `lastTestPassed` / probe source display as in Test step |

---

## 16. Standard Settings Row

| Property | Value / token |
|----------|----------------|
| Min height | Implicit ~56px (`py-4` + one line title) |
| Vertical padding | `py-4` |
| Horizontal padding | `px-5` (section inner) |
| Title typography | `text-sm font-medium text-foreground` |
| Description typography | `text-xs text-muted-foreground` max-w-prose (`max-w-xl` for long copy) |
| Right control width | `shrink-0`; checkbox or `StatusPill`; link `text-sm text-primary underline` |
| Separator | `divide-y divide-border` on list |
| Alignment | `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between` |
| Disabled | `opacity-60 cursor-not-allowed` on controls |
| Dependency warning | `StatusPill tone="warning"` + text reason |
| Mobile stack | Title + description full width; controls right-aligned or below left-aligned |

---

## 17. Standard Section

| Part | Spec |
|------|------|
| Section title | `h2.text-sm.font-semibold` + optional `p.mt-1.text-xs.text-muted-foreground` |
| Section action | Optional `Button variant="ghost" size="sm"` right of title row |
| Content container | `rounded-xl border border-border bg-card p-5 space-y-4` |
| Separators | `divide-y` between rows; avoid nested Cards |
| Padding | `p-5` |
| Gap to next section | Parent `space-y-8` |

---

## 18. Grid/Column Rules

| Use case | Classes | Breakpoint | Stack order |
|----------|---------|------------|-------------|
| Identity pair | `grid gap-3 sm:grid-cols-2` | `sm` 640px | Left column first |
| Voice + identity major | `grid gap-6 lg:grid-cols-2` | `lg` 1024px | Identity left, voice right |
| Behavior checkboxes | Single column `space-y-2` | always | — |

No spurious two-column layouts for long textareas.

---

## 19. Control Width Rules

| Control | Width class | Source |
|---------|-------------|--------|
| Short text | `max-w-md` or full in column | appointments-step |
| Select / timezone | `max-w-md` or `w-full sm:max-w-xs` | wizard |
| Voice selector | Full cell in grid | voice-step |
| Textarea | `w-full`, `max-w-2xl` optional cap on ultra-wide | — |
| Checkbox toggles | `h-4 w-4` native | wizard |
| Header buttons | `size="sm"` auto width | PageHeader |

---

## 20. Responsive Contract

| Breakpoint | Behavior |
|------------|----------|
| Wide desktop | Vertical section nav sticky; 2-col voice grid |
| Laptop | Same; `max-w-5xl` centered |
| Tablet | Section nav → horizontal chips; rows stack |
| Mobile | Single column; touch targets ≥44px via `py-3`/`h-10` inputs; no horizontal page scroll |
| 200% zoom | Same order; nav wraps; footer sticky remains usable |

---

## 21. Six UI States

| State | Treatment |
|-------|-----------|
| **Normal** | All sections hydrated from GET setup |
| **First-use** | No `agentId`: empty sections with `InfoCallout` + CTA to create draft; no fake defaults shown as saved |
| **Loading** | Skeleton blocks per section OR single “Loading receptionist…” until hydrated |
| **Error** | Banner + retry; do not clear local edits on save failure |
| **Partial/degraded** | Section-level warnings (calendar, transfers, KB); rest editable |
| **Success** | Toast or inline: “Draft saved at {time}” vs “Published — live for callers” (different copy) |

---

## 22. Accessibility Contract

- One **H1** (“Receptionist”) in `PageHeader`
- Section **h2**; subgroups **h3**
- Every input has visible `Label`; errors tied via `aria-describedby` where used
- Keyboard: nav links skip to sections; focus order top-to-bottom
- Status: text + pill tone (not color-only)
- Save/publish: `aria-live="polite"` region for confirmations
- Disclosure: native `<details>` or button `aria-expanded`
- Reorder: up/down buttons with accessible names
- Touch targets: use existing `h-10` inputs and `py-3` rows

---

## 23. Component Reuse Matrix

| Future section | Existing component | Current source | Reuse unchanged? | Adapter? | Visual change? | Runtime/save risk |
|----------------|-------------------|----------------|------------------|----------|----------------|-------------------|
| Identity & Voice | `VoiceStep` (blocks) | `voice-step.tsx` | No | Strip SidePanel; split save ids | Minor grouping | Medium — dual step ownership |
| Greeting & Conversation | `VoiceStep` + Information fields | `voice-step`, `information-step` | No | Merge UI; save `information` | None | Low if step id correct |
| Responsibilities | `GoalsStep` | `goals-step.tsx` | Partial | Compact rows vs cards | Density | Low — `goals` |
| Caller Information | Appointments collect UI | `appointments-step.tsx` | Partial | Extract list fragment | None | Low — `appointments` |
| Appointment Handling | `AppointmentsStep` | `appointments-step.tsx` | No | Hide OAuth cards | Summary rows | Medium — calendar hooks |
| Messages & Callbacks | `CallHandlingStep` subset + `CallbackRequiredFieldsEditor` | `call-handling-step.tsx`, `callback-required-fields-editor.tsx` | Partial | Split from transfer UI | None | Medium — `call-handling` |
| Test | `TestStep` | `test-step.tsx` | Yes | Wire `onEnsureAgent` to page persist | None | Low |
| Publish checklist | `ActivateStep` rows | `activate-step.tsx` | Partial | Modal only | None | Low — `activate` |
| Page shell | `CallHandlingOperationalPage` patterns | `call-handling-operational-page.tsx` | N/A | New `VoiceReceptionistEditorPage` | Frame only | Low |
| Status / pills | `StatusPill` | `ui.tsx` | Yes | — | None | None |
| Header | `PageHeader` | `page-header.tsx` | Yes | — | None | None |

---

## 24. Save/Publish Dependency Matrix

| Control / group | State fields | Save helper / API | wizardStepId | Draft behavior | Compile consumer | Runtime consequence | Permanent-page adapter |
|-----------------|-------------|-------------------|--------------|------------------|------------------|---------------------|------------------------|
| Capabilities / answerWhen | `capabilities`, `answerWhen`, `preset`, `solutionName` | `POST` + `mergeWizardStateForSave` | `goals` | Merges non-owned from server | `compileVoiceV3AgentConfig` | Tool gating, prompts | Section save + full in-memory state |
| Agent identity | `agentName`, `role`, `tone`, `speakingStyle`, `language` | same | `information` | preserve active on draft | compile + brain sync | Persona | Identity section |
| Greeting / behaviors / guardrails | `openingGreeting`, `conversationBehaviors`, `guardrails`, `speaksFirst` | same | `information` | same | compile | Greeting + policies | Greeting section |
| Voice persona | `voiceId`, `speakingPace`, `interruptionStyle`, … | same | `voice` | same | compile → GPT-Live voice | Audio | Identity & Voice |
| Collect fields / qualification | `collectFields`, `qualification*` | same | `appointments` | same | intake objective / tools | Intake | Caller Information |
| Booking strategy / types / behavior | `bookingStrategy`, `appointmentTypes`, `bookingBehavior` | same | `appointments` | same | booking tools | BOOK / LINK / REQUEST | Appointment Handling |
| Callbacks / message flags | `callback*`, message toggles on call-handling | same | `call-handling` | same | call handling compile | Callback creation | Messages section |
| Transfer / spam / hours | transfer*, urgency*, maturity* | same | `call-handling` | **Not edited on Receptionist** | compile | Transfers | Link only |
| Phone / ingress | `phoneNumberId`, ring* | same | `phone` | Link only | telephony | Ingress | Summary row |
| Test metadata | `testScenario`, `lastTestPassed` | same | `test` | same | none | none | Test panel |
| Publish | `activationMode` | `action: activate` | `activate` (full state, no merge) | Publishes draft | publish + hooks | Live callers | Header/footer primary |
| Draft save (global) | entire `state` | `action: save_draft` | per-section id | `preserveActiveOnDraftSave` | `updateVoiceAgentDraft` | Draft config for test | Footer Save |
| Company Brain | derived from wizard | `syncCompanyBrainFromWizard` on POST | n/a | runs on save | RAG / facts | KB answers | Automatic on any save |

**Page shell persist (Pass 2):** Mirror `AppointmentReceptionistWizard.persist()` and `CallHandlingOperationalPage.save()` — always send full wizard `state` in JSON body with the correct `wizardStepId` for the section being saved.

---

## 25. Exact Text Wireframe

```text
PAGE CONTAINER (max-w-5xl space-y-8 pb-24)
│
├─ PAGE HEADER (PageHeader)
│  ├─ Left: H1 Receptionist + description (text-sm muted)
│  └─ Right: StatusPill (Live | Draft | Unpublished) · Button outline Test · Button primary Publish/Go live
│
├─ [optional] InfoCallout / error banner (draft vs live messaging)
│
├─ LAYOUT (flex flex-col lg:flex-row gap-8)
│  ├─ LOCAL NAV (lg: sticky w-48)
│  │     anchor links ×6
│  └─ MAIN (flex-1 min-w-0 space-y-8)
│       │
│       ├─ #identity-voice (section card p-5 scroll-mt-24)
│       │    ├─ h2 Identity & voice
│       │    ├─ grid lg:2col — Label+Input agentName, role
│       │    ├─ VoiceStep SelectableCard grid + preview (Button outline Play)
│       │    └─ selects: pace, accent, interruption (VoiceStep)
│       │
│       ├─ #greeting-conversation
│       │    ├─ Textarea openingGreeting + counter
│       │    ├─ checkboxes conversationBehaviors
│       │    └─ details Advanced → interruption/patience
│       │
│       ├─ #responsibilities
│       │    ├─ RadioRow answerWhen (3)
│       │    └─ divide-y capability rows + Manage links
│       │
│       ├─ #caller-information
│       │    ├─ collectFields rows (appointments-step pattern)
│       │    └─ qualification subsection (conditional)
│       │
│       ├─ #appointment-handling
│       │    ├─ dependency row Calendar status → Integrations
│       │    ├─ RadioRow bookingStrategy
│       │    └─ bookingBehavior checkboxes
│       │
│       ├─ #messages-callbacks
│       │    ├─ callback toggles (CallHandlingStep subset)
│       │    └─ CallbackRequiredFieldsEditor
│       │
│       └─ #test (optional inline)
│            └─ TestStep (VoiceV3BrowserCall)
│
└─ STICKY FOOTER (fixed bottom, max-w-5xl inner)
     ├─ text-xs muted (draft vs live copy)
     └─ Button Save draft · Button primary Publish (state-dependent)
```

---

## 26. Density Review

| Metric | Estimate |
|--------|----------|
| Always-visible controls | ~35–45 (capabilities, behaviors, booking strategy, core identity) |
| Behind disclosure | ~8–12 (advanced conversation, qualification detail) |
| Approx. page length | ~4–6 viewport heights desktop |
| Sections per desktop viewport | ~1–1.5 with nav |
| Mobile burden | Single scroll; chip nav; footer always visible |

Mitigation: vertical nav + disclosure (not new routes).

---

## 27. Visual Failure Checklist

| Failure | Spec avoids? |
|---------|----------------|
| Giant hero header | Yes — `PageHeader` only |
| Card soup | Yes — six section cards max |
| Card-in-card | Yes — rows use divide-y, not nested Cards |
| Excessive whitespace | Yes — `space-y-8` / `p-5` |
| Huge typography | Yes — `text-2xl` H1 only |
| One feature per giant card | Yes — compact rows |
| Random grids | Only `lg:grid-cols-2` where wizard already does |
| Inconsistent buttons | Primary publish header/footer; save footer |
| Duplicate primary actions | One publish dominant |
| Excessive badges | Status + dependency warnings only |
| Hidden labels | Label component required |
| Raw backend terms | User-facing capability labels from GoalsStep |
| Wizard stepper on page | No stepper |
| Settings dump | Six anchored sections + nav |

---

## 28. Implementation Risks

1. **Dual `wizardStepId` per section** (Identity & Voice, Greeting) — wrong id overwrites or fails to merge fields.
2. **`capabilities` on both goals and call-handling** — must save responsibilities with `goals`.
3. **VoiceStep vs InformationStep duplication** — UI merge must not duplicate state keys in conflicting ways.
4. **Dirty / unpublished detection** — may need comparing draft JSON to published version (not in Pass 1 hub).
5. **Calendar auto-patch on load** — AppointmentsStep `useEffect` patches connection; permanent page must hydrate once without flicker.
6. **Test without prior save** — must call `save_draft` before WebRTC (regression risk).
7. **Activate checklist** — blocking issues from `hasBlockingActivationIssues` must surface on publish, not silent fail.
8. **MCTB wizard route coexistence** — `/mctb/voice-agent` remains; Receptionist is Voice product canonical editor per IA (do not delete wizard until migration complete).
9. **Call detail outcomes** — separate Pass 2 item; list precedence must not drive detail UI.

---

## 29. Exact Implementation Boundary for Pass 2

**In scope**

- Replace `VoiceReceptionistHub` with editor per this spec
- Section wrappers + adapters around existing step components
- Shared page state + `persist()` mirroring wizard/API
- Sticky footer + header publish/test
- In-page nav anchors
- Keep transitional wizard route working

**Out of scope**

- Changes to `compileVoiceV3AgentConfig`, GPT-Live runtime, FunctionTools, Prisma schema
- Moving transfer/spam/recording/hours editors onto Receptionist
- New publish endpoints
- Extracting phone step to Receptionist (summary link only)
- Call detail multi-outcome (implement on `/voice/calls/[id]` per Calls Pass 2)

**Allowed files (indicative):** `src/app/(app)/voice/receptionist/page.tsx`, new `src/components/voice/voice-receptionist-editor*.tsx`, minimal props on step components only if required for adapter (prefer wrapper-only).

---

## Implementation guardrails (approved before Pass 2)

1. **No masked full-step mounts** — Do not render entire wizard steps with hidden OAuth/hydration/auto-patch effects. Extract presentation fragments (`VoiceStep` `parts`, `GoalsStep` compact, dedicated editors).
2. **Business hours / timezone** — Read-only dependency on Receptionist; canonical edit → `/voice/knowledge`. Do not edit `state.timezone` on Receptionist.
3. **Section-aware Save draft** — Dirty groups per ownership; sequential `wizardStepId` saves; never one arbitrary step id for all fields.
4. **Publish status** — Transition-based UI (`Live`, `Unsaved changes`, `Draft saved — publish…`); no invented full-config JSON diff unless a reliable published snapshot API exists.

---

RECEPTIONIST PAGE SPEC COMPLETE — READY FOR IMPLEMENTATION REVIEW
