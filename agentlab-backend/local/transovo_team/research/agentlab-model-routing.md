# AgentLab model routing: how OpenHands and other platforms switch models, and what we should do

Prepared for John Jones, 24 Nov 2026 (ET). Read-only research: nothing on the AgentLab server was changed.
Scope: OpenHands 1.63.1 on 204.168.139.158 (`/opt/agent`, container `agent-lab`), the 703deuce/sms app, and other agent platforms.

## 0. Bottom line

- **Your hypothesis is confirmed, with one refinement.** Across every platform I checked, the role-to-model binding is fixed in code or config. That means a subagent definition, a mode, a worker node or a per-agent `model` field. The model never decides who writes a piece of work. The model, or a rule, only decides which role gets the task. The expensive worker then owns the task end to end in a fresh context.
- **Why we fail.** Our Haiku conversation holds the work and is only *invited* to hand it to Opus. It is invited through `visual-build`, `helper --model opus` and the unused `switch_llm` tool. The `switch_llm` tool has been called **0 times in 204 stored conversations**. The `task` tool and `route_task_to_model` are not enabled at all. The only enforcement is a guard that blocks file extensions. Haiku went around it with PIL and ffmpeg.
- **Fix.** The server decides the owner model when the work starts. Visual work starts as its own conversation (or sub-agent) created on `lab-opus`. Haiku is never the entry point for it. About 8–12 hours of work, using what is already in the runner. The native OpenHands router is not the right tool for this (see §1.4 and §4.2).

---

## 1. OpenHands (installed 1.63.1, plus upstream docs and GitHub)

The agent server runs as a PyInstaller binary (`/usr/local/bin/openhands-agent-server`). Its dist-info shows `openhands_sdk`, `openhands_tools` and `openhands_agent_server` 1.63.1, but the `.py` files are compiled inside it. I downloaded the matching 1.63.1 wheels from PyPI (`pip download openhands-sdk==1.63.1 openhands-tools==1.63.1 openhands-agent-server==1.63.1`). I read the source from those, in `/workspace/ohsdk/src/openhands/`. I checked the live server's `/opt/agent/openapi.json` to confirm which endpoints actually exist.

### 1.1 Per-conversation model selection

- **LLM profiles.** `LLMProfileStore` (`sdk/llm/llm_profile_store.py`) holds JSON profiles. Ours are in `/opt/agent/oh-home/profiles/`: lab-anthropic (Haiku), lab-opus, lab-deepseek, lab-gemini, lab-luna, lab-openai, fallback-gemini, plus a restore-* profile.
- **Choosing at creation.** `POST /api/conversations` takes `agent_settings.llm`. The conversation is created already on that model. Docs: https://docs.openhands.dev/sdk/guides/llm-profile-store
- **Sub-agent definition files.** The `model:` field in a Markdown agent definition names a saved profile (see §1.3).

### 1.2 Changing the model mid-conversation

Server endpoints on the live install (from `openapi.json`):
- `POST /api/conversations/{id}/switch_profile`
- `POST /api/conversations/{id}/switch_llm`
- `GET`/`PATCH /api/conversations/{id}/model_router`
- `POST /api/conversations/{id}/model_router/routes`

Source, `sdk/conversation/impl/local_conversation.py` lines ~2161–2290:
- `switch_llm()` and `switch_profile()` call `_replace_agent_llm()`.
- That function replaces only `agent.llm` and the condenser (`_condenser_for_switched_llm`).
- **The event history is untouched.** The whole history is re-sent to the new model.

Built-in tools (`sdk/tool/builtins/switch_llm.py`):
- `switch_llm`: the agent picks a saved profile. The tool docstring says the switch applies on the *next* LLM call.
- `route_task_to_model` (`classify_and_switch_llm.py`, flag `enable_classify_and_switch_llm_tool`): a classifier LLM reads the last 6 user and assistant messages and returns a class or a profile. Then it calls `conversation.switch_profile()`.

