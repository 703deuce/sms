# How production agents structure and cache prompts and tools

Researched 2026-11-24 (read-only). No server or repo changes and no paid runs. Primary sources linked inline. Server facts are from a read-only look at AgentLab (OpenHands agent-server 1.63.1, image `transovo-agent:1.63.1-full`): one recent `SystemPromptEvent` and its 35 tool descriptions, plus `/opt/agent/oh-home` layout. No secrets or `.env` were read or printed.

This note answers how Claude Code, Anthropic, Manus, Cursor, Codex, OpenHands and others keep a stable cached prefix, then maps that onto AgentLab. John's constraint (t609u): cut cost without reducing accuracy. Pure cache savings with no behavior change are listed first. Every later change flags its accuracy risk, how production systems guard against it, and how we would test quality, not just spend.

Related: `haiku-default-lean-context.md`, `model-routing-production-agents.md`.

## AgentLab's starting point (measured)

Every job starts with a fixed prefix of about **40.8K real Anthropic tokens**: tools ~14K, OpenHands base system prompt ~6.5K (16,367 characters), Transovo `AGENTS.md` ~16.5K (42,044 characters, including "Your computer" at 10.9K characters), and a session-context message ~2K. Motion-studio skills add ~36K more when loaded. The runner now compacts Haiku at about 55–64K billed tokens. Within a job, cache-read rates on the final lean-context tests were about **91%**. Across jobs, the first call always **writes** the full 40.8K prefix (`cache_read` 0). That write is most of Opus's $0.20–$0.30 per-job floor.

Live layout on 1.63.1, which matters for the fix:

- Anthropic hashes requests in this order: **tools, then system, then messages**.
- Of 35 tools, **only `file_editor`** interpolates `Your current working directory is: /workspace/jobs/<conversation-id>` into its description. (An earlier note also named `terminal`. On this image, `terminal` does not include the path.) That single per-job string sits at the front of the hash, so no later stable text can be reused across jobs.
- The job path is **already repeated** in the first user message: "Your job folder for this conversation is `/workspace/jobs/<id>`. Work only inside it (plus /tmp)."
- The OpenHands static system block is the generic security / CodeAct prompt and has no job path or clock. The large Transovo `AGENTS.md` currently lives in `dynamic_context`, in the **same text block** as `<CURRENT_DATETIME>` (minute precision, e.g. `2026-11-24T22:32`). OpenHands's own docs say to put the clock last so the stable part can still be cached. Because it is one block, not two, `AGENTS.md` cannot be a cross-job cache hit even after the tool path is removed.
- Tool order on the inspected job was deterministic: `terminal`, `file_editor`, browser tools, `finish`, `switch_llm`, then the `agent_*` tools, then `fetch_fetch`.

Pricing used below is from Anthropic's current table ([prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [pricing](https://platform.claude.com/docs/en/about-claude/pricing)):

| Model | Uncached input | 5m cache write | 1h cache write | Cache read | Output |
|---|---:|---:|---:|---:|---:|
| Haiku 5.5 (≤100K) | $0.10 / MTok | $0.125 | $0.20 | $0.01 | $0.50 |
| Haiku 5.5 (>100K) | $0.50 | $0.625 | $1.00 | $0.05 | $2.50 |
| Opus 5.5 | $4.00 | $5.00 | $8.00 | $0.20 (0.05×) | $20.00 |

Cost of writing vs reading a 40.8K prefix once:

| | 5m write | 1h write | Read | Save vs a 5m write if the next job hits |
|---|---:|---:|---:|---:|
| Haiku 5.5 | $0.0051 | $0.0082 | $0.00041 | **$0.0047** |
| Opus 5.5 | $0.204 | $0.326 | $0.0082 | **$0.196** |

A 5-minute cache is refreshed on every hit. Cross-job reuse only happens if a second job starts before expiry, unless we set a 1-hour TTL on the stable prefix. Isolated jobs pay more for a 1-hour write (Opus +$0.12, Haiku +$0.003) and only come out ahead if another job lands inside the hour.

