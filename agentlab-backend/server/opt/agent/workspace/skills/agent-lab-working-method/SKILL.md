---
name: agent-lab-working-method
description: Load at the start of any long or multi-step job here (a video, a design, research, coding, computer use, anything with helpers) for how to plan, verify and stop, keep memory and tool notes, run helpers in isolation, and read your context log.
---
# How to work a long job in Agent Lab

The short rules are in your instructions. This is the depth behind them. None of it is a time, step or spend limit: the success criteria in the task record decide when you are done.

## 1. Size the task, then plan to match
- **Trivial** (answer a question, one file change, one command): do it and check it. No record.
- **Medium** (a few steps, one deliverable): `agent_task_start` with `goal`, `criteria` (2-6 measurable statements from the request: "MP4 is 30 s ±0.5", "page loads with no console errors", "every claim has a source link") and 2-5 `milestones`.
- **Big** (a film, an app, research plus build, multi-day): the same with milestones that each end in something checkable, plus `log/plan.md` for design notes, assets and skills to load.
- **Unfamiliar project:** a short discovery first: layout, README/config, how it builds, runs and is tested, existing conventions. Save what matters with `project-note`. Then size and plan.

## When the plan itself is the risk: `sonnet-assist --mode plan` (rare)

Use only for a large, fuzzy multi-step project where a bad plan would waste the job. Not for normal or medium tasks, and not to offload the work.

  sonnet-assist --mode plan --goal "<the request and the key constraints>"

It returns a numbered `PLAN:` of at most about 15 concrete steps (and at most 3 short NOTE lines). You stay in charge and execute it. It is a one-shot call, not a model switch.

The task record (`log/task.json`) holds the goal, criteria with their verification status and evidence, milestones and completed work. Only `agent_verify` changes a criterion; `agent_task_update milestone=M2` marks a milestone done (and writes a checkpoint); `add_criteria` when Rick adds a requirement. After a summary of your history the `[Context restored]` message starts with this record: trust it over your memory and never redo what it marks done.

## 2. Verify through one interface, then stop
`agent_verify criterion=C2 kind=...` returns PASS / FAIL / UNABLE_TO_VERIFY with evidence and findings and records them:
- `media`: path + expected duration/tolerance/width/height/audio/lufs (ffprobe/loudness measured).
- `images`: stills or a video with `fps`; a second model reviews exactly these images and you see them too.
- `file`: exists, min_bytes, `contains` regex. `command`: a test or script, exit 0 = PASS (full output saved under `log/verify/`). `urls`: sources reachable.
- `manual`: your own judgement with `status` and `evidence`; recorded as self-assessed.
Fix only what FAILs. A PASS on unchanged inputs is answered `ALREADY PASSED` without re-running. When every criterion passes the record moves to **deliver**: write the report from the record (each criterion, what was measured). UNABLE_TO_VERIFY is never hidden: name it in the report. If you try to finish with pending or failed criteria you are shown the list once.

## 3. Memory layers
- **User (Rick, all bots):** `remember --shared --type rule|preference|person "..."`. Rules and shared facts load at the start of every conversation.
- **Project:** `project-note <slug>` to read, `project-note <slug> "note"` to add a dated note. One project's decisions, assets and state.
- **Session (this job):** your job folder: `log/task.json` (the task record), `log/goal.md`, `log/instructions.md`, `log/plan.md`, `log/checkpoints.md`.
- When Rick corrects you, save the correction at the right layer the same turn, phrased as the reason behind it, not as a one-off patch.
- Which memories were loaded into your context is logged in `log/read-manifest.jsonl` (`memory-session-start`, `memory-recall`).

## 4. Tool notes and MCP servers
- Unknown CLI: run `<tool> --help`, try it on a small input, then save what worked: `remember --type tool --shared "<tool>: <the command that works and the gotcha>"`. One note per tool: a new note for the same tool replaces the old one, so write the whole current advice, short and specific to that tool.
- Missing capability: `agent_mcp_find`, pick the vendor's own or the official server, `agent_mcp_connect`, use it right away (tools appear as `<name>_<tool>` from your next step), then save a tool note. The connect reply reports Discovery (where it came from), Authentication (keys needed and whether they are present) and Permissions (where it runs, which tools can change things) separately; quote them when you report. Connected servers go into the MCP library: later conversations load one with `agent_mcp_connect name="..."` (`agent_mcp_list` shows the library). Only the core tools load everywhere. Installs are logged in `/workspace/runs/mcp/installs.log`.
- A server that needs a key: `agent_mcp_connect` with `secrets` and `env={"X":"${X}"}`. If the key is missing, Rick is asked on the Agent Lab page and it goes into the vault. Never ask for a key in chat and never write one in a file.

## 5. Helpers in isolation
Each helper gets its own job folder under yours (`helpers/<id>/`), runs on your model, and must keep its work there: its own render and output folders, and its own `git worktree add` (or a fresh clone) when it touches a repo, never your checkout. Give each helper a self-contained brief (goal, inputs by absolute path, what to return, how to verify) and merge its results yourself. Its result arrives as its own concise report plus the path of the full report (`helpers/<id>/out/result.md`) and its output files; you never receive its conversation.

## 6. Context log
`log/read-manifest.jsonl` records every skill load and helper-file read, every image check (images, verdict, how they reached you) and the memories loaded. `log/context-log.md` keeps each summary of your history. Use them when you report what you read and checked.

## 7. Cancel and resume
A pause, a restart or a step-budget stop never loses files. On `[Recovery]`, `[Step budget]` or `[Context restored]`, read the task record (`agent_task_status`), `log/plan.md` and `log/checkpoints.md`, check what exists on disk, and continue from the first unfinished step. Write outputs to a temp name and rename when complete, so an interrupted render never leaves a half file under the final name. Write a checkpoint (`agent_checkpoint`) after each finished step.

## When a step fails
Read the real error, then try at least 2 different approaches (another source, API, library, version, parser or install route) before calling it a gap. Verify the route that worked on the actual output. In the reply, list each obstacle and how you got past it. Details: `lab-unblock-another-way`.
