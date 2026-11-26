# Model routing in production autonomous agents — and what AgentLab should build

Researched 2026-11-24 (read-only). Primary sources linked inline. Where a vendor does not document its routing, it says so.
Server facts come from a read-only look at the AgentLab box (openapi.json of agent-server 1.63.1, oh-home settings/profile *names*, runner/agentd.py grep, usage/summary.json). No secrets read or printed.

## 1. How each system routes

| System | Granularity | Mechanism | Notes / source |
|---|---|---|---|
| **Manus** | Task, and "subtask/step" (aspirational) | Model-chooses/hand-tuned per task type; planner is a separate "agent-as-tool" | Peak Ji (webinar): Claude for coding, Gemini for multimodal, OpenAI for hard math/reasoning; "task level routing or maybe even subtask or step level routing if you can pull in that KV cache validation"; can use a different model for the planner; no open-source models because distributed KV-cache is hard. Few agents: big general executor + planner + knowledge agent. Exact model mix is NOT published. Sources: https://yuntaozhang999.github.io/context-engineering-for-ai-agents-with-langchain-and-manus/ , blog https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus (KV-cache hit rate is "the single most important metric"; keep prefix stable, append-only) |
| **Cursor** | Per request/turn | Learned classifier ("Cursor Router" behind Auto). **Compass** predicts whether a turn is simple (score 0–1, threshold) → cheap model; otherwise a task/domain taxonomy picks the best frontier model. Trained on user follow-up/correction signals, and *includes cache-miss cost from switching* | https://cursor.com/blog/how-cursor-router-works , https://cursor.com/docs/cursor-router . Modes Cost/Balance/Intelligence. Cursor reports ~41–68% lower cost at equal-or-better satisfaction (their numbers). User can't pick model per request. |
| **Claude Code** | Per subagent; per mode | Rule/config: subagent `model:` field (haiku/sonnet/opus/inherit); per-call override; env `CLAUDE_CODE_SUBAGENT_MODEL`; `opusplan` = Opus in plan mode, Sonnet to execute; docs say route cheap side-tasks to Haiku; fallback model chain | https://code.claude.com/docs/en/sub-agents , https://code.claude.com/docs/en/model-config . Note: Anthropic's own advice (claude.dev blog) is to keep code *edits* on the main model and give small models only work where a mistake is cheap to spot; measure opusplan yourself. |
| **GitHub Copilot Auto** | Per turn, but only at **cache boundaries** | Learned router (HyDRA) + live model health; routes on 1st turn and after compaction, then stays put | https://github.blog/ai-and-ml/github-copilot/getting-more-from-each-token-how-copilot-improves-context-handling-and-model-routing/ — "Switching models mid-conversation breaks that cache, which can cost more than the routing change saves." |
| **OpenHands SDK/agent-server** | Per request (router), per step (agent-chosen or classifier), per sub-agent | See §3 | https://docs.openhands.dev/sdk/guides/llm-routing , /llm-task-routing |
| **Devin / Cognition** | Planner + fast executor pairing | Hand-designed: Sonnet 4.5 as "smart friend"/planner, SWE-1.5 as fast executor (Windsurf hybrid). Devin's own routing internals are not documented | Secondary summaries: https://cognition.com/blog/devin-sonnet-4-5-lessons-and-challenges , ZenML write-up. Treat as partially verified. |
| **OpenAI Agents SDK / Codex** | Per agent / per subagent | Config: each `Agent(model=...)`; handoffs keep target agent's model; `RunConfig.model` overrides all. Codex: subagent TOML files with own `model` + reasoning effort; `[agents] default_subagent_model` | https://openai.github.io/openai-agents-python/models/ ; https://learn.chatgpt.com/docs/agent-configuration/subagents ; issue https://github.com/openai/codex/issues/14039 |
| **LangChain/LangGraph** | Per model call (each step) | Code: `@wrap_model_call` middleware picks model from state (e.g. message count) | https://docs.langchain.com/oss/python/langchain/middleware/custom ; LangGraph itself = checkpointed state, not a router |
| **Aider** | Per sub-step (architect → editor) | Fixed two-model split: strong reasoner describes the fix, cheaper model writes the edit | https://aider.chat/2024/09/26/architect.html — o1-preview+DeepSeek editor 85% vs o1-preview solo 79.7% on their benchmark (2024 models). |
| **Replit Agent** | Per task; orchestrator + subagents | "Auto" = intelligent routing by complexity/cost; higher effort escalates to stronger models; subagents (testing, review) may use different models. Algorithm not published | https://docs.replit.com/features/agent/model-selector |
| **Factory (Droid)** | Per mode | Config: separate Spec-mode (planning) model + reasoning effort vs execution model (`--spec-model`) | https://docs.factory.com/autonomy-and-safety/specification-mode |
| **Amp (Sourcegraph)** | Per mode + subagent | Modes (rush/smart/…) each map to a model; Oracle (review/advice, read-only) and Librarian subagents | https://ampcode.com/docs/models-and-subagents (from search summary; internals not published) |
| **RouteLLM** | Per prompt | Learned strong-vs-weak router from preference data; ~85% cost cut at ~95% of GPT-4 quality on MT-Bench (2024, chat not agents) | https://arxiv.org/abs/2406.18665 |
| **OpenRouter Auto / NotDiamond** | Per request | Hosted classifier picks a model from an allowed list | https://openrouter.ai/docs/guides/routing/routers/auto-router ; https://docs.notdiamond.ai |
| **FrugalGPT** | Per query cascade | Cheap model first; a learned scorer decides if the answer is reliable, else escalate; up to ~98% cost cut at equal accuracy on one task | https://arxiv.org/abs/2305.05176 |

