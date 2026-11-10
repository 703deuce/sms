# Transovo AI team workflow

Source of truth: GitHub issues, pull requests, and project records in [703deuce/sms](https://github.com/703deuce/sms).

Prefix every issue comment, PR body, PR comment, review, and commit message with `[Agent: <role>]`. See `team/AGENTS.md` for the audit-trail rule.

## Task states

Labels: `status:backlog`, `status:specifying`, `status:ready`, `status:building`, `status:review`, `status:testing`, `status:blocked`, `status:approved`, `status:deployed`, `status:done`.

Each issue has exactly one current status label. When the status changes, replace the old status label with the new one (do not leave two status labels on the same issue).

| State | Meaning |
| --- | --- |
| Backlog | Captured, not yet specified or scheduled. |
| Specifying | Product or the owner is writing requirements and acceptance criteria. |
| Ready | Requirements and acceptance criteria are sufficient; work can start. |
| Building | The accountable owner is implementing or otherwise executing the work. |
| Review | A change or deliverable is waiting for independent review. |
| Testing | Independent QA and, when applicable, Video Quality or Security are verifying the work. |
| Blocked | Work cannot proceed; the blocker and escalation path must be recorded. |
| Approved | Required reviews passed; the change is ready to deploy (or ready to close if no deploy is needed). |
| Deployed | A deploy was performed; production verification may still be outstanding. |
| Done | Acceptance criteria are met and, if a deploy was required, production behavior has been verified. |

Do not mark a task Done merely because code was written.

## Allowed transitions

```
Backlog     → Specifying, Ready, Blocked
Specifying  → Ready, Backlog, Blocked
Ready       → Building, Specifying, Backlog, Blocked
Building    → Review, Ready, Blocked
Review      → Testing, Building, Blocked
Testing     → Approved, Building, Review, Blocked
Blocked     → Backlog, Specifying, Ready, Building, Review, Testing
Approved    → Deployed, Done, Blocked
Deployed    → Done, Building, Blocked
Done        → Backlog (only if reopened with a reason)
```

Skip states only when they truly do not apply, and say why in a handoff comment. Engineering code changes must still pass independent QA before Approved. Video Quality is required for clip, edit, render, or AI pipeline changes. Security is required for authentication, billing, storage, or permission changes.

## One accountable owner

Every issue has one accountable owner, recorded with a single `owner:*` label and in the issue body. Other specialists may contribute, review, or test. Ownership changes are made by the Chief of Staff (or by the current owner with a handoff comment) and must update the owner label.

## Handoff format

Post a structured issue comment (and on the PR, when one exists) when assigning work, finishing a step, requesting review, rejecting work, or changing status:

```
[Agent: <role>]

## Handoff
- From:
- To:
- Issue:
- PR (or "none"):
- Previous status:
- New status:
- What changed:
- Evidence (commands, logs, links; only what was verified):
- What remains:
- Blockers:
- Requested next action:
```

If a direct messaging channel is unavailable, this comment is the handoff record. Never claim another agent was notified unless a real message was sent.

## File-locking rule

1. Before editing files, the accountable owner (or the agent about to edit) comments on the issue with the claimed file and directory paths.
2. Only one open PR may cover a given path set at a time.
3. Check for overlapping claims and open PRs before starting. If two agents need the same paths, or two open PRs already conflict, stop and escalate to the Chief of Staff. Do not overwrite another agent's branch or uncommitted work.
4. Release the claim in a handoff comment when the PR is merged, closed, or the work is reassigned.

## Audit-trail rule

All team bots currently share one GitHub token, so GitHub attributes every API action to the same account. The audit trail therefore depends on explicit attribution:

- Every issue body, issue comment, PR body, PR comment, review, and commit message must start with `[Agent: <role>]`.
- Do not attribute work to another agent.
- Distinguish code written, tests passed, deployed, and verified in production. Only claim what has been verified.

## Coordination

The Chief of Staff maintains the backlog, assigns work, resolves ownership and path conflicts, and returns rejected work for correction. Agents may discuss technical details directly, but assignments and completion status go through GitHub issues and PRs.
