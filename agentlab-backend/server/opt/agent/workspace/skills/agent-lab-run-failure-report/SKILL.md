---
name: Agent Lab run-failure report
description: Use when Rick asks which agent runs failed / need a daily or on-demand failure summary of the Agent Lab run history.
---
# Daily Agent Lab run-failure report

Goal: tell Rick, every morning, which agent runs failed (or needed retries / were killed) in the last 24 hours and the concrete reason for each. Plain language, short.

## Where the truth is
- Run index: `/workspace/runs/runs.db`, table `runs`. Useful columns: `id, title, source, status, attempts, failures, error, last_checkpoint, result, cost, created_at, started_at, finished_at` (all UTC).
  - statuses seen: `done`, `stopped` (user Kill/Pause), `running`, (`failed` is defined but has been empty so far).
  - A retried run keeps `status='done'` with `attempts>1` and `failures>0`; `error` then reads "agent reported error".
- Per-run event log: `/workspace/conversations/<conversation_id with dashes removed>/events/*.json` (sorted). Event kinds that matter:
  - `AgentErrorEvent` → `error` (tool validation errors, "Tool 'search' not found", "restart occurred…", "Tool call interrupted…").
  - `ConversationErrorEvent` → `code` / `detail` (e.g. `MaxIterationsReached: Agent reached maximum iteration limit (200)`).
  - `PauseEvent` / `InterruptEvent` with `source: user` → Rick killed it deliberately, not a failure.
- Deliverables: `/workspace/jobs/<conversation_id>/out/` (some paused jobs still had a finished file there).

## Procedure
1. `sqlite3 /workspace/runs/runs.db` count runs in the window: total / done / failed / stopped / retried (`attempts>1`).
2. For each run with `failures>0`, `status in ('failed','stopped')`, scan its event log for the error kinds above and the last Pause/Interrupt.
3. Classify: real failure (status failed), retried (attempts>1), stopped by Rick (Pause/Interrupt source user) vs stopped for another reason.
4. Check `out/` for each problem run so you can say whether a deliverable existed when it stopped.
5. Report: one line of numbers, one bullet per problem run (title, ET time, reason, delivered yes/no), one "Pattern:" line if a cause repeats. No speculation — if the log doesn't say why, say "reason not in the log".

Handy one-liner for the inventory:
`sqlite3 -header -column /workspace/runs/runs.db "select id,title,status,attempts,failures,round(cost,3) cost,created_at from runs where created_at >= datetime('now','-24 hours') and (failures>0 or status in ('failed','stopped')) order by created_at"`

Watch for these recurring causes: MaxIterationsReached (agent looped past 200 steps), tool-not-found calls (e.g. `search`/`view`/`remember` invoked as tools instead of run in the terminal), malformed tool JSON (unparseable arguments), single-shot `file_editor` validation errors (bad `command` value), and user Pause/Interrupt from kill tests.