### 1.3 Delegation and sub-agents

Sources: `tools/task/{definition,manager}.py`, `sdk/subagent/{schema,registry,load}.py`.
- **`TaskToolSet`** is the blocking `task` tool. It runs a *separate sub-agent conversation* with a fresh context: only the prompt goes in and only the result comes back. Docs: https://docs.openhands.dev/sdk/guides/agent-file-based
- **File-based agent definitions** are Markdown with YAML frontmatter, loaded from `{workspace}/.agents/agents/*.md`, `.openhands/agents/*.md`, `~/.agents/agents/` and `~/.openhands/agents/`. They are registered at conversation start (`_register_file_based_agents`, local_conversation.py ~2011).
- **Frontmatter fields:** `name, description, model, tools, skills, max_iteration_per_run, max_budget_per_run, condenser, permission_mode, hooks, mcp_servers, profile_store_dir`.
- **`model: inherit` is the default.** It copies the parent's LLM (`manager.py:381-389` does `parent_llm.model_copy`). Any other value loads that saved profile (`registry.py:220-232`).
- So a sub-agent with `model: lab-opus` is a fully Opus conversation. It gets its own `usage_id`, its own `reset_metrics()` and its own condenser (`registry.py:262-280`).
- `AgentDelegateAction` and `DelegateTool` (`tools/delegate`) are the older, parallel flavour of the same idea.
- `POST /api/sub-agents` lists the available sub-agents.

### 1.4 Router LLMs and meta-profiles (the "Model Router")

- **SDK `RouterLLM`** (`sdk/llm/router/`): `MultimodalRouter` sends image or oversize prompts to the primary model and everything else to the secondary. There is also a `random` router. This is per-call routing. There is **no** complexity or visual router in the SDK.
- **Meta-profiles** (`sdk/llm/meta_profile_store.py`, `agent_server/meta_profiles_router.py`): a classifier profile, a prompt template, a model table, and either `classes` or a direct prompt.
  - Endpoints on our install: `GET /api/meta-profiles`, `POST/DELETE /api/meta-profiles/{name}`, `/activate`.
  - Agent settings fields: `enable_classify_and_switch_llm_tool`, `active_meta_profile`, `meta_profile`, `meta_profile_llms`.
- **Announcement (VERIFIED, 12 Nov 2026):** "Stop Choosing Coding Models by Hand", https://www.openhands.dev/blog/stop-choosing-models-by-hand. Docs: https://docs.openhands.dev/openhands/usage/agent-canvas/model-configuration. Feature map: https://enyst.github.io/openhands-features/F12-model-router.html
  - Router Pro, Router Flash and Custom. Classifier is MiniMax-M3. The prompt template and model table are editable. The rules came from a GEPA prompt-optimisation search over 5 coding benchmarks.
  - **Benchmark numbers are exact** (359 held-out instances, average per task):

    | Configuration | Score | Cost per task |
    |---|---|---|
    | claude-fable-5 | 75.4 | $4.11 |
    | claude-opus-4-7 | 68.6 | $1.86 |
    | claude-opus-4-8 | 68.4 | $1.55 |
    | **Router Pro** | **69.4** | **$1.50** |
    | Router Flash | 63.5 | $0.89 |
    | MiniMax-M3 | 60.8 | $0.35 |

  - **Their warning about switching per request is real.** Quote: "we don't route on every request. A gateway that routes each request in isolation is cache-blind". They give cache hit rates of ~90% within a turn, ~55% across turns, ~8% after a model switch. They attribute those to a Microsoft Azure Research study of 13.5M Copilot sessions. **I did not verify that underlying study.** It also says cache-blind routing cost 4.88x more.
  - **The router is a tool the agent decides to call.** The feature map says: "The agent decides whether to call `route_task_to_model`: a prompt that conflicts with routing made deepseek-flash skip the call even with the instruction present". The "Run on first message" toggle is a prompt instruction, not enforced. **I found no server-side forced routing in the 1.63.1 source.**
  - **The benchmark has no visual-craft category.** The five categories are swe-bench, swt-bench, GAIA, swe-bench multimodal (fixing bugs from screenshots) and commit0. None of them covers design, motion or video. The only hint is the example class "task is UI oriented or requires looking at images".
  - **`/model` is a UI command in Agent Canvas.** It is not in the server. Our UI is Transovo's own Next app.

