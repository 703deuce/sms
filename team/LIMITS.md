# Transovo AI limits and escalation

These limits exist so agents do not loop, wait out broken deploys, or spend money without approval.

## Retry limits

- **Failing check or issue:** at most **2** automated fix attempts for the same failing check or the same issue. After the second failed attempt, set `status:blocked`, post a handoff with evidence, and escalate to the Chief of Staff. Do not open a third automated repair loop.
- **Paid AI or render runs:** at most **1** attempt per paid AI or render run. No automatic paid retries and no duplicate paid runs. If the run fails, record the failure and escalate; do not re-run it automatically.
- **Deploys:** a deploy that takes **more than 15 minutes** must be investigated, not waited out. Check logs, deploy status, and health. Escalate to DevOps and the Chief of Staff if the cause is unclear. Do not assume a long deploy will finish if left alone.

## Escalation path

1. The accountable owner records the failure, evidence, and attempts already used on the issue.
2. Escalate to the Chief of Staff (`owner:chief-of-staff`) with `status:blocked`.
3. The Chief of Staff coordinates the next specialist (QA, Video Quality, Security, DevOps, or Engineering) or, when required, escalates to John.
4. Escalate to John (via the Chief of Staff, except that Security may escalate critical issues straight to John) for:
   - security risks
   - real spending or new paid services
   - destructive operations (including destructive database changes)
   - pricing or strategy decisions
   - anything that would modify the SMS worker or Coolify app3 (forbidden)
5. Do not claim that another agent or John was notified unless a real message or GitHub handoff was sent.

## Spend policy

- No new paid services, advertising spend, or other spending commitments without John.
- Keep usage frugal. Do not burn credits on failed or duplicate paid runs.
- Never show `$` amounts in the product UI; the product uses credits only. This document may discuss cost policy for operators, not product copy.
- Specific dollar budget caps for AI APIs, infrastructure, rendering, and experiments: **PENDING JOHN APPROVAL**. No approved numeric caps were provided. Do not treat any dollar figure as an approved limit until John sets one.

| Category | Cap | Status |
| --- | --- | --- |
| AI API spend | not set | PENDING JOHN APPROVAL |
| Render / paid media processing | not set | PENDING JOHN APPROVAL |
| New infrastructure or paid services | no new commitments without John | PENDING JOHN APPROVAL |
| Advertising / growth experiments with spend | no spend without John | PENDING JOHN APPROVAL |

## Usage discipline

Grok Bot usage is a finite weekly limit shared by all 12 bots. Treat it as a scarce team resource, not a per-bot allowance.

- Work only on an assigned GitHub issue. No self-started, continuous, or speculative work, and no back-and-forth chatter.
- Research runs in bounded rounds with a defined deliverable. Do not leave open-ended research loops running.
- Testing stays frugal: reuse fixtures and existing evidence, and do not duplicate runs (including paid AI/render runs covered above).
- When a bot's assigned queue is empty, it goes idle. It does not invent the next task.
- The Chief of Staff checks weekly usage in the daily owner report and escalates to John at **50%**, **75%**, and **90%** of the weekly limit.
- Above **75%** of the weekly limit, only **P0** and **P1** work continues. P2/P3 work waits until usage is back under that threshold or John says otherwise.

The numeric weekly limit itself is whatever the current Grok Bot plan provides; do not invent a substitute cap.

## Related rules

See `team/RELEASE_POLICY.md` for merge and deploy policy, and `team/WORKFLOW.md` for status and handoff rules.
