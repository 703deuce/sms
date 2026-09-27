# Voice agent — 8-step wizard Opus component map

**Edit route:** `/voice/receptionist/edit` (when `isNewUiStage2Enabled()`)  
**Shell:** `AppointmentReceptionistWizardOpusPage` → `AppointmentReceptionistWizard` with `presentation="opus"`  
**Re-export hub (for traceability):** `src/components/solutions/appointment-receptionist/wizard-opus-ui.tsx`

All Opus visual language comes from **`src/newui-transplant/`** (kit + ui primitives). Wizard-specific wrappers that only delegate to those primitives:

| Wrapper | Opus source |
|--------|-------------|
| `WizardSection` | `@/newui-transplant/components/app/kit` → `Panel` |
| `SelectableCard` (`variant="opus"`) | `@/newui-transplant/components/ui/button` (outline) + Opus card layout |
| `RadioRow` (`variant="opus"`) | Transplant `Button` (outline) + radio affordance |
| `WizardSelectField` (`presentation="opus"`) | `@/newui-transplant/components/ui/select` |
| `StatusPill` / `InfoCallout` (`variant="opus"`) | kit `Pill` / `Panel` |
| `SidePanel` (`variant="opus"`) | `@/newui-transplant/components/app/kit` → `Panel` (sticky aside) |

---

## Global chrome (all steps)

| UI block | Opus / transplant source |
|----------|---------------------------|
| Page shell | `Page`, `PageHeader` — `@/newui-transplant/components/app/kit` |
| Back link | `ButtonLink` — `@/newui-transplant/components/app/button-link` |
| Step indicator (01–08, underline tabs) | `WizardStepper` opus branch — transplant `Button` `variant="link"` |
| Footer Back / Save draft / Continue | `Button` — `@/newui-transplant/components/ui/button` |
| Fixed footer bar | Opus layout in `wizard.tsx` (border-t, backdrop-blur; uses transplant button) |

---

## Step 1 — Goals (`goals-step.tsx`)

| UI block | Opus source |
|----------|-------------|
| Agent name field | `Panel`, `Label`, `Input` — kit + `@/newui-transplant/components/ui/label`, `input` |
| Capability toggles (grid) | `Switch` — `@/newui-transplant/components/ui/switch` |
| Capability cards (non-compact) | `SelectableCard` `variant="opus"` |
| When should this agent answer? | `Panel` + `RadioRow` `variant="opus"` |
| Recommended setup aside | `SidePanel` `variant="opus"` → kit `Panel` |

---

## Step 2 — Phone (`phone-step.tsx`)

| UI block | Opus source |
|----------|-------------|
| Page title + readiness strip | kit `Panel` |
| Number source cards | `SelectableCard` `variant="opus"` |
| Open My Numbers | `ButtonLink` — `button-link` |
| Answering behavior | `WizardSection` → `Panel` + `RadioRow` `variant="opus"` |
| Ring team / call recording | `WizardSection` → `Panel` |
| Connection greeting options | `WizardSection` → `Panel` + `RadioRow` `variant="opus"` |
| Greeting TTS preview | transplant `Button` `size="icon-lg"` |
| Greeting URL / text | `Label`, `Input`, `Textarea` — transplant ui |
| Phone setup aside | `SidePanel` `variant="opus"` |

---

## Step 3 — Information (`information-step.tsx`)

| UI block | Opus source |
|----------|-------------|
| Step header | kit `Panel` (title + description) |
| Knowledge source cards | `SelectableCard` `variant="opus"` |
| Guided profile / website / upload / schedule editors | Legacy field markup inside step (behavior unchanged); section chrome uses Opus cards above |
| `BusinessScheduleEditor` | Unchanged editor body; step uses Opus header/cards |
| Knowledge quality aside | `SidePanel` `variant="opus"` |

---

## Step 4 — Appointments (`appointments-step.tsx`)