### 1.5 Condenser LLMs

- The agent settings carry `condenser: {condenser_kind: llm_summarizing, max_size: 2000, ...}` and a condenser LLM.
- `default_condenser(llm.model_copy(update={"usage_id": "condenser"}))` makes the condenser use the *same model* as the agent unless set otherwise. A sub-agent's `condenser:` frontmatter can name its own.
- In our runner, `apply_named_profile` copies the chosen profile onto the condenser as well. So an Opus run also summarises on Opus.

### 1.6 What our install and runner actually do today (read from the box)

| Mechanism | State on our install |
|---|---|
| `lab-anthropic` / `lab-opus` profiles | Present. Used. |
| Pick model at creation | **Yes.** `agentd.py` `run_agent_settings()` → `apply_named_profile()` applies the profile file before `POST /api/conversations`. |
| `switch_profile` | Only as (a) a fallback in `start_run_conversation()` and (b) provider-error failover/restore (`agentd.py:386,405`). Never used for routing. The code comment says switching "has been seen to leave usage_to_metrics empty", which breaks cost attribution. |
| `switch_llm` tool | Enabled in `settings.json` tools (`terminal, file_editor, browser_tool_set, switch_llm`). **0 calls in 204 stored conversations.** `AGENTS.md` never tells the agent to use it. |
| `route_task_to_model` / meta-profiles | **Off.** `enable_classify_and_switch_llm_tool: false`, no `active_meta_profile`, no meta-profile files. |
| `task` tool / file-based sub-agents | **Not enabled.** `task` is absent from the tool list. No `.agents/agents` or `~/.openhands/agents` directory. 0 `task` calls. |
| Helpers (`helper "…" --model opus`) | Exist. A helper is a separate conversation created on the requested profile, so it does the job of a native sub-agent. **Default: inherits the parent's model.** `agentd.py:180-199` `inherit_parent_llm`. |
| Front-desk `job start` | `tools/jobcli.py:85-88` hard-codes `model=R.DEFAULT_PROFILE` (Haiku) for every background job. A code comment says routing is left to the planning pass and escalation helpers. **This is the line that decided "Haiku owns the video".** |
| Opus plan | `attach_opus_plan` in `agentd.py:98-138` is advisory text prepended to the Haiku prompt. |
| Opus judge | `opus-step` runs as a tool call from inside the Haiku conversation. |
| `visual-build` | A tool Haiku has to choose to call. It wasn't called. |
| `agent-guard` | Blocks `.tsx/.html/.css` writes only. It can't see PIL or ffmpeg. |

**Verdict on our setup.** The native mechanism that matches John's model is *model chosen at creation, work owned by that conversation*. The runner already has that for helpers and routines. The front desk simply never uses it for visual jobs.

### 1.7 The sms app

Files (master): `new-app/lib/server/agent-lab-models.ts`, `agent-lab.ts`, `app/api/agent-lab/conversations/route.ts`. Copies are in `/workspace/smsfiles/`.
- `switchConversationModel()` (agent-lab-models.ts) calls OpenHands `POST /conversations/{id}/switch_llm` with a full LLM config.
- **PR #1273** ("background jobs UI and remove model picker", merged 25 Nov 03:30 UTC / 24 Nov 10:30 PM ET) deleted the model route. The master tree has no `conversations/[id]/model/route.ts`. The function is now dead code. I did not run a full caller search: GitHub code search returned 404 and the local clone is stale (10 Nov). I confirmed the file tree and read the three files above.
- `POST /api/agent-lab/conversations` calls `conversationSettings(id)` with **no model argument**. It then posts straight to OpenHands (`/api/conversations`) with the saved settings. Those settings have `active_profile: lab-anthropic`, so the chat starts on Haiku.
- `runner/agentd.py` has no `switch_llm` code. The sms switch path and the runner's profile-at-create path are unrelated. The runner only "adopts" the chat afterwards for watchdog and cost tracking. Jobs started with `job start` do go through the runner (`R.enqueue`).