Minimum cacheable length is not a constraint for us. The API silently skips caching below a per-model minimum. Amazon Bedrock's table lists **512 tokens** for Haiku 5.5 and Opus 5.5 (4,096 for Haiku 4.5), with at most four breakpoints. Our prefix is far above that. [Bedrock prompt caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html)

---

## 1. How each system orders the prompt and loads tools

| System | Prompt order | Where dynamic per-session info goes | How tools / skills load | Cross-session / cross-user cache | Sources |
|---|---|---|---|---|---|
| **Anthropic API** | `tools` → `system` → `messages`. Place `cache_control` at the end of the stable prefix. Automatic caching can move a breakpoint forward as the conversation grows. Up to 4 breakpoints. 5m TTL default (1.25× write); optional 1h (2× write); reads are 0.1×, or 0.05× on Opus 5.5 / Sonnet 5.5. | Put anything that changes (time, cwd, request ids) **after** the breakpoint, ideally as a later message or a mid-conversation `role: system` message. Never edit the top-level `system` field mid-conversation. Do not add, remove, or edit tool definitions mid-conversation. | `defer_loading` keeps deferred schemas out of the prefix; the model discovers them with the tool-search tool and the definition is appended as a `tool_reference` in the history, so the cached prefix is unchanged. Send the same deferred list every turn. | Reuse is prefix-identical, byte for byte, and per model. A one-token change invalidates everything after it. Not shared across models. | [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [Tool use with prompt caching](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching), [Tool search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool), [Mid-conversation system messages](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages) |
| **Claude Code** | 1) Static system prompt and tool definitions (global). 2) `CLAUDE.md`, auto memory, unscoped rules (per project). 3) Conversation. Plan mode and skill bodies are appended as messages, not prefix edits. | Cwd, date, git status and other session facts sit after the stable layers. Updates go in the **next user message or tool result**, not a rewritten system prompt. Git status is a startup snapshot. | Always-on core tools. MCP tools are deferred by default (stubs + tool search) on supported models, including Haiku 5.5. Skills use progressive disclosure: name and description at start, `SKILL.md` body only when used. Subdirectory `CLAUDE.md` loads on demand. | High reuse within a session and across sessions that share the same system + tool set. `/compact`, `/clear`, model switches, effort-level changes (on older models), and mid-session tool-set changes break it. Compaction **forks** the parent prefix (same tools and system, compact prompt appended) so the summary call still hits cache. | [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching), [Lessons: prompt caching is everything](https://claude.dev/blog/lessons-from-building-claude-code-prompt-caching-is-everything/), [Skills](https://code.claude.com/docs/en/skills), [Steering Claude Code](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more) |
| **Manus** | Stable prefix with **no timestamps**. Append-only context. Deterministic serialization (stable JSON key order). KV-cache hit rate is "the single most important metric." | Clock and other volatile facts stay out of the prefix. Large observations go to the **filesystem**; the model gets a path and reads what it needs. | Do not add or remove tools mid-task (they tried RAG-style dynamic tools and walked away). Keep the full catalog and **mask** logits, or use `tool_choice` / prefill, so the schema never changes. | Designed for very high within-task cache hits (they cite ~100:1 input:output and the 10× Claude cache-read discount). Cross-user reuse depends on a shared prefix with no per-user volatile text at the front. | [Context Engineering for AI Agents](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) |
| **Cursor** | Stable tools and system instructions first. Explicit cache breakpoints after those layers (especially since GPT-5.6). Variable setup goes in a **"phantom user message"** (skills, subagents, environment). They trimmed ~66% of the system prompt as models improved. | Environment, skills and request-specific setup are after the breakpoints. Long tool output and terminal sessions are written to **files** for on-demand reads. Summaries point at a history file so the agent can recover details. | High-frequency tools (read, search, edit, shell) stay in the static prefix; rarer built-in tools load on demand. MCP tools are synced to per-server folders and only names go in the static prompt; the agent reads a tool's JSON when needed. Skills follow the Agent Skills standard (description static, body on demand). A/B test: **46.9%** fewer tokens on runs that called an MCP tool. These changes cut cold cache misses **20%**. | Strong within-conversation reuse once the prefix is stable. Cross-conversation reuse of tools + system when those layers do not change. They measure this in production traffic. | [Dynamic context discovery](https://cursor.com/blog/dynamic-context-discovery) (Jan 6, 2026), [Improved token efficiency](https://cursor.com/blog/improved-token-efficiency) (Sep 23, 2026) |
| **OpenAI Codex / Agents SDK** | `instructions` (stable, from a model prompt file or `model_instructions_file`) + `tools`, then `input` items: developer sandbox rules, optional developer instructions, aggregated `AGENTS.md` / skill metadata, an `<environment_context>` user message (cwd, shell), then the user request. | Cwd and shell live in `<environment_context>`, late in `input`. Mid-session cwd / sandbox / approval changes are **appended** as a new message, not a rewrite of the earlier one. | Tools are listed up front and must stay stable mid-conversation. Skills: short preamble + metadata in context; body on demand. | OpenAI caches a matching prefix automatically. `prompt_cache_key` helps route related requests to the same cache (less important on GPT-5.6+, which routes automatically). Changing tools, model, sandbox, approval mode, or cwd can miss. | [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/), [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) |
| **OpenHands (upstream)** | One system message, two blocks: (1) static `system_prompt` marked `cache_prompt=True` (identity, habits, safety, and in the documented presets AGENTS.md guidance); (2) `dynamic_context` left unmarked (repo, loaded skills, secrets, suffix, **datetime last on purpose**). `llm.py::_apply_prompt_caching` puts the Anthropic cache marker on index 0 so conversations can share the static block. | Working directory, host, datetime and other runtime facts belong in `dynamic_context` or `system_message_suffix`, **not** in the static text and **not** in tool descriptions. The CLI already puts cwd in `system_message_suffix`. Official advice: no `datetime.now()`, request id, sandbox id, or working directory in the static prompt. | Tools are declared up front. Several upstream tools still **append `working_dir` to the description at `create()`** (documented for File Editor, and historically Terminal, Grep, Glob). That is the cache leak we see. Skills can be loaded on demand. Condenser: `LLMSummarizingCondenser` (keep_first + summarize). No built-in tool-search / `defer_loading` and no observation-masking condenser in 1.63. | Designed for **cross-conversation** reuse of the static system block. Cross-job reuse of tools fails if any tool description is per-workspace. | [Custom system prompt](https://docs.openhands.dev/cookbook/custom-system-prompt), [Context condenser](https://docs.openhands.dev/sdk/guides/context-condenser), [SDK issue #2129](https://github.com/OpenHands/software-agent-sdk/issues/2129) (dynamic `working_dir` in tool descriptions) |
| **Cline / Roo** | Stable role, tool-use, capabilities, modes, skills and rules first; **System Info** (cwd, OS) later; custom instructions / `AGENTS.md` last. | Cline has historically repeated cwd in several early sections. Discussion #9823 proposes keeping cwd only in System Info so multi-user deployments share a KV-cache prefix. Roo follows a similar "system info then custom instructions" shape. | Tools generally loaded up front. Cache-control is applied for Anthropic-compatible providers. | Within a session if the prefix is stable. Cross-user reuse is weak today if cwd is in early sections; that is the point of the proposed reorder. | [Cline discussion #9823](https://github.com/cline/cline/discussions/9823), [Roo custom-instructions source](https://github.com/RooVetGit/Roo-Code/blob/main/src/core/prompts/sections/custom-instructions.ts) |
| **GitHub Copilot** | Fixed prefix of instructions, repo context and tool schemas; messages and tool results accumulate after it. | Task state sits in the growing conversation. Auto routing happens only at **cache boundaries** (first turn and after compaction) so a mid-thread model switch does not throw the cache away. | Tool search / deferred tools load schemas on demand, so a broad toolset does not have to sit in every turn. | High within-session reuse if model, reasoning settings and enabled tools stay put. Changing any of those mid-session is documented as a cache break that can cost more than it saves. | [Getting more from each token](https://github.blog/ai-and-ml/github-copilot/getting-more-from-each-token-how-copilot-improves-context-handling-and-model-routing/) |
| **Amp** | System prompt, tool definitions, `AGENTS.md`, environment data, then messages and tool results. | OS, current directory listing, open file and selection are added as environment data. | All tool definitions go in the system prompt. Skills: name and description first; full `SKILL.md` (and any skill-defined MCP tools) only when invoked. Threads can be handed off or referenced rather than endlessly grown. | Documented as a context-window product more than a cache-layout post. Treat cache specifics as not fully published. | [Context management](https://ampcode.com/guides/context-management), [Skills](https://ampcode.com/docs/customize/skills) |
| **Devin** | Internals are not published in comparable detail. Documented pieces: Skills (`SKILL.md`) with names/descriptions listed, body loaded when invoked and then kept for the rest of that session. | Not documented at the prompt-layout level. | Skills on demand. Routing and cache policy are not officially specified enough to copy. | Not enough primary documentation to claim a cache strategy. | [Devin Skills](https://docs.devin.ai/product-guides/skills) |

---

## 2. Common rules that actually work

These show up in the official posts, not just in commentary:

1. **Cache is a prefix match.** Tools, then system, then messages. A one-token change — a timestamp, a job id, a shuffled tool, a different JSON key order — invalidates everything after it.
2. **Static first, dynamic last.** Tools and long-lived instructions at the front. Cwd, date, git status, job folder, request ids at the end, in a later message or an unmarked system block. Update them by **appending**, never by rewriting the prefix. (Claude Code, Codex, Cursor's phantom user message, OpenHands `dynamic_context`, Anthropic mid-conversation system messages.)
3. **Do not change the tool list mid-conversation.** Claude Code keeps all tools and uses plan-mode tools plus a system message instead of swapping a read-only set. Manus keeps the catalog and masks. Anthropic's `defer_loading` adds definitions in the history, not by editing `tools`. Cursor considered tool search for MCP and chose files instead, but still leaves the static name list unchanged.
4. **Load detail on demand, keep a short index always visible.** Skills (Claude Code, Cursor, Amp, Devin, Codex): name + description in the prefix, body when needed. MCP / rare tools: stubs, tool search, or a folder of schemas. Long tool output: write to disk and return a path (Manus, Cursor, and OpenHands terminal truncation already leans this way).
5. **Deterministic serialization and a stable tool order.** Manus is explicit; Claude Code has broken the cache before by shuffling tools.
6. **Compact without throwing the prefix away.** Claude Code's compaction call uses the same system prompt and tools as the parent, and only appends the compact instruction. Afterward, rebuild from durable state rather than summarizing a summary. (Our runner already re-injects disk state; the 1.63 summarizer still folds summaries, which an image rebuild would be needed to change.)
7. **Do not switch models mid-thread just to save money.** Caches are per model. Copilot and Claude Code both treat mid-thread switches as a cache break; switch at start, after compaction, or via a sub-agent.
8. **Watch cache-write vs cache-read like an uptime metric.** Claude Code pages on a low hit rate. A 91% within-job hit rate is already good; our hole is the **cross-job write** of the same 40.8K prefix.

---

## 3. Mapping to AgentLab, ranked by savings vs accuracy risk

John's rule: cut cost without reducing accuracy. Rank is savings first among changes that do not change behavior, then higher-risk trims.

### A. Pure cache savings — no behavior change (do these first)

**A1. Take the job path out of the `file_editor` tool description.**

- **What:** Stop interpolating `/workspace/jobs/<id>` into the tool schema. Leave the executor's real cwd as that folder. The session-start message already states the job folder and says to work only inside it. Optionally add one stable sentence to the description, such as "The working directory is the conversation workspace; the exact path is in the session context."
- **Accuracy risk:** Very low, if and only if the path remains obvious in the early session message (it already is). The only failure mode is the model writing outside the job folder. Production guard: this is exactly how Codex (`<environment_context>`), Claude Code, Cursor (phantom user message), OpenHands's own docs, and the OpenHands CLI (`system_message_suffix`) already do it.
- **Expected cost effect:** Unlocks cross-job cache of the tool list plus the static system prompt, about **20.5K tokens**. If we also do A2, the shared prefix becomes about **37K** (tools + base prompt + AGENTS.md). On a second job that hits a still-live cache: about **$0.196** saved on Opus 5.5 and **$0.0047** on Haiku 5.5 per job versus today's full 40.8K write. That is the bulk of Opus's $0.20–$0.30 floor, which showed up as $0.23–$0.43 on the 12 short Opus tests ($3.33 total) versus $0.11 total on Haiku.
- **Native in 1.63?** No. Upstream still bakes `working_dir` into some tool descriptions at `create()` ([issue #2129](https://github.com/OpenHands/software-agent-sdk/issues/2129)). The conversation API cannot edit a `SystemPromptEvent` after the fact. This needs a small tool-definition patch and an **image rebuild** (or a custom `FileEditorTool` wrapper in the image). Hooks and the runner cannot safely rewrite the already-emitted tool list.
- **Risks:** Patch must not change executor cwd. Confirm no other tool grows a per-job string later (today only `file_editor` does).

**A2. Split `AGENTS.md` and the clock into two system blocks; cache the stable one.**

- **What:** Keep the Transovo `AGENTS.md` text byte-for-byte, but move it out of the same `dynamic_context` block as `<CURRENT_DATETIME>`. Either put it in the static / cached system block (where OpenHands's documented presets already place AGENTS.md guidance) or as its own cached system block, with the clock alone in the unmarked dynamic tail. Do not add timestamps, job ids, or user names to the cached text.
- **Accuracy risk:** None if the wording is unchanged. This is placement, not editing.
- **Expected cost effect:** After A1, this is what lets the remaining ~16.5K of `AGENTS.md` join the cross-job cache, taking the shared prefix from ~20.5K to ~37K. Combined with A1, the numbers in the table above apply in full. It also matches OpenHands's written reason for putting datetime last.
- **Native in 1.63?** Partially. Two-block system + "datetime last" is native, but our large AGENTS.md is currently stuffed into the dynamic block with the clock. Moving it may be possible through agent-context / prompt composition settings; if the server always concatenates them into one block, it needs a small SDK or image change.
- **Risks:** A one-character accidental edit of AGENTS.md while moving it would split the cache and could change behavior. Move as a verbatim copy and hash the text before and after.

**A3. Keep tool order and serialization deterministic; do not swap tools mid-job.**

- **What:** Freeze the current tool order. When we later add routing, do not add or remove tools on a running conversation; follow Claude Code (plan-mode tools + a message) or Manus (mask / `tool_choice`).
- **Accuracy risk:** None. Changing tools mid-job is what *causes* both cache breaks and "the model still mentions a tool that disappeared" errors.
- **Native in 1.63?** Yes, as long as we do not start mutating the tool list in the runner. No change required today; this is a design rule for the later router.

**A4. Optional 1-hour TTL on the stable prefix only, 5-minute TTL on the growing conversation.**

- **What:** After A1–A2, mark tools + static system + AGENTS.md with `ttl: "1h"` and leave automatic 5-minute caching on the conversation tail. Anthropic allows up to four breakpoints. Within a job, 5-minute entries already refresh on every call, so this is for **cross-job** hits when jobs are more than five minutes apart.
- **Accuracy risk:** None. Billing only.
- **Expected cost effect:** Pays off when a second job starts in the same hour (Opus save ~$0.196 after the higher first write). **Costs more** if jobs are isolated: Opus first write $0.326 vs $0.204. Turn this on only after the back-to-back test, and only if we regularly run more than one Anthropic job per hour. Haiku dollars are small either way.
- **Native in 1.63?** Unclear. Depends on whether the LLM layer / LiteLLM exposes `cache_control` TTL. May need a config flag or a small image change. Do not assume it is already 1 hour.

### B. Smaller prefix — real savings, real accuracy risk (do only after A, and only with quality tests)

**B1. Turn "Your computer" and other procedure sections into on-demand skills; leave a short always-on index.**

- **What:** Keep a 1–2K-character index in AGENTS.md ("before using the browser / ffmpeg / pages, load this skill"). Move the 10.9K-character "Your computer" detail, and later overlapping "How you work" procedure, into skills the agent already knows how to load with `agent_skill`.
- **Accuracy risk:** Medium. The model may skip the skill and then misuse a tool, or waste a turn loading it. This is the standard failure mode of progressive disclosure.
- **Production guard:** Claude Code, Cursor, Amp, Codex and Devin all keep **name + description** in the prefix and load the body only when needed. They do not hide the existence of the skill. Cursor also A/B tests quality, not just tokens. Never drop a HARD RULE into a skill without leaving the rule itself in the always-on text.
- **Expected cost effect:** About 4K tokens off the prefix if only "Your computer" moves; maybe 6–8K if overlapping procedure is deduplicated later. Prefix target from the earlier note: **~28–30K**, which gives Haiku ~65–70K of working room instead of ~55K, so fewer condensations and less skill re-read thrash. Within-job cache-read savings are small on Haiku (cents). The valuable effect is staying under the 100K price cliff (5× on Haiku) and leaving more room for the job itself.
- **Native in 1.63?** Yes for the mechanism (`agent_skill`, and skills already described as on-demand in AGENTS.md). The content move is an AGENTS.md / skill-file change, not an image rebuild. Sandbox first; this is a behavior change.

**B2. Split the motion-studio skills into per-step files; keep a short catalog always visible.**

- **What:** The main `motion-studio-production` SKILL.md alone is ~13K tokens; the set is ~36K. Split into step files (research, script, engines, render, captions, export) and load only the step in use.
- **Accuracy risk:** **Highest of the useful cuts**, and it hits the documentary, where quality is the product. A missed step file, or a mid-job condensation that drops a loaded skill, can produce a worse film even if the run "passes" on file specs.
- **Production guard:** Same index-plus-body pattern. After compaction, the runner should point back at the skill files (we already re-inject loaded-skill names). Compare the film to the current Haiku and Opus baselines, frame by frame, not just "a 30-second file exists."
- **Expected cost effect:** On documentary-class jobs this is the difference between starting work at ~77K (prefix + all skills) and starting much closer to the 28–40K prefix, with skills read as needed. That means fewer forced condensations on Haiku and less chance of crossing 100K. Dollar savings vary with how often skills are re-read today; the earlier docplan run thrashed skill reads after condensation.
- **Native in 1.63?** Yes (skill files + `agent_skill`). No image rebuild. Do not ship this without the documentary quality comparison.

**B3. Defer rarely used tools; do not delete them mid-job.**

- **What:** The earlier inventory suggested lazy-loading or dropping browser recording, storage, tab tools, `fetch_fetch`, and eventually `switch_llm` (~4–5K tokens). The safe version is **defer**, not delete: keep names (and, if we can, `defer_loading` stubs) in a stable order, and load full schemas when needed.
- **Accuracy risk:** Medium. The model may fail to find `browser_switch_tab`, recording, or `fetch_fetch` when a task actually needs them, or may invent a schema. This is why Manus abandoned mid-task tool RAG.
- **Production guard:** Cursor keeps read/search/edit/shell always loaded, defers only tools used in fewer than 20% of conversations, and watches **tool-call error rates**. Claude Code uses `defer_loading` stubs in the same order plus tool search; the advisor tool sits after the breakpoint so it can toggle without a break. We should not drop a tool from the list on a live conversation.
- **Expected cost effect:** ~4–5K off the prefix. Modest next to A1–A2 and B2.
- **Native in 1.63?** **No tool search / `defer_loading`.** Building it ourselves is a runner or image change, or a Cursor-style folder of schemas the agent reads with existing file tools (no new API, but the model must be told to look). Do not remove tools from the live list as a shortcut.

**B4. Shorten long tool descriptions or replace the OpenHands base prompt.**

- Lower priority. Accuracy risk is real (the model misses a parameter or a safety rule). Production teams that did this (Cursor's 66% system-prompt trim) A/B tested on live traffic as models got better. Not the first move. Replacing the 6.5K base prompt is a bigger change and can be done later with OpenHands's custom system prompt, leaving `dynamic_context` intact.

### What not to do

- Do not hand premium visual or hard engineering implementation to Haiku after Opus planned it (already agreed in the routing work; out of scope here).
- Do not compact mid-turn or switch models just to keep a job under 100K if that throws away a warm cache — measure first.
- Do not put a live clock, job id, or path back into tool descriptions or the static system prompt.

---

## 4. Safe test plan (sandbox first, then quality, not just cost)

**Phase 0 — sandbox only, A1 (and A2 if ready), no production default change.**

1. Build a sandbox image or a wrapped `file_editor` that omits the job path from the description, with the session message still naming `/workspace/jobs/<id>`.
2. Run **two tiny jobs back to back** on Haiku (a few cents; the earlier short Haiku tests were $0.005–$0.013 each). Then, if we try A4, a third job about 10 minutes later.
3. On each first call, record `cache_creation` (5m and 1h) vs `cache_read` vs uncached input, and the exact prefix size. Success for A1: the second job's first call **reads** most of the tools + static system (~20.5K) instead of writing 40.8K. Success for A1+A2: that read is ~37K. The first job should still write once. Confirm both jobs wrote their files under their own `/workspace/jobs/<id>` and not into each other's folders.
4. Cap at $0.50 for this phase, as in the lean-context verification.

**Phase 1 — accuracy, same 12 short tests plus the documentary.**

Rerun the **same 12 short tests** that already passed on Haiku ($0.11 total vs $3.33 on Opus), plus the documentary, first with A1–A2 only (behavior should match). Grade the outputs the same way as before: open the files, rerun the CLI, check the form, check frames, do not take the agent's word. Compare:

- Pass / fail / weak-pass against the current Haiku baseline (all 12 passed; one weak pass on the already-saved preference; title-card `look` refusal on Haiku is a known caveat).
- Output quality, not just presence: Excel formulas, slugify behavior, form timing, title-card image, recap page, invoice totals.
- **Documentary quality:** place the new film next to the current Haiku run and the Opus run, frame by frame. A cheaper film that looks worse is a fail under John's constraint.
- Job-folder discipline: every artifact under the correct `/workspace/jobs/<id>`.
- Tool-call errors and "skill not found / not loaded" counts, especially if B1–B3 are in the build.
- Cost and the cache-write / cache-read split, including whether any call crossed 100K.

Ship A1–A2 to production only if the 12-test pass rate is unchanged and the documentary is at least as good. Treat B1–B3 as a second sandbox cycle with the same accuracy bar; if a deferred tool or a skill miss shows up, keep that item always-on and take the smaller saving.

**Phase 2 — only after A is live and clean.** Consider A4 (1h TTL) if the job rate justifies it, then B items one at a time so a quality regression is attributable.

---

## Implementation snapshot

| Change | Accuracy risk | OpenHands 1.63 support | Likely implementation |
|---|---|---|---|
| A1 Job path out of `file_editor` | Very low (path already in session message) | Not a setting | Image patch / tool wrapper + rebuild |
| A2 Split AGENTS.md from the clock | None if verbatim | Two-block design exists; our placement is wrong | Agent-context / prompt composition, or a small SDK/image change |
| A3 Frozen tool order, no mid-job swaps | None | Native, as a rule | Runner / router policy later |
| A4 1h TTL on stable prefix | None (cost-only) | Unknown | LLM `cache_control` if exposed; else image |
| B1 "Your computer" → skill + index | Medium | Native `agent_skill` | AGENTS.md + skill files, sandbox first |
| B2 Split motion-studio skills | High (documentary quality) | Native skills | Skill files, then frame comparison |
| B3 Defer rare tools | Medium (tool not found) | No tool search / `defer_loading` | Image or file-based catalog; do not delete live tools |
| Observation masking / no "summary of a summary" | — | Not in 1.63 | Image rebuild; runner already re-injects disk state |

Nothing above is applied. The first production-safe move is A1 + A2 in a sandbox, then the 12 short tests and the documentary as a quality gate.