Not found documented: Devin's internal router, Manus's exact model list, Replit's router algorithm. No vendor publishes routing specifically for "motion-graphics code".

## 2. Patterns that actually show up in production

1. **Planner/executor split** (opusplan, Factory spec mode, Aider architect, Devin smart-friend, Manus planner agent). Strong model thinks; cheaper model does the typing. Caveat: Anthropic itself warns to measure before putting code edits on a smaller model.
2. **Cheap-model subagents for side-work** (explore, search, summarize, fetch). Isolated context, only a summary returns. Cheapest, safest win.
3. **Route at boundaries, not every turn.** Copilot routes on turn 1 and after compaction; Cursor trains cache-miss cost into its router; Manus makes step-level routing conditional on cache handling. Mid-run switches are a deliberate event.
4. **Learned complexity gate + cascade** (Cursor Compass, FrugalGPT, RouteLLM): try cheap; escalate when predicted/observed to fail. Needs a lot of traffic to train — for us, start with rules.
5. **Escalate on failure signals**: provider errors (Claude Code fallback chain, OpenHands FallbackStrategy), stuck/loop detection (OpenHands StuckDetector), repeated errors.
6. **Specialty pinning**: Manus (Gemini for multimodal, Claude for code), Cursor's own finding that different frontier models win different domains (visual implementation vs devops) — i.e. visual work gets pinned to the model that's best at it, not routed by cost.
7. **Keep state outside the chat** so a model swap is safe: Manus's filesystem-as-memory/todo, Anthropic's progress file + git, LangGraph checkpoints.

## 3. What OpenHands 1.63 already gives us (verified on our server's openapi.json, agent-server 1.63.1)

