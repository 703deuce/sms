# Transovo AI limits and escalation (Updated Nov 19, 2026)

These limits exist so agents do not loop, wait out broken deploys, or spend money without approval.

## Retry limits

- **Failing check or issue:** at most **2** automated fix attempts for the same failing check or issue. After the second failed attempt, set `status:blocked`, post a handoff with evidence, and escalate to the Chief of Staff.
- **Paid AI or render runs:** at most **1** attempt per paid AI or render run. **No automatic paid retries and no duplicate paid runs.** Never launch a paid Modal or production render without John's explicit approval.
- **Deploys:** a deploy taking **more than 15 minutes** must be investigated (logs, `coolify-db`, `/api/health`), never waited out.

## Escalation path

1. Accountable owner records failure, evidence, and attempts used.
2. Escalate to Chief of Staff (`status:blocked`).
3. Chief of Staff coordinates specialist or escalates to John (Security may escalate critical issues straight to John) for:
   - security risks or exposed credentials
   - real spending or new paid services
   - destructive DB operations
   - pricing or strategy changes
   - anything touching the SMS worker or Coolify `app3` (**forbidden**)

## Spend policy & approved rendering

- **Modal film rendering (`transovo-motion-render`, `worker/modal_motion/`):** Approved by John on **Nov 19, 2026** on **CPU mode** (`~$0.19/rendered min` benchmarked; `MODAL_MONTHLY_BUDGET_USD` default `30` checked against `ai_usage`). Still requires explicit approval before running paid production/test jobs.
- **All other new paid services, ad spend, or commitments:** No spend without John.
- **Never show `$` amounts in the product UI** — credits only.

## Usage & Coordinator Gate (`MotionStudioWorkerPlan`)

- Grok Bot weekly usage is finite and enforced in production by `MotionStudioWorkerPlan` (`grokbot-plan-john` in `new-app/lib/server/motion-studio/coordinator.ts`), which pauses new AI job dispatches once `observedPercent >= weeklyLimitPercent`.
- As of Nov 19, 2026 (`grokbot-plan-john`): `weeklyLimitPercent = 100.0`, `observedPercent = 96.7`, resets `2026-11-24 20:41 UTC` (Tue Nov 24 3:41 PM ET).
- Work only on assigned tasks; stay frugal and reuse existing rendered segments (`reuse` + `/render-asset`) instead of re-rendering.

## Related rules

- [`docs/handoffs/2026-11-19-chief-of-staff/STANDING_RULES_2026-11-19.md`](../docs/handoffs/2026-11-19-chief-of-staff/STANDING_RULES_2026-11-19.md)
- [`team/RELEASE_POLICY.md`](./RELEASE_POLICY.md)
- [`team/WORKFLOW.md`](./WORKFLOW.md)