---

## 2. Other platforms: who decides, when, and how sub-tasks get a different model

| Platform | Who picks the model | When | How a sub-task gets a different model | Source |
|---|---|---|---|---|
| **Claude Code** | User, or config. A subagent's `model` field is fixed config. The parent may pass a per-invocation alias. | Up front per session. `opusplan` swaps at the plan/execute phase. | Subagent frontmatter `model:` (`opus`/`sonnet`/`haiku`/`fable`/full ID/`inherit`). Precedence: per-invocation param → definition → `CLAUDE_CODE_SUBAGENT_MODEL` → parent. The changelog fixes a bug where `opusplan` overrode a subagent's own model. The `advisor` tool lets the main model consult a stronger one at decision points. Docs call it experimental; the model decides when to call it. | https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/model-config, https://code.claude.com/docs/en/advisor |
| **Cursor (editor)** | User picks, or Auto/Router. | Router: per request. Harness: stay on one model per conversation. | Subagent `model:` = `inherit` or an ID. Built-in Explore uses a faster model. The parent can name a model at launch. **Subagents start with a clean context.** | https://cursor.com/docs/subagents |
| **Cursor engineering** | – | – | Mid-chat switching has the new model inherit another model's history and tools (out-of-distribution). Caches are provider- and model-specific, so the first turn after a switch is slower and costlier. Summarising at the switch can lose details. "We generally recommend staying with one model… unless you have a reason". A subagent "starts from a fresh context window" and avoids this. | https://cursor.com/blog/continually-improving-agent-harness |
| **Cursor Router** | Classifier. | Per request, before the model runs. Based on query, context, task complexity and domain. | "UI work goes to price-efficient models, interface work goes to the model with the best taste". It counts cache-miss cost in its savings. Vendor claims: Intelligence mode ~60% cheaper at near-frontier satisfaction; early-access enterprises 30–50% savings vs all-top-model; $4.63 (Balance) / $6.76 (Intelligence) / $7.34 (all-Opus 4.8) per commit. Vendor numbers, not independently verified. | https://cursor.com/guides/model-routing |
| **Aider** | Config (`--model`, `--editor-model`, `--weak-model`). | Per phase, every message in architect mode. Architect proposes, editor writes the edits. | Two roles, two models. Every request runs both. | https://aider.chat/docs/usage/modes.html, https://aider.chat/2024/09/26/architect.html |
| **Cline** | User, in settings. | Per mode. Plan and Act each have a model, and the history carries over. | Switching modes switches models. Conversation history is kept. | https://docs.cline.bot/core-workflows/plan-and-act |
| **Roo Code** | Config. Each mode has a sticky model. | Per mode / subtask. | The Orchestrator mode (formerly Boomerang) calls `new_task` into a mode picked by `whenToUse`. Each subtask has **isolated context** and returns only a summary. | https://roocodeinc.github.io/Roo-Code/features/custom-modes/, https://docs.roocode.cn/features/boomerang-tasks |
| **OpenAI Agents SDK** | Code. `Agent(model=…)`. | Per agent. | A handoff transfers to an agent with its own model. The receiving agent sees the history unless an `input_filter` trims it. `RunConfig(model=)` overrides all agents. The triage agent picks *which* specialist, but each specialist's model is fixed. | https://openai.github.io/openai-agents-python/handoffs/, https://openai.github.io/openai-agents-python/models/ |
| **LangGraph supervisor** | Code. Each worker is built with its own model. | Per worker node. | `create_supervisor(model=…)` applies to the supervisor only. | https://reference.langchain.com/python/langgraph-supervisor/langgraph_supervisor/create_supervisor |
| **LiteLLM** | Gateway config. | Per call. Complexity router tiers SIMPLE / MEDIUM / COMPLEX / REASONING. | `auto_router/complexity_router`, a heuristic scorer or an LLM classifier. Aliases and fallbacks. | https://docs.litellm.ai/docs/auto_router/setup |
| **OpenRouter** | Gateway. | Per request. | `openrouter/auto` picks the model and reasoning effort from task type, difficulty, cost and cache. | https://openrouter.ai/docs/guides/routing/routers/auto-router |
| **Anthropic Research** | Code. The lead (Opus 4) and the subagents (Sonnet 4) are fixed. | Per task. The lead decomposes. | Lead + parallel subagents. It beat single-agent Opus 4 by 90.2% on their internal research eval. | https://www.anthropic.com/research/multi-agent-research-system |
| **Manus** | Code. | Per sub-task. | Wide Research launches full agents with a fresh, empty context. Sub-agents never talk to each other. KV-cache hit rate is "the single most important metric". Don't change tools or prefix mid-loop. | https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus, https://manus.im/blog/manus-wide-research-solve-context-problem |
| **Devin / Cognition** | Documented only as an argument for a single-threaded agent with shared context, plus a separate model that compresses long histories. The sources do not describe a separate "coder model". Manus agrees with them on that point. | – | – | https://cognition.com/blog/dont-build-multi-agents |

