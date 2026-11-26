# AgentLab: Haiku as default + lean context under 100K (Nov 24, 2026, ~5:15-5:31 PM ET)
Approved by John (t603u). Server 204.168.139.158, OpenHands agent-server 1.63.1 (container agent-lab, not restarted).
Backups: /opt/agent/backups/2026-11-24-haiku-default/ (originals suffixed .221755). Rollback: ROLLBACK.md in that folder (copied at the end of this note).

## What changed
| Where | Change |
|---|---|
| Default model (oh-home/settings.json via `POST /api/profiles/lab-anthropic/activate`) | `deepseek/deepseek-v4-pro` -> `anthropic/claude-haiku-5-5` (profile lab-anthropic; active_profile=lab-anthropic). Runner-started runs (routines, reminders, helpers) and the chat UI's default both read this. |
| oh-home/profiles/lab-anthropic.json | Added `max_input_tokens: 48000`. This is the SDK's hard backstop: the condenser runs before any call whose *estimated* size exceeds it (see calibration). |
| Condenser (settings, via PATCH /api/settings) | llm_summarizing, max_size 240, **keep_first 2 -> 3** (system prompt + session-context message + Rick's request are never condensed, so the request stays verbatim), max_tokens left null (the per-model LLM limit applies instead, so Opus/DeepSeek/Gemini are not squeezed). |
| sync-settings.sh | Its condenser line said max_size 160 / keep_first 0 (stale; re-running it would have reverted). Now matches: 240 / 3 / max_tokens None. |
| runner/agentd.py (agent-lab-runner restarted) | (1) Fallback chain now `lab-deepseek,fallback-gemini` (V4 Pro, then Gemini Flash); a fallback on the same model as the one that failed is skipped. (2) **Context budget watcher** for `claude-haiku-*`: reads each call's real prompt tokens from base_state.json; asks `POST /condense` at the next milestone (new checkpoint, or log/task.json, plan.md, checkpoints.md changed) once a call is >=55K, or right away at >=64K; writes a pre-condensation snapshot (checkpoint, newest files, task record) to log/context-log.md first; waits 3 calls between requests. (3) The context-restore note after every condensation now also says where the full history is (`/workspace/conversations/<id>/events/`, readable by the agent; checked) and points to the snapshots. (4) Thrash guard: 3 condensations within 6 calls (the job's working set doesn't fit) -> raise that conversation's limit to 56000, then off, via switch_llm, logged in context-log.md. (5) Helpers inherit the parent's max_input_tokens with its model, so Haiku's limit doesn't leak onto an Opus helper. Env overrides: HAIKU_CTX_MILESTONE, HAIKU_CTX_FORCE, AGENT_LAB_FALLBACK_PROFILES. |

Not touched: AGENTS.md, hooks.json, run.sh, .env, Coolify/app3, SMS worker, the sms repo. The agent-lab container was not restarted.

## How it maps to the design principles
- **Stable cached prefix:** nothing was added to the system prompt or tools. keep_first=3 means condensation never touches the prefix, and every post-condensation call read the full ~40.8K prefix from cache (e.g. 41,681 prompt / 40,834 cache-read).
- **Trim first, then summarize:** OpenHands 1.63 only has LLMSummarizing, NoOp and Pipeline condensers. There is no observation-masking or tool-output-clearing condenser, and the API can't inject or edit events. So "trim" is done this way: the runner's milestone condensation (a REQUEST) forgets the *older half* of events (old page dumps, skill reads, screenshots) and keeps the recent half verbatim. Originals stay in the append-only event log.
- **Token-triggered, at milestones:** runner at 55K (milestone) / 64K (force), measured in real Anthropic tokens. SDK backstop at 48K estimated (about 62-85K real, depending on content).
- **Never summarize a summary (as far as 1.63 allows):** the SDK's summarizer still folds the previous summary into the next one (its prompt says so; it can't be changed without rebuilding the image). To compensate, after every condensation the runner re-injects durable state from disk: task record (log/task.json), plan, request checklist, last checkpoint, newest files, Rick's latest instruction, the skills that were loaded, and the event-log path. Rick's request is kept verbatim through keep_first.
- **Full history on disk:** /opt/agent/workspace/conversations/<id>/events/*.json, one file per event (append-only).

## Token-count calibration (important)
The SDK counts tokens with an OpenAI tokenizer for `anthropic/...` models. On real runs, Anthropic billed **1.3-1.8x** what the SDK estimates: about 1.55 on the system prompt, 1.29 on skill markdown, and 1.77 once screenshots pile up. Measured on the Haiku documentary run (7ba44543), and on the new runs where the SDK fired at "53,673 est", which was about 70K real. That's why the SDK backstop is 48,000 *estimated*, not 80,000, and why the runner uses real billed tokens for the main trigger.

## Verification (all on the default model, launched like the front-end with no model override)
Cost is the conversation stats (litellm pricing), agent plus condenser calls. Cache-read % = cache-read / prompt tokens over all calls.

| Run | Config | Calls | Peak prompt / call | Cache read | Cost | Result |
|---|---|---|---|---|---|---|
| short 7bbfdb11 | final | 3 | 40,725 | 49.7% (first call writes the 40.8K prefix) | $0.0056 | Model = claude-haiku-5-5 with max_input 48000. check.txt written. |
| long a53b81a7 (6 Wikipedia pages, screenshots, checkpoints) | v1 (runner couldn't see tokens yet) | 26 | 78,257 | 91.5% | $0.037 | Done (6 sections + summary). 2 SDK-backstop condensations, each a full reset to ~41.7K. |
| docplan c27f4d5c (documentary plan with motion-studio skills) | v1 | 15 | 76,364 | 84.3% | $0.029 | Done. Skill thrash seen: condensed 3x in 3 calls, re-read skills (8 skill reads). |
| long 169ebf03 | v1 thrash guard too eager | 27 | **129,602** | 90.5% | $0.109 | Done, but the guard wrongly lifted the limit, so it crossed 100K. Fixed in v2/v3. |
| docplan 3d8892ac | v2 | 12 | 75,787 | 83.1% | $0.024 | Done (facts, script, 6-scene storyboard). 4 skill reads, no thrash. |
| long 40dbc5de | v2 | 29 | 70,005 | 90.3% | $0.041 | Done. Guard still fired once (raised to 56000), so I tightened the rule. |
| **long b0f3d1df** | **final (v3)** | 29 | **63,383** | **91.2%** | $0.038 | Done, 6/6 sections + summary. 4 milestone condensations by the runner; after each, the context fell to 51-54K, not 41K, so recent work was kept verbatim. Pre-condensation snapshots written. |

Total verification spend: **about $0.28** (cap $0.50). Every call in the final config stayed under 100K. The only 100K+ call was in the buggy v1 thrash-guard run.
Condensation cost is tiny: about $0.0005-0.0008 per summary call (2-6K tokens).

Not live-tested: the fallback chain, since no provider error happened. The logic was unit-checked (FALLBACK_PROFILES = ['lab-deepseek', 'fallback-gemini']; budget matches haiku only).

## Limits found
1. **Fixed prefix about 40.8K real tokens** on every call (tools ~14K, OpenHands base prompt ~6.5K, AGENTS.md ~16.5K, session-context message ~2K). That leaves ~55K of working room under 100K.
2. **Big skills barely fit.** motion-studio-production SKILL.md plus film-pipeline, engines, by-video-type and RULES_FROM_RICK is ~36K real tokens. Prefix plus skills is ~77K before any work starts. The full documentary pipeline on Haiku will condense often, and the agent may lose skill text and re-read it (thrash guard caps the loop). Real fix: split those skills into smaller per-step files, or route that job type up a tier (part of the Opus routing work).
3. **SDK backstop resets fully.** When the SDK's own token trigger fires, it reduces to half of max_tokens (24K est), which is below the prefix, so everything after keep_first is summarized. The runner triggers earlier, at milestones, which keeps the recent half instead. Final run: all 4 condensations came from the runner.
4. **The summary chain is not fixable in 1.63** without rebuilding the image: the summary prompt is bundled, and there's no observation-masking condenser. Mitigated by re-injecting durable state.
5. **No cross-run cache sharing.** Every run's 2nd call writes the full ~40.8K prefix (cache_read 0, confirmed on all 12 earlier Haiku tests and these runs). Cause: the file_editor/terminal tool descriptions contain `Your current working directory is: /workspace/jobs/<conversation id>`. Anthropic orders tools first, so the per-job path breaks the cache for everything after it. The dynamic context also ends with the start minute (CURRENT_DATETIME).
6. **The condenser limit is per provider profile, not per model.** The chat UI builds every Anthropic model (Haiku, Sonnet, Opus) from the `lab-anthropic` profile plus a model override (new-app/lib/server/agent-lab-models.ts PROVIDER_META). So Opus/Sonnet picked in the UI also inherit the 48000 SDK limit. The runner's milestone/force triggers apply only to Haiku. Fix when Opus routing is built: give Opus its own profile (lab-opus exists) in PROVIDER_META.
7. **Front-end default:** listLabModels() takes the default from /api/settings, so it is now Haiku. The hardcoded `'deepseek/deepseek-v4-pro'` there is only a fallback if settings are unreadable. Note: agent-lab-chat.tsx line ~362 prefers a model saved in the browser (localStorage) over the default, so a browser that previously picked DeepSeek keeps DeepSeek until changed in the picker. No repo change made.
8. Once, after a mid-run switch_llm (thrash guard), one call missed the AGENTS.md/datetime part of the cache (21.6K read instead of 40.8K). Cause unconfirmed; it didn't recur. Mid-run model switches can cost a partial cache rewrite. This matters for the router design.
9. The settings' agent_context.current_datetime is a stale fixed string (2026-11-22T22:55); the per-conversation dynamic context still shows the real start time. Harmless, but worth cleaning up.

## Ideas to trim the ~40.8K system prompt (not applied; need John's OK)
Measured sizes, in characters (~2.55 chars per real token):
- **Biggest win is caching, not size:** make the tool descriptions job-independent, e.g. a constant working dir with the job folder named only in the session-context message (which comes later in the prompt). Then the 40.8K prefix is a cache *read* across runs instead of a fresh write every run. That saves about 40K × (write − read price) per run on every model, and is the biggest part of Opus's ~$0.20-0.30 per-run floor. This needs a sandbox (job-exec) check, so test first.
- Tools (36K chars ≈ 14K tokens): drop or lazy-load rarely used browser tools: start/stop_recording (1.8K), get/set_storage (1.3K), list/switch/close_tab (1.5K). Drop the `fetch` MCP (2.1K; overlaps browser_get_content and agent_search). Drop `switch_llm` (0.7K) once the router owns model choice. Shorten agent_mcp_connect (2.4K), agent_verify (2.7K), agent_view (2.5K) and agent_skill (2.2K) descriptions. About 10-12K chars, roughly 4-5K tokens.
- AGENTS.md (42K chars ≈ 16.5K tokens): "Your computer" is 10.9K chars. Move the per-tool details into an on-demand skill and keep a 1-2K index. "HARD RULES" (6.9K) and "How you work" (6.5K) likely overlap with "Background work" (3.8K) and "Parallel work" (1.6K); deduplicate. Plausibly 15-20K chars, about 6-8K tokens. Content change, so John's call.
- OpenHands base system prompt (16.4K chars ≈ 6.5K tokens): generic CodeAct guidance, some of it overridden by AGENTS.md. Could be replaced with a custom system prompt template, but that's a bigger change.
- Skills: split motion-studio-production into per-step files (the main SKILL.md alone is ~13K tokens).
Realistic target: prefix ~28-30K tokens, which gives Haiku ~65-70K of working room instead of ~55K.

## Files on the server
- /root/haiku-lean/launch.py (default-model launcher, no override), mon.py (per-call stats), launched.jsonl
- Runner log lines: `journalctl -u agent-lab-runner | grep "context budget"`
- Per-job: log/context-log.md (pre-condensation snapshots, summaries, limit raises)

## Rollback (also at /opt/agent/backups/2026-11-24-haiku-default/ROLLBACK.md)
agentd.py.v2-* = intermediate runner version)

Run as root on 204.168.139.158. No container restart is needed for 1-4 (settings and profiles are read live).

```bash
B=/opt/agent/backups/2026-11-24-haiku-default
# 1. Default model back to DeepSeek V4 Pro (copies the lab-deepseek profile into the default llm)
python3 /opt/agent/ops/oh.py POST /api/profiles/lab-deepseek/activate
# 2. Condenser back to the old settings (keep_first 2; event-count trigger only)
python3 /opt/agent/ops/oh.py PATCH /api/settings '{"agent_settings_diff":{"condenser":{"condenser_kind":"llm_summarizing","enabled":true,"max_size":240,"max_tokens":null,"keep_first":2}}}'
# 3. Haiku profile without the 48000 limit
install -o agentlab -g agentlab -m 600 $B/profiles.221755/lab-anthropic.json /opt/agent/oh-home/profiles/lab-anthropic.json
# 4. Runner (fallback chain, context budget, thrash guard) and sync script
install -o agentlab -g agentlab -m 644 $B/agentd.py.221755 /opt/agent/runner/agentd.py && systemctl restart agent-lab-runner
install -o root -g root -m 700 $B/sync-settings.sh.221755 /opt/agent/sync-settings.sh
```

Exact byte-for-byte settings.json restore (only if needed; restarting the container interrupts running jobs):
```bash
docker stop agent-lab && install -o agentlab -g agentlab -m 600 $B/settings.json.221755 /opt/agent/oh-home/settings.json && docker start agent-lab
```
(After 1, the default llm's usage_id reads "lab-deepseek", not "agent"; that only changes the key in cost stats.)

Partial rollbacks:
- Runner only, keep Haiku default: step 4.
- Turn off just the runner's milestone/force condensing: add `Environment=HAIKU_CTX_MILESTONE=999999999` and
  `Environment=HAIKU_CTX_FORCE=999999999` to agent-lab-runner (systemctl edit), then restart it.
- Different fallback chain without code edits: `Environment=AGENT_LAB_FALLBACK_PROFILES=fallback-gemini`.
