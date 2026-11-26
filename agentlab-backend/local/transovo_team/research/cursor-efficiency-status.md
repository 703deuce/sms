# Cursor-efficiency build on AgentLab: status (Thu Nov 26, 2026, ~5:35 AM EST)

Server: root@204.168.139.158 (ssh -i ~/.ssh/agentlab_root_ed25519 -o IdentitiesOnly=yes). All 5 pieces are built and live.
Proof tests are only partly done; a fresh agent will finish them. No runs are active, and every service is up
(runner, embed, anthropic-shim, keys, helper; container agent-lab up).

## Backup and rollback
- Backup: /opt/agent/backups/cursor-efficiency-20261126T095533Z/ (originals stored under their full path; plus index.db.bak).
- Rollback steps: ROLLBACK.md in that folder. It has a quick off switch for auto-check
  (`touch /opt/agent/tools/flags/AUTOCHECK_OFF`) and the full restore/removal steps.
- Untouched, as instructed: code-rescue / sonnet-assist / keyproxy files, skill_gate.py, phone worker.

## What was built, per item
1. **Semantic search hooked to job code** (`codesearch`)
   - /opt/agent/embed/server.py (agent-lab-embed, 127.0.0.1:6075):
     - repo/ and src_cache are no longer skipped; build, vendor and cache folders are.
     - Job roots are persisted in a new `jobroots` table (7-day TTL).
     - Repos in jobs from the last 2h are found by project markers every 90 s and indexed automatically.
     - Embeddings are cached by content hash in a new `emb_cache` table, so a copy of a repo in another job costs about nothing.
     - Search can be scoped to one folder (both BM25 and vectors).
     - `/reindex {root}` is available.
     - Memory-safe settings (threads 2, batch 4, 1500 chars), plus the drop-in
       /etc/systemd/system/agent-lab-embed.service.d/memory.conf (MemoryMax 2500M).
   - /opt/agent/tools/seclib.py: many more languages; tree-sitter chunking by function/class first
     (/opt/agent/tools/tslib.py, bundled /opt/agent/tools/pylib/ts/ with grammars for 17 languages).
   - /opt/agent/tools/codesearch: `codesearch "query" [PATH] [-k N]` prints `path:A-B [symbol]` plus a snippet.
     It reindexes the project first. The autocheck post-edit hook triggers a background reindex after edits.
2. **Repo map**: /opt/agent/tools/repomap.
   - Tree-sitter defs/refs ranked by PageRank, ~1k-token budget (`--tokens`, `--focus`, `--refresh`, `--json`).
   - Per-file cache in ~/.cache/repomap, keyed by mtime/size, so it refreshes on change.
3. **Grep/Glob**: OpenHands `grep` and `glob` tools.
   - Confirmed registered and usable via /api/tools/catalog.
   - Added to oh-home/settings.json agent_settings.tools, so the list is identical for every job. No wrappers were needed.
4. **Long output and old history as files**
   - qrun (already writes full output to log/out/) is now the stated default in the skill and AGENTS.md.
   - runner/agentd.py: new write_transcript() writes <job>/log/history/transcript-N.md (messages, calls, full outputs)
     before each condensation. The restore note tells the agent to grep it.
     Tested offline on a real conversation (52 KB transcript). The runner was restarted with it.
   - Skill re-injection is unchanged.
   - Backstop: the code default is unchanged. The effective value is already 75K, from the pre-existing
     agent-lab-runner.service.d/stage-split.conf, so it is under 100K.
5. **Auto lint/test**: /opt/agent/tools/autocheck, wired in oh-home/hooks.json:
   - pre_tool_use `*` → `--hook pre`;
   - post_tool_use `file_editor` → `--hook post`;
   - stop → `--hook stop`.
   - Checks: ruff E9/F63/F7/F82, node --check, tsc, eslint, then npm test / pytest / unittest.
   - Takes a pre-edit baseline, so only NEW failures are shown. Repeated failures are grouped into one line.
   - Feedback reaches the agent as a PreToolUse deny on the next call after an edit batch, plus one Stop deny.
   - The fast path for non-edit tools takes 0.06 s.
- Docs:
  - /opt/agent/workspace/skills/lab-coding-repos/SKILL.md "Explore" section: map, then codesearch/grep/glob, then ranged reads, edit, auto-check; qrun for long output.
  - One "Code repos" line in /opt/agent/AGENTS.md.