**Pattern.** The role-to-model map is static config or code. Every system that varies the model within a conversation either flags the penalty (Cursor, OpenHands, Manus) or makes it opt-in. Where the model chooses whether to escalate (advisor, `switch_llm`, `route_task_to_model`), cheap models under-call the tool. That matches our 0 calls.

**Note on the claim that Cursor favours one model per conversation.** Both halves are true. Cursor's *Router* does route per request, and it prices the cache misses in. Its *harness blog* recommends staying on one model and using subagents with fresh contexts for deliberate model changes.

---

## 3. John's audit questions, answered

1. **Native router vs custom rules?**
   - OpenHands native: a classifier plus an editable prompt/model table, exposed as an agent-callable tool. Disabled on our install.
   - Custom: our runner has hand-written keyword rules (`needs_opus_plan`, `MODEL_PROFILES`). They are advisory.
   - Recommendation: custom code rules, borrowing OpenHands' *table format* (task class → owner profile → measured score and cost).
2. **Decisions per task, per phase or per call?**
   - OpenHands router: per invocation (the first message, or per step if the agent asks).
   - Cursor: per request for Auto, per conversation otherwise.
   - Others: Claude Code per subagent or phase; Aider, Cline and Roo per phase or mode; OpenAI and LangGraph per agent; LiteLLM and OpenRouter per call.
   - Our right answer: **per piece of work, at its start.**
3. **Do switches cause context replay and cache loss?**
   - **Yes.** I read `_replace_agent_llm`: it swaps `agent.llm` and the condenser only. The full event history is re-sent to the new model. The new model's prompt cache is empty.
   - OpenHands, Cursor and Manus all say this. The Cursor cost-accounting claim is theirs.
   - Our runner also notes switching broke per-model cost metrics.
4. **Do subagents inherit the parent model?**
   - OpenHands `task`: **yes by default** (`model: inherit`). A named profile overrides it.
   - Our `helper`: inherits the parent unless `--model` is given.
   - Our `job start`: hard-coded Haiku, even if the parent were Opus.
   - Claude Code and Cursor: default inherit; the `model` field overrides it.
5. **Is visual craft recognised as its own requirement?**
   - OpenHands router: **no.** Its benchmarks have no design or motion category.
   - Cursor Router: **yes.** It names UI work and "interface work goes to the model with the best taste".
   - Ours: partly. We have a visual-source rule but no *routing* class. We define it ourselves (§4).
