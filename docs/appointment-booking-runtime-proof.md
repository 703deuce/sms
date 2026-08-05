# Appointment Booking Runtime Proof — Audit Report

Scope: Maya / Appointment Booking Receptionist end-to-end path where the
**active AutomationFlow is the deployment source of truth**, Activate compiles
**direct Telnyx routing**, and the automation worker only handles **post-call
orchestration** (never live audio).

## 1. Already working

- TeXML-direct inbound path (`Phone → TeXML → Telnyx AI Assistant`) when agent is published with TeXML routing.
- `publishVoiceAgent` syncs assistant + DID assignment.
- Automations **Publish** API validates graph, runs `activateFlowTriggers`, fails closed on Telnyx errors.
- Builder catalog: Inbound Call, Run Voice Agent, Wait for Call Result, Use Agent with invoke guards.
- `wait_for_call_result` + `resumeWaitForCallResult` on CALL_COMPLETED / AI_CALL_COMPLETED / CALL_MISSED.
- My Numbers reads `TriggerDeployment` rows.
- Agent ↔ workflow ownership fields (`primaryFlowId`, `ownerAgentId`, `ownershipKind=agent_workflow`).

## 2. UI-only or stubbed (before this change / still partial)

| Area | Status |
|------|--------|
| AR wizard Activate | Was Telnyx-only; primary flow often stayed DRAFT without TriggerDeployment |
| `run_voice_agent` + `attachInbound` | Previously queued outbound dial even for inbound |
| Inbound → workflow enroll | `inbound_call` not in EVENT_TO_TRIGGER; no TriggerDeployment enroll |
| AR primary graph | Trigger → Run Voice → End with no outcome wait |
| Resave reconcile | Replaced whole graph unless `advancedCustomized` |
| Test button | Soft enroll only; auto-success risk |
| Pause fallback | Soft `voiceForwardTo` only; incomplete TeXML teardown for all modes |
| Downstream SMS / CRM / Use Agent | Runtime exists in engine; not fully proven in live Maya acceptance call |
| Full TeXML pause for voicemail/reject/backup_flow | Still partial — human+number works; other modes noted in diagnostics |

## 3. Newly implemented

1. **Idempotent AR primary workflow**  
   `Inbound Call → Run Voice Agent → Call Outcome → End` with stable template keys  
   (`inbound_call`, `run_voice_agent`, `call_outcome`, `end`).  
   Reconcile patches managed nodes only; custom nodes preserved.

2. **Run Voice Agent config**  
   `agentId`, `telnyxAssistantId`, `mode: realtime_voice`, `waitForOutcome`, `attachInbound`.  
   Inbound attach does **not** dial outbound.

3. **Activate transaction (AR wizard)**  
   Save setup → ensure primary flow → `activateFlowTriggers` (validate + Telnyx publish + TriggerDeployment) → mark flow ACTIVE.  
   Telnyx failure → workflow stays inactive; error surfaced.

4. **Inbound enroll**  
   On inbound call create: ensure contact → enroll live TriggerDeployments for that DID → bind `pendingCallId` → emit CALL_STARTED.  
   Audio remains TeXML-direct.

5. **Richer call outcome payload** for branch resume (`appointmentBooked`, `answered`, etc.).

6. **Diagnostics**  
   `GET /api/automations/:id/diagnostics` + builder panel.  
   Layer map: flow gen / number / activation / Telnyx / assistant / webhook / resume.

7. **Real test checks**  
   `POST /api/automations/:id/test` — Pass / Fail / **Not verified** only. Never auto-pass live audio checks.

8. **My Agents / My Numbers**  
   Cards show primary workflow, TriggerDeployment status, last execution; numbers show agent/workflow labels from the same deployments.

9. **Backfill**  
   `POST /api/agents/backfill-appointment-workflows` — reconcile Maya-class agents without activating.

10. **Pause**  
    Applies human fallback number when configured; clears AI phone ownership; fails closed on fallback errors.

## 4. Remaining blockers (need live workspace)

- Live PSTN call against Maya’s Telnyx number (credentials + DID in env).
- Confirm booking tool + calendar row on a real call.
- Apply migrations if not already on the environment:  
  `20260805_agent_workflow_ownership.sql`, `20260805_trigger_deployments.sql`.
- Pause modes `voicemail` / `reject` / `backup_flow` need fuller provider publish.
- Scheduled AR promote path still primarily Telnyx-focused (wire same activateFlowTriggers if used in prod).

## 5. Exact files changed

See git commit on branch `cursor/agent-workflow-engine-b56f`. Key paths:

- `src/lib/agents/compile-workflow.ts`, `workflows.ts`, `backfill-appointment-workflows.ts`
- `src/lib/automations/trigger-deployments.ts`, `inbound-trigger-enroll.ts`, `enroll.ts`, `events.ts`, `actions.ts`, `deployment-diagnostics.ts`, `catalog.ts`
- `src/lib/voice/inbound.ts`, `post-call.ts`
- `src/lib/jobs/job-handlers.ts`
- `src/lib/solutions/appointment-receptionist/save-setup.ts`
- `src/app/api/solutions/appointment-receptionist/route.ts`
- `src/app/api/automations/[id]/publish|test|diagnostics/route.ts`
- `src/app/api/agents/backfill-appointment-workflows/route.ts`
- `src/lib/systems/load-systems.ts`, `src/components/systems/my-systems-view.tsx`
- `src/lib/numbers/load-my-numbers.ts`, `src/components/numbers/my-numbers-view.tsx`
- `src/components/automations/builder/deployment-diagnostics-panel.tsx`
- `src/app/(app)/automations/[flowId]/edit/page.tsx`

## 6. Manual steps for live call test

1. Ensure migrations applied.
2. Open Maya → resave (or `POST /api/agents/backfill-appointment-workflows`).
3. Open primary workflow — confirm Inbound Call has the DID; Run Voice Agent references Maya + assistant id; Call Outcome node present.
4. Click **Publish / Activate** on the workflow (or Activate in the wizard). Confirm TriggerDeployment `live` and no publish error.
5. Open **Diagnostics** on the workflow — verify Telnyx routing layer `ok`.
6. Call the number. Maya must answer immediately (direct TeXML — no worker delay).
7. Book an appointment; end the call.
8. Confirm: one `AutomationExecution`, booking persisted, Call Outcome resumed, My Agents + My Numbers show Live.
9. Paste `callId` into diagnostics **Run test checks** — verify each PASS; anything missing stays **Not verified**.
10. Negative cases: invalid number, conflicting live trigger, Telnyx publish failure, pause + fallback, hangup, booking fail, duplicate webhook, repeated save (no duplicate flows).
