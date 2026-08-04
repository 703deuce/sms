# Connected architecture — Phase 1 audit

Reference solution: **Missed Call Text Back** (`missed-call-text-back`).
Navigation / sidebar is out of scope for this pass.

## 1. Records that already existed

| Area | Before this pass |
| --- | --- |
| Solution setups | No `SolutionSetup` table. “Setups” were virtual (agent `purpose` / `draftConfig`, or links into `/automations/new`). |
| AutomationFlow | Full model with `definition`, `publishedDefinition`, `version`, status, enrollments. |
| VoiceAgent | Full model + conversation graph in agent config (separate from AutomationFlow). |
| Campaign | Existing SMS/email campaign model. |
| Phone numbers | `PhoneNumber` + agent phone assignments. |
| Calendar | `voice_calendar_connections` etc. |
| Routing | `voice_routing_rules`. |
| Wizard save | Appointment receptionist had a real API; MCTB only linked to `/automations/new`. |
| Builder save/publish | `PATCH /api/automations/[id]` already persisted definition/status. |
| Events | Automation event map (`call.missed`, etc.) + CRM events; no shared `platform_events` table. |

## 2. Linking fields (normalized in Phase 2)

- `solution_setups` — linked agent/automation/campaign/phone/calendar/routing/template IDs + `configJson` + `externalKey`
- `AutomationFlow` — `sourceSolutionSetupId`, linked* arrays, `advancedCustomized`
- `voice_agents` — `sourceSolutionSetupId`, linked automation/phone/calendar IDs, `postCallAutomationId`, `fallbackAutomationId`
- `platform_events` — shared event log with resource IDs + `idempotencyKey`

## 3. Wizard pages that only created UI/config

Most packaged solutions still open settings pages or `/automations/new` without a durable SolutionSetup.
**Exception after this pass:** Missed Call Text Back creates real SolutionSetup + AutomationFlow.

## 4. Which wizards created AutomationFlow

Previously: none of the SMS outcome wizards created a linked flow idempotently.
Now: Missed Call Text Back does (create-or-update by `workspaceId + solutionType + externalKey`).

## 5. Agent actions that can trigger platform actions

Builtin tools (SMS, CRM, calendar, etc.) plus new `start_automation` tool.
Post-call: `postCallAutomationId`, `fallbackAutomationId`, `postCall.startAutomationOnOutcomes`.

## 6. Automation nodes (relevant)

Existing: wait, send_sms, conditions, enroll_in_automation, webhooks, CRM actions, …
Added: `call_missed`, `call_transferred`, `start_ai_call`, `wait_for_call_result`, `start_automation`, `use_ai_agent`.

## 7. Call-result events

`CALL_MISSED`, `CALL_COMPLETED`, `AI_CALL_COMPLETED`, `CALL_TRANSFERRED` via `emitPlatformEvent`, with resume of `wait_for_call_result` executions.
