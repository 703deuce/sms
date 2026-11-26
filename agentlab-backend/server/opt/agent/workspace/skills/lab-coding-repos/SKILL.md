---
name: lab-coding-repos
when_to_use: Use when writing, fixing, testing, or reviewing code in a git repo, exploring a codebase, running tests, or writing a PR-style summary. Not for documents, slides, or web research. Use gh only if already authenticated.
description: Git workflow, reading a big repo, tests, and PR-style summaries.
---

# Coding and repos

Work in this job folder (copy a repo here if it lives under `/workspace/testdata` or another path). Finished code and reports go under `out/` unless you are editing the repo itself.

## Explore, don't dump

Order: map, search, read ranges, edit, let the auto-check run.
- **Map first:** `repomap` in the repo prints a ~1k-token outline of the most-referenced files, classes and functions with line ranges (`--focus word`, `--tokens 2000`). Cached; refreshes on change.
- **Search by meaning or name:** `codesearch "what the code does"` returns `file:A-B` ranges with snippets (hybrid keywords + embeddings + rerank over this repo; indexed on first use, kept fresh after your edits). For exact names use the `grep` tool (files matching a regex) and `glob` (files by pattern, e.g. `**/*.ts`), or `rg -n`.
- **Read ranges, not files:** the editor `view` with `view_range [A, B]`, or `read_section FILE --lines A:B`. Read README, tests and config before changing anything. Never cat a whole large file or repo into the prompt.
- **Long output:** run tests and builds through `qrun -- <command>` (exit code, tail, error lines; full output saved under `log/out/`). Grep that file instead of re-running.
- **Auto-check:** after a batch of edits, lint (ruff/tsc/eslint/node --check) and the project's tests run automatically before your next step; you only see problems your edits introduced (failures that existed before your first edit are hidden). Fix them, or re-issue the call if a failure is expected.
- Note how the project is built and tested (Makefile, pytest, a `tests/` script) and use that.

## Change the smallest thing that fixes it

- Make the smallest change that meets the request. Don't weaken tests, add unrequested features, or reformat unrelated files.
- Put scripts longer than a few lines in files; run them from the file. Don't paste long heredocs into the terminal.

## Speed: estimate early, pick a faster runtime

Before writing a compute-heavy program (search, solver, simulation, big data loops, a time limit or large inputs), estimate the cost: input size, roughly how many basic operations, and the time budget. If plain CPython clearly will not make the target (about 10^8+ simple steps, or a stated limit you can't hit), say so in one line and choose a faster approach **unless the task forbids it** (e.g. "pure Python", "standard library only"). If it is forbidden, stay in Python and say that is the limit.

Available here, in this order of effort:
- **A native library that already does the job** (check first): `pysat` (`from pysat.solvers import Cadical153`) and `z3` for SAT/SMT, `scipy`, `numpy`, `pandas`.
- **numba** (`@numba.njit`) for numeric loops, or **numpy** vectorising.
- **PyPy**: run the same script with `pypy3 script.py` (pure-Python code, often 10-100x faster; no numpy there).
- **C**: `gcc -O2` (or `g++`) for a small compiled helper, or **Cython**.

Time a small input first (`time`), then scale; keep the original simple version to cross-check outputs. In your report say which runtime you used, why, and the measured time.

## Tests and verification

- Run the project's existing tests after a fix. If there are none and the request asks for tests, add them and run them.
- The check is the test runner's output (exit code 0 and PASS lines), not a claim that it should pass.
- Quote the command and the PASS/FAIL lines in your report.

## Git workflow

- `git status`, `git diff`, and `git log --oneline -n 15` before you commit, so you know what you're recording.
- Commit only in this job's copy of the repo (or a branch you created here). Write a short, specific message (what changed and why).
- Do not `git push` unless Rick asked. Never `--force` push to a shared branch. Do not rewrite history on a branch you don't own.
- If you need a clean branch: `git switch -c topic/short-name` from the current default branch.

## PR-style summary

When the work is a fix or a review, write a short summary (in the reply, or `out/PR_SUMMARY.md` if a file was asked for):

- What changed (files and the actual behavior change)
- Why (the failing test, bug, or request)
- How to test (exact command)
- Anything you did not do (out of scope)

## `gh` (GitHub CLI)

- Run `gh auth status` first. If it is **not** authenticated, do not run `gh auth login`, and do not ask for a token. Write the PR summary as a file and stop at that.
- If it **is** already authenticated, you may use `gh pr create`, `gh pr view`, `gh issue list` as the request needs. Still no force-push, and no auth or secret flags printed.

## When you are stuck on code: `sonnet-assist --mode code` (rare)

You stay in charge. Use it only when the same test or build still fails after about 2 real fix attempts, or you cannot find a bug after reading the code and the failure. Not for ordinary errors, not for planning, writing new features, docs, or anything non-code.

1. Save the failing output to a file (`pytest ... 2>&1 | tail -60 > /tmp/fail.txt`).
2. Send only the small context: `sonnet-assist --mode code --goal "<one short paragraph: what must work, what you already tried>" --file path/to/code.py:120-200 --file tests/test_x.py:30-80 --error /tmp/fail.txt --apply`. (`code-rescue` is the same command.) Line ranges of the failing function and its test, not whole files, not the job history.
3. It returns SEARCH/REPLACE edits and a short NOTE (`--apply` applies them; if one fails to match, apply it by hand). If it answers `NEED: ...`, send that range and call once more.
4. Re-run the tests yourself and quote the result. Never take its word that it works.

Limits: about 22k input tokens (line ranges of the failing function and its test, not whole files). A context-too-large refusal means shrink what you send. It is a one-shot call, not a model switch: you remain the model for the rest of the job.

## Before you call a fix done
- Self-test edge cases, not only the reported bug: empty input, all zeros, a single item, and every item filtered out (e.g. all orders refunded). A fix must not crash where the old code worked.
- Deliver the change: write `out/<repo>.patch` (`git diff <base>` including new files) and say its path. If you work in a helper folder, the runner also exports a patch to the job's `out/code/`.