6. **Can Opus own implementation?**
   - **Yes.** A conversation created on `lab-opus` has the same tools (terminal, file_editor, browser) as any other.
   - The runner already does this for `--model opus` helpers and for routines. Nothing prevents using it for visual jobs.
   - A native option: a `task` sub-agent definition with `model: lab-opus` and the same tool list.
7. **Are compaction and skill instructions preserved across switches?**
   - In OpenHands, the event history stays. Skills and `AGENTS.md` loaded as events stay with it. The condenser is replaced with one for the new model (`_condenser_for_switched_llm`). So summaries are written by the new model from the old model's history.
   - Cursor warns a summary at the switch can lose details.
   - With a **fresh-context handoff** nothing is preserved implicitly. The brief has to carry the skills, plan, assets and constraints on purpose. That is a strength: it is explicit and testable.
8. **Per-model and per-subagent cost attribution?**
   - OpenHands: per `usage_id` metrics, and each sub-agent gets `reset_metrics()`. A conversation created on the target profile records them. A conversation switched afterwards can lose them (our comment).
   - Our runner: `cost_and_models()` and `/opt/agent/workspace/runs/cost/*.json`. `opus-step` calls land in `usage.jsonl`.
   - A separate worker conversation per owner model gives clean per-model and per-piece cost. In-place switching does not.
9. **Is outcome feedback possible?**
   - Not natively in OpenHands. Its router is a static prompt tuned offline.
   - Cursor does it: satisfaction, keep rate, cost per commit.
   - We can: `runs.db` already has per-run cost and status. `agent_verify` PASS/FAIL (578 calls) and `step-failures.jsonl` exist. John's rework messages are a signal.
   - Proposed table: task class × owner model → cost, verify result, rework count. Edit the router rules from that.

---

## 4. Diagnosis and recommended design

### 4.1 Why "cheap main agent + advisory/guard tools" fails

1. **The cheap model is the entry point.** The user request lands in a Haiku conversation. The only way Opus gets involved is if Haiku decides it should. Haiku's tendency is to do the work itself.
2. **Guards check form, not intent.** `agent-guard` can block `.tsx`. It can't recognise "make an animation" done in PIL.
3. **Native "switch" mechanisms are model-called.** `switch_llm` was called 0 times. OpenHands' own feature map shows a cheap model skipping `route_task_to_model` when its prompt conflicts. Cursor and Claude Code's `advisor` are the same: advisory.
4. **Switching in place is the wrong tool anyway.** The history is replayed, the cache is cold, and the new model reads another model's out-of-distribution transcript.

### 4.2 The standard pattern (hypothesis check)

**Confirmed:** a coordinator, code or an LLM, creates the work item. At creation the **owner model is bound by config** (agent definition, mode, node, profile). The owner runs in its own conversation with a fresh context and a written brief. The owner returns a summary and artifacts.

**Refinement.** Who *chooses the role* can be a model. What matters is that the owner binding has consequences the cheap model can't skip. Two ways to make that safe:
- **Code starts the work in the owner** (preferred). The classification happens at spawn, from the user's request, and nothing is left for Haiku to forget.
- **Reverse the delegation direction.** An Opus owner delegates *mechanical* work *down* to Haiku sub-agents. If Opus forgets to delegate, we pay more but quality is intact. If Haiku forgets to delegate *up*, quality fails. Quality should never depend on the cheap model's discipline.

### 4.3 Recommended design

- **Orchestrator** (code in the runner, with the existing Opus plan step for ambiguous briefs) turns a request into work items. Each item has an owner profile.
- **Owner table** (editable, in the OpenHands model-table style):

  | Work class | Owner | Reason |
  |---|---|---|
  | visual-build: motion graphics, scene code, Remotion/HyperFrames, front-end pages, CSS/layout | `lab-opus` (or a Fable profile for the A/B test) | John's rule: Opus writes visual code |
  | visual-judge | Opus judge step (existing `opus-step`) | already working |
  | research, downloads, ffmpeg recipes, file ops, renders, form fills | `lab-anthropic` (Haiku) | mechanical |
  | plan for big or fuzzy briefs | Opus plan (existing) | works |