## Test harness: /opt/agent/tests/cursor_eff/
- `launch.py <tag> <n>`: enqueues the hard5 h1 job (more-itertools bug fix, Haiku, lab-anthropic).
  Batches are in batch_<tag>.json (before, after).
- `collect.py before after [--grade]`: reports cost, tokens, calls, peak prompt, files opened, tool counts and autocheck blocks,
  and grades with the hard5 g_h1 grader. Writes metrics.json.
  - It includes helper children linked by parent_conversation_id. after-1 counts its child run_52e80f6765.
- `launch_proof.py` (STAGED, NOT RUN): one Haiku job that runs repomap, 3 codesearch queries, the grep and glob tools,
  a deliberate broken edit (should be caught by auto-check), and a plain run vs a qrun run of the suite.
  It writes batch_proof.json.
- Lab price for claude-haiku-5-5 is $0.10/M input and $0.50/M output. Total spend so far is about $0.08.

## Results so far
Same h1 job, 2 runs each. Before = original setup; after = all 5 pieces live.

| run | min | cost $ | LLM calls | prompt tok | cache read | output tok | peak prompt | grade |
|---|---|---|---|---|---|---|---|---|
| before-1 | 2.2 | 0.0217 | 22 | 836K | 777K | 13.1K | 56.1K | PASS 6/6 |
| before-2 | 2.5 | 0.0236 | 22 | 860K | 802K | 16.6K | 52.0K | FAIL 1/6 (child stopped before fixing) |
| after-1 | 2.1 | 0.0220 | 19 | 704K | 624K | 11.6K | 53.1K | PASS 6/6 |
| after-2 | 0.9 | 0.0100 | 7 | 281K | 249K | 7.2K | 57.2K | PASS 6/6 |

- Pass rate went from 1/2 to 2/2. The after runs used fewer tokens, calls and minutes. With n=2 these numbers are noisy.
- Honest caveat: the after agents did NOT call codesearch, repomap, grep or glob on this task. They used terminal grep plus the editor.
  The gains are not proven to come from the new tools.
- Auto-check fired in every after conversation: after-1 11 pre + 2 stop; after-2 7 pre + 1 post + 1 stop; the helper 4 pre + 1 stop.
  It blocked nothing, which is correct because the fixes were clean.
- Manual proofs already done:
  - Auto-check caught a broken edit (`iterabel` typo): ruff F821 plus "41 tests fail with NameError…". Baseline failures were hidden, and it exited 2.
    After the typo was removed: "no new problems".
  - codesearch (more_itertools):
    - "negative index … nth combination" → nth_combination #1;
    - "break an iterable into lists of length n" → chunked_even #1, chunked #2;
    - "look at the next item without consuming it" → peekable only at #5.
  - codesearch (ky, TypeScript): "how long to wait before retrying… Retry-After" → docs and types, not Ky.#calculateRetryDelay (MISS).
    The chunk exists in the index; it is a ranking weakness.
  - First index of a 98-file TS repo took 82 s. A second copy of an indexed repo took about 6 s (content cache).
  - repomap: more_itertools ~1021 tokens in 0.2 s (first, peekable, numeric_range…); ky ~980 tokens (Ky class, types).
- Cross-job cache after the tool change (shim log /opt/agent/workspace/runs/anthropic-shim.jsonl):
  - one tools_sha (3484072e…, 24 tools incl. grep and glob) for every call;
  - system_sha 33d0f428… unchanged from before;
  - paths_left=0;
  - after-2's first calls read 27K of 35K prompt tokens from cache.

## What's left to prove (for the fresh agent)
1. Run `python3 launch_proof.py`, then check its reply and events for:
   - the grep and glob tool calls;
   - the auto-check deny reaching the agent in a live job (only proven manually so far);
   - the 3 codesearch top hits and repomap.txt;
   - where plain vs qrun long output lands (qrun → log/out/ file; plain terminal output is expected to be clipped, with no file).
2. Condensation transcript live: force one with POST /api/conversations/{cid}/condense on a test conversation
   (or a run that crosses 75K) and confirm log/history/transcript-1.md and the restore note.
3. Optional: improve codesearch ranking (code vs docs) for the misses above.
4. Watch embed memory: it was at ~2.2 GB right after indexing (MemoryHigh 2200M, Max 2500M). If it gets throttled or OOMs, lower MAX_ROOT_FILES or the batch size.