| UI block | Opus source |
|----------|-------------|
| Calendar provider grid | kit `Panel` + `SelectableCard` `variant="opus"` |
| Booking strategy | `WizardSection` → `Panel` + `RadioRow` `variant="opus"` |
| Send-link subform | Native inputs (same fields as legacy); inside `WizardSection` |
| Appointment types table | `WizardSection` → `Panel` |
| What Amy must collect | `ReceptionistCollectFieldsOpus` — `@/newui-transplant/connected/voice/receptionist-editor/receptionist-collect-fields-opus` (uses kit `FieldRow`, `Label`, `Input`, `Button`, `Table`) |
| Booking permissions | `RadioRow` `variant="opus"` |
| Appointment tools aside | `SidePanel` `variant="opus"` |

---

## Step 5 — Call handling (`call-handling-step.tsx`)

| UI block | Opus source |
|----------|-------------|
| Step header | kit `Panel` |
| Booking behavior checkboxes | `WizardSection` → `Panel` |
| Emergency & human transfer | `WizardSection` → `Panel` + `EmergencyTransferEditor` (content unchanged) |
| Messages & callbacks | `WizardSection` → `Panel` + kit `FieldRow` + `Switch` + `CallbackRequiredFieldsOpus` |
| After-hours notifications | `WizardSection` → `Panel` + `AfterHoursNotificationsEditor` |
| AI Call Recovery | `WizardSection` → `Panel` |
| Operating maturity editors | `AfterHoursBehaviorEditor`, `OnCallScheduleEditor`, `CallbackSlaEditor` (unchanged logic) |
| Call handling preview aside | `SidePanel` `variant="opus"` |

---

## Step 6 — Voice (`voice-step.tsx`)

Full wizard step (no `parts` prop) delegates to the same layout as the 3-stage Opus editor:

| UI block | Opus source |
|----------|-------------|
| Entire step layout | `IdentityConversationStage` — `@/newui-transplant/connected/voice/receptionist-editor/stages/identity-conversation-stage.tsx` |
| Identity | kit `Panel` + `VoiceStep` `presentation="opus"` `parts={["identity"]}` |
| Voice picks | kit `Panel`, `Pill` + `VoiceStep` `opusVoiceSlice="picks"` |
| Conversation style (GPT-Live controls) | kit `Panel` + `VoiceStep` `opusVoiceSlice="prompts"` (`FieldRow`, `Switch`, `Label`, `WizardSelectField` → transplant `Select`) |
| Voice row select + Play | transplant `Button` (`ghost` + `outline`) |
| Greeting | kit `Panel` + `VoiceStep` `parts={["greeting"]}` |
| Conversation rules | kit `Panel` + `VoiceStep` `parts={["conversation-rules"]}` |

Underlying `VoiceStep` opus controls: `@/newui-transplant/components/ui/button`, `input`, `label`, `textarea`, `switch`; kit `FieldRow`.

---

## Step 7 — Test (`test-step.tsx`)

| UI block | Opus source |
|----------|-------------|
| Browser vs phone tabs | `Tabs`, `TabsList`, `TabsTrigger` — `@/newui-transplant/components/ui/tabs` |
| Test actions | `Button` — transplant ui |
| Status rows | kit `Rows` |
| Test aside (legacy presentation) | `SidePanel` `variant="opus"` when `presentation="opus"` |

---

## Step 8 — Activate (`activate-step.tsx`)

| UI block | Opus source |
|----------|-------------|
| Step header | kit `Panel` |
| Activate / Test in browser | `Button` — transplant ui |
| Activate summary aside | `SidePanel` `variant="opus"` |

---

## Shared editors (unchanged behavior, Opus chrome around them)

These remain the canonical wizard implementations; Opus mode wraps them in `Panel` / `WizardSection` / `SidePanel` or swaps only the callback/collect sub-editors listed above:

- `EmergencyTransferEditor`, `UrgencyRulesEditor`, `AfterHoursNotificationsEditor`
- `BusinessScheduleEditor`, operating-maturity editors
- `CallbackRequiredFieldsEditor` (legacy path only; Opus uses `CallbackRequiredFieldsOpus`)

---

## 3-stage Opus editor (not used on Edit)

`ReceptionistEditorOpus` and stages under `receptionist-editor/` remain in the repo for reference and partial reuse (`IdentityConversationStage`, `ReceptionistCollectFieldsOpus`, `CallbackRequiredFieldsOpus`). **Edit agent** uses the **full 8-step** wizard only.