| Capability | Exact names | Status on our box |
|---|---|---|
| Rule-based per-request router | `RouterLLM` (`llms_for_routing`, `select_llm(messages)->key`), built-in `MultimodalRouter` (images→"primary", text→"secondary"). Docs: https://docs.openhands.dev/sdk/guides/llm-routing ("under active development"), example 19_llm_routing.py | SDK-level; agent-server also has `/api/conversations/{id}/model_router` (GET/PATCH, mode auto/manual) and `POST .../model_router/routes` (add a saved profile as a route). Not currently used. |
| Agent-chosen switch | `SwitchLLMTool` → `switch_llm(profile_name, reason)`; takes effect on next LLM call; history/files preserved. https://docs.openhands.dev/openhands/usage/settings/llm-settings | **Already enabled** in our settings.json tools list (`switch_llm`). Needs prompt guidance + profile descriptions to be used well. |
| Classifier-based router | `ClassifyAndSwitchLLMTool` (`route_task_to_model`) + `MetaProfile`/`MetaProfileClass` (classes: description→profile; or direct prompt_template returning JSON). Settings `enable_classify_and_switch_llm_tool`, `active_meta_profile`. Docs https://docs.openhands.dev/sdk/guides/llm-task-routing ; PR https://github.com/OpenHands/software-agent-sdk/pull/3744 | **Off** (`enable_classify_and_switch_llm_tool: false`, no meta-profiles dir). API `/api/meta-profiles*` exists. Agent must call it; it costs one classifier call. |
| Manual/runner switch | `POST /api/conversations/{id}/switch_profile` and `/switch_llm` | **Already used** by runner/agentd.py for provider-error fallback (`llm_fallback`, restores original after). We can reuse for phase switches. |
| Sub-agents with own model/budget | `TaskToolSet`/`TaskTool` (`task(prompt, subagent_type, resume)`), file-based agents in `.agents/agents/*.md` or `.openhands/agents/` with frontmatter `model` (a saved LLM profile name, default `inherit`), `max_budget_per_run` (USD), `max_iteration_per_run`, `condenser`, `tools`. Docs https://docs.openhands.dev/sdk/guides/task-tool-set , https://docs.openhands.dev/sdk/guides/agent-file-based . Old `DelegateTool` deprecated since 1.60. | **Not in our tool list** (tools = terminal, file_editor, browser_tool_set, switch_llm). Schemas `TaskAction`, `SubAgentInfo` are in openapi. Needs a quick test that the agent-server loads agent files from our oh-home/workspace. |
| Provider-error fallback | `FallbackStrategy` (`fallback_llms` profile names; per call, retries primary next call) | Our runner has its own fallback (`AGENT_LAB_FALLBACK_PROFILES`, default `fallback-gemini`). |
| Loop detection | `StuckDetector` on by default: 4 identical action/obs, 3 action/error, 3 monologue msgs, 6 alternating (A/B) cycles, context-window errors → status `STUCK`. https://docs.openhands.dev/sdk/guides/agent-stuck-detector | Runner already watches for `stuck` status and fails/falls back. It misses *non-identical* loops (flash "tries a bit different each time forever") — needs our own progress check. |
| Condenser | `LLMSummarizingCondenser` (+`PipelineCondenser`, `NoOpCondenser`); settings `max_size`, `max_tokens`, `keep_first`; `POST /conversations/{id}/condense` to force. Docs https://docs.openhands.dev/sdk/guides/context-condenser | Ours: llm_summarizing, `max_size: 240` events, **`max_tokens: null`**, keep_first 2. Runner `watch_condensation` re-injects plan/progress after each condensation. Note: it can summarize earlier summaries; event log is append-only (the "full history" layer). |
| Saved profiles on box | `/opt/agent/oh-home/profiles`: lab-anthropic, lab-deepseek, lab-gemini, lab-luna, lab-openai, lab-opus, fallback-gemini | Meta-profile store: none yet. |

Honest limit: I could not introspect the installed Python package (agent-server is a bundled PyInstaller binary, no `openhands.sdk` importable in the container). Findings come from the server's own openapi.json (v1.63.1) + settings + upstream docs/source. Class behavior should be confirmed with a tiny test run.

## 4. Our real cost data (usage/summary.json, 162 convs, generated 2026-11-24, total $18.30 incl. $2.55 media)

| Model | Convs | Cost | Prompt tokens | Note |
|---|---|---|---|---|
| Opus 5.5 | 14 | $7.74 | 8.6M | documentary $4.17 alone |
| deepseek-flash | 74 | $4.44 | 196M | |
| deepseek-v4-pro | 39 | $2.38 | 17.1M | |
| Luna | 22 | $0.91 | 64.7M | |
| Haiku 5.5 | 3 (+1 mixed) | ~$0.01 | ~0.17M | tiny runs; **effectively untested** |