- **Owner starts in a fresh context.** The worker is created on its profile with: the brief, the plan (`log/opus-plan.md`), asset paths and the timeline. It writes the code, renders and checks its own work, then returns paths and a result. Haiku never "hands a draft" to Opus.
- **Native pieces to use:**
  - (a) `POST /api/conversations` with the profile applied at creation. The runner already does this via `run_agent_settings`, so use it.
  - (b) File-based sub-agent definitions (`~/.openhands/agents/visual-builder.md` with `model: lab-opus`, and `mechanic.md` with `model: lab-anthropic`) plus enabling the `task` tool. Use them for an Opus-owned run delegating *down*, or for in-run side tasks.
  - (c) Copy the meta-profile table shape for the owner table. Don't enable `route_task_to_model`.
- **Verification gate (not a guard):** before a video job can finish, check that the visual source files and render script came from an Opus conversation (events show the file_editor/terminal actions and their model). Fail the job and respawn the worker on Opus if not.
- **Same shape for the Fable test.** Add a `lab-fable` profile, then run the identical brief through the same owner path with a different profile. Compare cost, steps, tokens, time and quality per worker.

### 4.4 Cost and cache math (list prices, Anthropic docs)

Prices per million tokens (https://platform.claude.com/docs/en/about-claude/pricing):

| Model | Input | Output | Cache write (5 min) | Cache read |
|---|---|---|---|---|
| Haiku 5.5 (≤100K prompt) | $0.10 | $0.50 | $0.125 | $0.01 |
| Haiku 5.5 (>100K) | $0.50 | $2.50 | $0.625 | $0.05 |
| Opus 5.5 | $4 | $20 | $5 | $0.20 |
| Fable 5.2 | $8 | $40 | not found (I assumed $10) | $0.20 |

Opus is about 40× Haiku on input and output, and 20× on cache reads.

**Model of one conversation.** Brief of 6K tokens, +1.2K tokens of context per turn, 700 output tokens per turn, 90%+ of input served from cache. This is my own arithmetic.

| Turns | Haiku | Opus | Fable |
|---|---|---|---|
| 30 | $0.02 | $0.77 | $1.40 |
| 50 | $0.04 | $1.38 | $2.41 |
| 80 | $0.08 | $2.48 | $4.11 |

Fable lands at roughly 1.8× Opus, not 2×, because its cache read price equals Opus's. John's point about fewer turns matters: Fable only wins if it needs about 45% fewer turns than Opus.

**Calibration to measured runs.**
- The Haiku-only Dean vs Ray J baseline cost $0.41 Haiku plus $0.30 Opus (1 plan, 6 judges) = **$0.71**.
- The pure formula under-states real Haiku runs by roughly 10×, because the real contexts are bigger and bash-heavy. Use ratios, not the formula, for planning.
- From `research/premium-doc-diagnosis.md`: an all-Opus documentary was $4.17 against $0.625 for Haiku, about 6.7×.
- A realistic **Opus-owned visual build is about $1–3**. It was $0.45 for the helper in the failed attempt, where Haiku wrote the code.
- **Per video:** about $0.4 Haiku + $0.3 Opus plan/judge + $1–3 Opus build ≈ **$1.7–3.7**, against $0.71–1.10 now. Roughly 2.5–5× more per video. With Fable the build step is about $2–5.5.

**What a mid-conversation switch costs** (history H, Haiku → Opus):
- 30K: $0.15. 60K: $0.30. 100K: $0.50. For Fable, double those.
- A fresh 6K-token handoff costs **$0.03**, about 10–17× cheaper, with a clean transcript.
- Staying on Opus costs only the cache read: $0.012 at 60K.
- Six ping-pong switches at 60K add about $0.90 of pure cache waste, and the cache is rebuilt every time.
- A switch also runs Haiku past its 100K price tier sooner, and at that tier input is 5× dearer.

**Weekly cap (<20%).** I can't convert dollars to your plan percentage. I don't have the base figure for that cap, and I did not call the usage tool. The practical levers are:
- Only visual-build work goes to Opus. Everything else stays on Haiku.
- Set `max_iteration_per_run` and `max_budget_per_run` on the Opus worker. Both are supported fields.
- Keep the condenser on a cheaper model, or off, for the Opus worker.
- Before scaling, run one Opus and one Fable pass on the same brief. That gives the per-video number to hold against the cap.

---

## 5. Plan and effort (hours)

| # | Step | Hours |
|---|---|---|
| 1 | **Server-side owner selection at job start.** Replace `model=R.DEFAULT_PROFILE` in `jobcli.py:88` with a `route_owner(task)` function: keyword and file-type rules, plus the opus plan classification. Visual jobs start on `lab-opus`. Test on a tiny job. | 2–3 |
| 2 | **Piece-wise pipeline.** The Opus plan emits work items with an owner. The runner spawns Haiku workers for research and download, then an Opus worker for the visual build and render, with the brief and artifacts passed via files. Roll up cost per worker in the existing cost JSON. | 3–4 |
| 3 | **Verification gate.** Reject visual outputs not authored by an Opus conversation, using event model attribution. | 1–2 |
| 4 | **Native sub-agents.** Add `visual-builder.md` (lab-opus) and `mechanic.md` (lab-anthropic), enable `task` for Opus-owned runs. Check metrics and condenser. | 1–2 |
| 5 | **Fable profile and A/B harness.** Add `lab-fable`, run the same brief once as Opus and once as Fable, and log per-worker cost, steps, tokens, time and a quality review. | 1–2 |
| **Core total** | | **8–12** |
| 6 | **Outcome feedback (optional).** Persist class × owner × cost × verify × rework in `runs.db`. Use it to tune the table. | 4–6 |

**Risks.**
- Opus-owned jobs cost 2.5–5× more per video. Mitigate with the Haiku-for-mechanical split and the budget fields.
- A fresh context needs a good brief. The Opus plan step already produces one.
- Nothing here removes the existing helper/PIL path. The gate is what catches a bypass.

**Not recommended:** enabling `route_task_to_model`, or relying on `switch_llm`. They are model-called, switch in place and lose the cache.

---

## 6. Evidence and caveats

- **Verified directly:**
  - SDK 1.63.1 source, read from the PyPI wheels in `/workspace/ohsdk/src/`.
  - Live endpoint list, from the server's `openapi.json`.
  - Our runner and tool code: `agentd.py`, `jobcli.py`, `runlib.py`, `settings.json`.
  - 204 conversations in `/opt/agent/workspace/conversations`. Tool-name counts: terminal 23,208; agent_view 1,341; file_editor 1,056; switch_llm 0; task 0.
- **Verified from official docs and blogs (fetched today):** OpenHands blog and docs, Claude Code docs, Cursor docs, blog and guide, Aider, Cline, Roo, OpenAI Agents SDK, LiteLLM, OpenRouter, Manus, Anthropic Research, Anthropic pricing.
- **Taken from vendor sources, not independently confirmed:**
  - The Cursor savings numbers.
  - The Microsoft Azure study and the 4.88× figure, as quoted by OpenHands.
  - OpenHands' benchmark values (they match the post exactly, but they are OpenHands' own numbers on coding tasks).
- **Not verified:**
  - Fable 5.2 cache-write price.
  - Callers of `switchConversationModel` beyond the PR file list and the three files I read.
  - Whether the OpenHands `/model` command exists outside Agent Canvas.
- Local copies: `/workspace/ohsdk/src/` (SDK source), `/workspace/smsfiles/` (sms files).
