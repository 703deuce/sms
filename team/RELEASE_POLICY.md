# Transovo AI release policy

This policy separates routine low-risk merges from high-risk changes that need extra reviews and John's approval.

Prefix every related issue, PR, and commit with `[Agent: <role>]`.

## Low-risk routine changes

Examples: copy changes, UI tweaks, tests, and non-destructive fixes that do not touch the high-risk areas listed below.

These may be merged by Backend or DevOps only after:

1. Independent QA has reviewed the change (the author is not the only certifier).
2. Required CI checks are green on the PR.
3. The PR follows `team/WORKFLOW.md` (linked issue, file-ownership claim, evidence, and completion lines).

Video Quality and Security reviews are still required when the change actually falls into their scope, even if it otherwise looks routine.

## High-risk changes

Treat a change as high-risk if it involves any of the following:

- Authentication or authorization
- Billing, payments, or pricing
- Storage, signed media URLs, or upload/download authorization
- Permissions or multi-tenant data isolation
- Database migrations
- AI, clip, edit, or render pipeline changes
- Infrastructure, deploy configuration, or secrets
- Anything touching the SMS worker or Coolify app3 (**forbidden** — see hard rules)

High-risk changes require:

1. Independent QA.
2. Video Quality review when clips, editing, rendering, or AI models/pipelines are affected.
3. Security review when authentication, billing, storage, or permissions are affected.
4. Green CI on the PR.
5. **John's approval** before merge and deploy.
6. A release issue (use the Release template) with risk class, rollback plan, and `/api/health` `commitSha` verification after a web deploy.

Backend and DevOps must not merge high-risk work on their own.

## John's hard rules

These come from the team charter and are not optional:

- Never deploy or modify the SMS worker or Coolify app3. Preserve their data and config.
- No force-push, history rewrite, or reset. Branch, then PR, then CI, then a normal merge.
- Never show `$` in the product UI. Use credits only.
- Additive database migrations only. No destructive database operations without John.
- Don't break working modes: upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take.
- Never expose secrets, keys, tokens, cookies, or signed URLs.
- Don't assign story angles in AI editorial prompts.
- No automatic paid retries or duplicate paid runs. Keep usage frugal.
- Deploys should take minutes. Investigate long ones (see `team/LIMITS.md`: investigate deploys taking more than 15 minutes); don't wait them out.
- Separate code written, tests passed, deployed, and verified in production. Only claim what is verified.
- The bot that writes code isn't the only one certifying it. QA, Video Quality, and Security review independently when in scope.
- Work autonomously within these bounds. Escalate to John (via the Chief of Staff) only for security risks, real spending, destructive ops, pricing, or strategy. Security may escalate critical issues straight to John.
- Communicate only through real channels. Never claim another bot was notified unless you actually sent it.
- Web deploys go out automatically from `master`. Verify with `/api/health` `commitSha`. Worker deploys use `scripts/deploy-worker.sh` and are limited to Backend and DevOps.
- Only Backend Engineer and DevOps run deploys; other roles need their approval.

## Proposed branch protection — awaiting John's approval

**Do not apply these settings until John approves them.** This section is a draft only. Existing branch protection and rulesets were left unchanged during team setup.

Audit of `master` at setup time (verified via the GitHub API):

- Classic branch protection: **not enabled** (`GET /repos/703deuce/sms/branches/master/protection` returned 404 "Branch not protected"; `protected: false`).
- Repository rulesets: **none** (`GET /repos/703deuce/sms/rulesets` returned `[]`).

Proposed settings for `master`:

- Require a pull request before merging.
- Require 1 approving review.
- Do not allow force-pushes.
- Do not allow branch deletion.
- Required status checks: the existing GitHub Actions check names observed on this repository (job names as reported by the Checks API).

Checks observed on pull requests or `master` (from workflow files and from check runs on PR #1080 / current `master`):

| Check name | Workflow | When it runs |
| --- | --- | --- |
| `voice-agent-runtime` | CI | All pushes to `master` / `cursor/**` and all PRs to `master` |
| `number-marketplace` | Number Marketplace CI | All pushes to `master` / `cursor/**` and all PRs to `master` |
| `editor-shell-import-guard` | Clips editor import guards | Path-filtered (clips editor / AI producer paths) |
| `editor-regression` | Editor QA regression | Path-filtered (editor, clips, AI producer, related tests) |
| `captions-worker-regression` | Editor QA regression | Same path filter as Editor QA regression |
| `visual-audio-worker-regression` | Editor QA regression | Same path filter as Editor QA regression |
| `motion-graphics-mp4-smoke` | Editor QA regression | Same path filter as Editor QA regression |
| `new-app-guards` | New app CI guards | Path-filtered (`new-app/app`, `new-app/prisma`, related scripts/tests) |
| `migration-table-refs` | Prisma migration guards | Path-filtered (`new-app/prisma` and related scripts/tests) |
| `queue-sms-worker-deploy` | Deploy SMS worker (Coolify) | Push to `master` only, not a PR check |
| `deploy-clips-worker` | Deploy clips worker (Coolify) | `workflow_dispatch` only, not a PR check |

Recommendation for John:

- Require the always-on PR checks `voice-agent-runtime` and `number-marketplace` only after they are consistently green. **At audit time both were `failure` on PR #1080's head commit and on current `master` (`9fdaad09265742d16803599adf0ecb8037c9e61d`).** Requiring them while they fail would block all merges.
- Do not make the path-filtered checks required in classic branch protection unless GitHub will still allow merge when those workflows are skipped. Otherwise unrelated PRs would be stuck waiting for checks that never run.
- Do not require `queue-sms-worker-deploy` or `deploy-clips-worker` as PR checks; they are deploy jobs, not merge gates. Also, automatic deploys of the SMS worker conflict with the hard rule that the SMS worker / Coolify app3 must not be deployed or modified; that workflow should be reviewed separately.
- Keep "do not allow force-push" and "do not allow deletion" even if required checks are phased in later.

No branch protection or ruleset was created or changed by this setup.