Same documentary task: Opus $4.17 (6.1M prompt tokens, 41K output) · v4-pro $1.10 (10.0M) · flash $0.78 (29.6M, 597K output) · Luna $0.63 (49.3M). Cheaper models burned 1.6–8× more tokens: more steps, i.e. cost per *unit of progress* is closer than price per token suggests. (Quality of each documentary was not scored in the data — I can't say which looked best.)
Benchmark suite (invoice PDF, Excel, CLI, form fill, trim/title export…): Opus $0.23–0.43 each; flash $0.003–0.07 each. For routine tasks flash is 5–100× cheaper if it finishes correctly.
Small Opus runs carry ~45–60K cache-write tokens each (fixed system prompt + tools) → a floor of roughly $0.2–0.3 per fresh Opus context (inference from token counts; plan to confirm). All models run ~90–98% cache-read, so **a mid-run model switch throws away the cache and re-pays that write on the new model** — consistent with Cursor/Copilot/Manus warnings.

## 5. Recommended routing design for AgentLab

Principle: **route by step type, at boundaries, with escalation on evidence — rule-based first; no learned router (we have no traffic to train it).** Pin visual quality to the strong model; use cheap models where a wrong move is cheap to detect.

### 5.1 Step type → model (starting table; adjust after A/B)
| Step type | Model (profile) | Why |
|---|---|---|
| Intake, plan, checklist, file ops, shell, ffmpeg/PDF/Excel, web search/fetch, summaries, condenser LLM | cheap: **lab-anthropic (Haiku)** to be tested; **deepseek-flash** where Haiku fails; Haiku only under its ~100K boundary (pricing boundary not verified by me — check Anthropic's page) | Benchmarks show flash $0.003–0.07/task |
| Instruction-heavy multi-step orchestration (long pipelines) | mid: **v4-pro** (current default) or Luna | flash loops, Luna skips directions |
| Writing/revising Remotion/motion-graphics code, website/UI code, design decisions | **lab-opus** | John's test: Opus worked, cheaper didn't look right |
| Visual QA (look at rendered frames/screenshots, judge) | **lab-opus** (vision-capable; runner already tracks vision status) | Visual quality is the failure mode we can't afford |
| Final render/export, upload, cleanup | back to cheap | mechanical |

### 5.2 How to switch (three layers, build in this order)
1. **Opus as a sub-agent for visual steps (preferred).** Add `TaskToolSet`; define `.agents/agents/visual-coder.md` with `model: lab-opus`, `max_budget_per_run` (e.g. $1.50), `max_iteration_per_run`. The cheap main thread delegates "write/fix scene X, render, check frames" with a short brief + file paths. Benefits: Opus gets a *small fresh* context (our small Opus runs cost ~$0.3), main thread's cache untouched, hard budget per call. Sub-agent conversations persist and can be `resume`d for fix-iterations.
2. **Runner-driven phase switch** using the existing `switch_profile` call from agentd.py when the plan checklist enters a step tagged `visual` (deterministic, auditable); switch only at a checkpoint (after writing the checkpoint file, or right after a condensation). Switch back at the next non-visual step.
3. **Agent-chosen `switch_llm`** (already on): add short guidance to AGENTS.md/skills ("before authoring motion/UI code, call switch_llm lab-opus; after the render passes, switch back"). Treat as a fallback; log every switch with reason. Defer `route_task_to_model` (classifier) until A/B shows it's needed.

### 5.3 Escalation rules (cheap → mid → Opus; each at most once per step)
- StuckDetector `STUCK` → escalate one tier instead of failing (runner currently fails/falls back).
- Our own loop guard (flash-style non-identical loops): N tool calls (e.g. 25) or X minutes on a step with no new/changed artifact hash, no checklist item done, or same error class ×3 → escalate.
- Violated explicit instruction (checklist verifier / output validator fails twice) → escalate.
- Provider error → existing fallback profile (keep, but make Opus's fallback another strong model, not Gemini Flash, for visual steps).
- Failed visual QA twice on the same defect → Opus with a fresh context + the defect list, not more cheap retries.
- **De-escalate** after a hard step completes; never escalate above Opus; after Opus fails twice → stop and ask John.

### 5.4 Budget caps
- Per-run cap (e.g. $2 routine, $6 video), per-tier caps (cheap tier ≤ $0.50 per step before forced escalation or stop, Opus sub-agent `max_budget_per_run`), per-conversation iteration cap (runner already 200). Runner reads accumulated cost from conversation stats each heartbeat; at 80% → warn + checkpoint, at 100% → stop and report, no silent overruns. Paid-run approval from John stays required.

### 5.5 Tie-in to checkpoints/compaction (three-layer memory)
- Layer 1 live context: set condenser `max_tokens` per tier (e.g. ≤80K on Haiku to stay under the boundary; larger on Opus, condense rarely — Opus cache is the expensive thing). Today it's event-count only (240), which doesn't protect a 100K cap.
- Layer 2 durable checkpoint (plan, checklist, decisions, artifact paths+hashes, "next step"): written *before* every switch and condensation; the receiving model's first message is the checkpoint + only the files it needs. Runner already re-injects plan/progress after condensation (`watch_condensation`) — extend it to model switches.
- Layer 3 searchable full history: OpenHands event log stays append-only; don't depend on summaries-of-summaries for exact facts (keep exact values in the checkpoint/artifacts).
- Cache-aware: switch only at (a) run start, (b) after condensation, (c) sub-agent boundaries — never mid-step.

## 6. A/B test plan (needs John's OK for paid runs — nothing run yet)

Hypothesis: routed runs cost ≤ ~40% of Opus-only on mixed work with no visible quality loss on visual outputs.

Task set (fixed, ~13 tasks): the existing ~10-task benchmark suite (we already have Opus + flash numbers), the 30s Dean vs Ray J documentary, plus 2 UI/website tasks.

Arms:
- A Opus-only (have data; rerun the documentary once for freshness)
- B v4-pro-only (default; have data)
- C **Haiku-only** on the 10 routine tasks (new — nothing known about Haiku yet; also tests the 100K ceiling)
- D Routed: Haiku/flash main thread + Opus `visual-coder` sub-agent (+ escalation rules)
- E Routed via agent-chosen `switch_llm` only (tests whether the model picks sensible moments)

Run each arm×task ×3 for routine tasks, ×2 for the documentary (noise is large).
Measure: total $ (incl. cache read/write split), prompt/output tokens, steps, wall-clock, escalation count & reason, switches, pass/fail on automated checks (file exists, ffprobe duration/res, PDF text, form submitted), and **blind visual rating** (John or a rubric + a judge model different from the one that made it) for the video/UI outputs. Primary success metric: cost per *accepted* output.
Rough budget (estimate, not measured): arm C+routine tasks ≈ $2–4 total; documentary D ×2 ≈ $3–6; A rerun ≈ $4; total ≈ $12–20 incl. everything. Get John's go-ahead on a cap before starting.
Decision rule: adopt D if cost per accepted output ≤ 50% of A with equal visual rating; drop Haiku from a step type if it fails ≥1 of 3 or needs escalation >30%.

## Sources (index)
- OpenHands: https://docs.openhands.dev/sdk/guides/llm-routing · /llm-task-routing · /task-tool-set · /agent-file-based · /agent-stuck-detector · /context-condenser · https://github.com/OpenHands/software-agent-sdk/pull/3744 · https://arxiv.org/html/2511.03690
- Manus: https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus · https://yuntaozhang999.github.io/context-engineering-for-ai-agents-with-langchain-and-manus/
- Cursor: https://cursor.com/blog/how-cursor-router-works · https://cursor.com/docs/cursor-router
- Claude Code: https://code.claude.com/docs/en/sub-agents · /model-config
- Copilot: https://github.blog/ai-and-ml/github-copilot/getting-more-from-each-token-how-copilot-improves-context-handling-and-model-routing/ · https://docs.github.com/en/copilot/concepts/models/auto-model-selection
- OpenAI: https://openai.github.io/openai-agents-python/models/ · https://learn.chatgpt.com/docs/agent-configuration/subagents
- LangChain: https://docs.langchain.com/oss/python/langchain/middleware/custom
- Aider: https://aider.chat/2024/09/26/architect.html
- Replit: https://docs.replit.com/features/agent/model-selector · Factory: https://docs.factory.com/autonomy-and-safety/specification-mode · Amp: https://ampcode.com/docs/models-and-subagents
- Cognition: https://cognition.com/blog/devin-sonnet-4-5-lessons-and-challenges
- RouteLLM https://arxiv.org/abs/2406.18665 · FrugalGPT https://arxiv.org/abs/2305.05176 · OpenRouter https://openrouter.ai/docs/guides/routing/routers/auto-router · NotDiamond https://docs.notdiamond.ai
