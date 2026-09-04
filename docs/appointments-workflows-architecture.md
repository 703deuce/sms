# Appointment Workflows Architecture

## Overview

Appointment Workflows are an **isolated clone** of the Playbooks/Drips pattern, specialized for appointment lifecycle automation. They do **not** share database records with SMS DripCampaigns or Playbooks.

## Components

| Layer | Path | Role |
|-------|------|------|
| Types | `src/lib/appointment-workflows/types.ts` | Triggers, steps, conditions, timing |
| Templates | `src/lib/appointment-workflows/templates.ts` | 7 prebuilt workflow definitions |
| Service | `src/lib/appointment-workflows/service.ts` | CRUD, list active workflows |
| Conditions | `src/lib/appointment-workflows/conditions.ts` | AND/OR appointment condition evaluation |
| Scheduler | `src/lib/appointment-workflows/scheduler.ts` | Relative-to-appointment-time scheduling |
| Engine | `src/lib/appointment-workflows/engine.ts` | Execution, invalidation, step processing |
| Triggers | `src/lib/appointment-workflows/triggers.ts` | Lifecycle hooks (booked, rescheduled, etc.) |
| Capabilities | `src/lib/appointment-workflows/capabilities.ts` | Entitlement-ready feature keys |

## Database

- `appointment_workflows` — workflow definitions
- `appointment_workflow_executions` — per-appointment execution instances
- `appointment_workflow_step_executions` — scheduled/sent step state with idempotency keys

## Runtime

Jobs of type `appointment_workflow_step` are enqueued into the **existing** `jobQueue` worker infrastructure (same as drip campaigns and reminder scan). No separate worker service.

## Prebuilt Templates

1. Standard Reminders
2. Confirmation Required
3. High-Value Appointment
4. Last-Minute Reminders
5. Post-Appointment Follow-Up
6. Review Request
7. Reschedule Follow-Up

## Invalidation Rules

- **Canceled** → cancel all pending steps
- **Rescheduled** → invalidate old relative-time jobs, restart booked workflow
- **Confirmed** → skip steps with `stopIfConfirmed`
- **Completed/no-show** → cancel pending before-appointment steps

## Preserved Systems

Existing `scanPlatformAppointmentReminders` (24h/2h) continues unchanged. Workflows are additive.

## UI

- `/appointments/workflows` — list + prebuilt cards + custom workflows
- `/appointments/workflows/setup/[templateId]` — prebuilt wizard
- `/appointments/workflows/new` — custom workflow builder (Drip-style)

## AI Booking

See `src/lib/appointments/ai-scheduling/` — shared intent service used by public booking and prepared for Conversations reuse.
