# Haiku 5.5 vs Opus 5.5: routing for a general AgentLab agent

Researched 2026-11-24, evening ET. Read-only. No server changes. AgentLab is a general personal/work agent, not a video-only bot. This note covers the work that kind of agent actually does.

**Models in use** (live `oh-home`, confirmed this turn): default `lab-anthropic` = `anthropic/claude-haiku-5-5`, `reasoning_effort=low`, `max_input_tokens=200000`. Escalation profile `lab-opus` = `anthropic/claude-opus-5-5`, `reasoning_effort=low`. Both cache prompts and use native tool calling.

**Compaction:** the tight 55K/64K conversation compression was rolled back on 2026-11-24. The runner now condenses only at an emergency backstop of ~190K real prompt tokens (`HAIKU_CTX_BACKSTOP`). The event-count condenser `max_size` is 2000 so it does not fire earlier. Do not build routing around “critic after compaction.” If the 190K backstop ever fires, treat it like any other long-job failure: pin the definition of done and escalate the current hard step if needed.

**How to read gaps.** Official Anthropic numbers are at **max** effort unless noted (Opus Terminal-Bench 4.0 is **xhigh**). AgentLab currently runs both models at **low** effort, so real gaps may be as large or larger. Haiku’s GDPval-AA v2.1 Elo is 1620 at max and **1277 at medium**, the API default ([Haiku 5.5 System Card](https://assets.claude.com/e1080d6bf5ae2018ea3c2f414064be03232f5be5.pdf) §8.10.2). Do not mix OSWorld 2.0 with 2.1, or Chartography with-tools with no-tools. tau-bench and MMMU are **not reported** for this pair in the 5.5 cards; they are marked unknown, not estimated.

Price context: Haiku 5.5 is $0.10 / $0.50 per MTok in/out up to 100K ($0.01 cache read), 5× above 100K; Opus 5.5 is $4 / $20, cache reads $0.20 ([Haiku launch](https://www.anthropic.com/claude-haiku-5-5), [Opus launch](https://www.anthropic.com/claude-opus-5-5)). Our 12 short AgentLab tests cost $0.109 on Haiku vs $3.33 on Opus, about 3%.

Anthropic’s positioning: Haiku is for high-volume, cost-sensitive work, “pairs well with Opus 5.5 … as a subagent on coding work,” and is “especially well” suited to speed-sensitive “browser use.” “Sonnet 5.5 and Opus 5.5 remain better choices for complex agentic coding tasks like those measured by Terminal-Bench 4.0.” The selection matrix puts “vision-heavy workflows, computer use,” “multihour autonomous coding,” and “complex systems engineering” on Opus, and “subagent tasks” on Haiku ([Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)).

---

## 1. Routing table

| Task category | Route | Evidence | Source |
|---|---|---|---|
| **Web research and synthesis** | **Haiku OK** to search, fetch, and extract with sources. **Opus** to resolve conflicts or write the conclusion when the answer is high-stakes. **Never let Haiku answer factual questions from memory.** | Closed-book factual recall is a large, independently measured gap: Epoch AI SimpleQA Verified (1,000 short facts, max effort, anti-abstention prompt) is Haiku **23.8%** vs Opus **72.2%** (**−48.4 pts**). That is closed-book, not “search the web.” With tools, ordinary lookups work: our Nano Banana price/id test passed and matched the live page. Expert reasoning still trails: Humanity’s Last Exam no-tools **45.9% vs 64.4% (−18.5)**; with tools **57.4% vs 67.7% (−10.3)**. OfficeQA / OfficeQA Pro (grounded docs, max, 5-run mean): **73.5% / 60.3%** vs **78.9% / 67.7%** (**−5.4 / −7.4**). Anthropic’s own example: a bigger model builds the deck; a Haiku subagent “goes into the 10-K and pulls the segment revenue line.” | [Epoch SimpleQA Verified](https://epoch.ai/benchmarks/simple-qa-verified); [14-tests](haiku-vs-opus-14-tests.md); Haiku card Table 8.1.A, §8.10.1; [Opus card](https://assets.claude.com/fc1b44717c85dc068bc6ba5024219938094694bd.pdf) Table 8.1.A, §8.14.1; [Haiku launch](https://www.anthropic.com/claude-haiku-5-5) |
| **Shopping and price comparison** | **Haiku with a check** (browse, quote the page, don’t recall a price). **Opus** if the job is “which of these is actually the better buy?” | No dedicated shopping benchmark found. Closest evidence: SimpleQA shows Haiku must not invent prices or product facts; our live price lookup passed; computer-use skill is mid-pack (OSWorld row). Success check = prices and SKUs copied from the page, plus a screenshot or URL. | Epoch SimpleQA; 14-tests #3; OSWorld below |
| **Travel and booking** | **Haiku with a check** for search and routine booking flows. **Opus** (or escalate) for multi-leg, recovering from a broken flow, or a final “book this” confirmation. | No dedicated travel benchmark found. Proxies: OSWorld 2.1 offline and our form-fill test (both below). Confirm times, prices, and names against the site before paying or saying it’s booked. | OSWorld; 14-tests #6 |
| **Email and message drafting** | **Haiku OK** for internal or routine notes. **Opus** for customer-facing, delicate, or high-stakes messages. | No head-to-head email benchmark with a cited percentage. Opus launch: testers found its writing “clearer and easier to follow.” Our recap-page test met the spec but reused wording from an earlier page rather than writing originally. | [Opus launch](https://www.anthropic.com/claude-opus-5-5); 14-tests #12 |
| **Documents, spreadsheets, and slides** | **Haiku OK** for straightforward sheets and structured docs. **Opus** for client-facing decks, full financial models, and polished leave-behind work. | Our Q1 budget Excel test passed (formulas correct). Vals AI Excel Modeling Benchmark v1.1 (financial models, 19 Nov 2026): Haiku **65.48%** vs Opus **75.84%** (**−10.4 pts**). GDPval-AA v2.1 (documents, slides, diagrams, spreadsheets; Elo): **1620 vs 1846**. AA-Briefcase v1.1 (long-horizon knowledge work): **1578 vs 1822**. Anthropic customer quote: the bigger model builds the deck. | 14-tests #4; [EMB v1.1](https://www.vals.ai/benchmarks/emb-v1-1); Haiku card §8.10.2; Opus card Table 8.1.A; Haiku launch |
| **Data analysis and charts** | **Haiku with a check** if it can measure with tools. **Opus** to design the chart or to read one without measurement tools. | Chartography (max): no tools **46.4% vs 64.4% (−18.0 pts)**; with crop/code tools **86.2% vs 89.0% (−2.8 pts)**. Haiku can *measure* a chart if it uses tools; aesthetic design and unaided reading lag. | Haiku card §8.9.1; Opus card §8.13.1 |
| **Coding: small scripts** | **Haiku OK** | Our Python slugify CLI passed, including `--strict` exits. SWE-bench Multilingual: **83.7% vs 93.9% (−10.2 pts)**. | 14-tests #5; Haiku/Opus cards §8.2 |
| **Coding: apps, refactors, hard debugging** | **Opus required** (or escalate the stuck step) | Terminal-Bench 4.0: Haiku **39.2% ±1.9** vs Opus **66.4% ±2.6** (**−27.2 pts**). Same card reports Sonnet 5.5 at 70.6% at max; the Opus figure is xhigh. SWE-Bench Pro: **64.8% vs 89.9% (−25.1)**. FrontierSWE v2 (20-hour tasks, same harness, max): **43.8% vs 62.3% (−18.5)**. Terminal-Bench-Science 0.1: **20.6% vs 58.7% (−38.1)**. Anthropic: do not use Haiku as the lead on TB-4.0-like work. | Haiku card §8.2, §8.4–8.6; Opus card §8.2, §8.5, §8.7; Haiku launch |
| **Coding from a screenshot or mockup** | **Opus required** | SWE-bench Multimodal (screenshots and design mockups): **30.7% vs 61.4% (−30.7 pts)**. Largest official coding gap. | Haiku/Opus cards §8.2 |
| **DevOps and server ops** | **Haiku with a check** for routine commands (install, restart, read logs). **Opus** for incident diagnosis, unfamiliar failures, or changes to AgentLab itself. | No official IT/SRE *incident* score was found for both models on the same board. Closest official proxy is Terminal-Bench 4.0 (**−27.2 pts**), which is hard CLI/agentic work. A Vals board named “SRE Bench” is reverse-engineering of protected binaries, not site-reliability work, and is not used here. | Haiku card §8.4 |
| **Browser automation and form filling** | **Haiku OK** with a success check | Our httpbin form fill passed, in 31s vs Opus 432s. Anthropic explicitly recommends Haiku for speed-sensitive browser use. Confirm submitted field values from the response or page. | 14-tests #6; Haiku launch |
| **Computer use of GUI apps** | **Haiku with a check** for routine desktop flows. **Opus** for long, novel, or recovering-from-surprise UI. | OSWorld 2.1 **offline subset**, same conditions, max: Haiku **72.4% partial / 37.1% strict** vs Opus **87.2% / 53.2%** (**−14.8 / −16.1 pts**). Anthropic’s matrix still lists “computer use” under Opus. Do not compare these to the Opus launch “OSWorld 2.0 81.8% partial” figure. | Haiku card §8.9.3; Choosing the right model |
| **Sign-ins and captchas** | **Haiku with a check** for ordinary logins. **Opus** (or a dedicated solver) if a visual captcha or a refusal blocks a legitimate sign-in. | capbench.ai, high thinking: Haiku solved **55.94%** of 699 private captchas (391/699, 8 Oct 2026). Opus solved **82.65%** of 732 (605/732, 12 Nov 2026). The later set was extended, so totals are not a perfect head-to-head; on the same 112 reCAPTCHA items Haiku was **68.75%** and Opus **98.21%**; on the same 126 hCaptcha items **76.98% vs 94.44%**. Over-refusal: see safety row. | [Haiku capbench](https://capbench.ai/models/anthropic-claude-haiku-5.5); [Opus capbench](https://capbench.ai/models/anthropic-claude-opus-5.5) |
| **Scheduling and routines** | **Haiku OK** | Our 9 AM ET reminder test passed (routine created at the right time). No contrary benchmark found. | 14-tests #2 |
| **Summarizing long docs and PDFs** | **Haiku OK** for summaries and extraction. **Opus** if the output is a decision or advice, not a digest. | Stated Haiku use case: summaries, compactions, classification, “Ask in Document.” Invoice PDF line items were exact. OfficeQA gap is modest (**−5.4 / −7.4 pts**). Box: Haiku scored 11 points higher than Haiku 4.5 on their document suite, at about half the latency. | Haiku launch; 14-tests #1; OfficeQA above |
| **Math and finance calculations** | **Haiku OK** for arithmetic, invoices, and simple budgets (verify in code or a spreadsheet). **Opus** for hard or research-level math and full financial models. | Invoice totals and the Q1 budget sheet passed. Everyday competition-style math is close on some third-party boards, but Epoch AI FrontierMath (models can run Python) is not: Tiers 1–3 (v2) **~75% vs ~91%**; Tier 4 (v2) **~46% vs ~95%** ([Haiku](https://epoch.ai/models/claude-haiku-5-5) and [Opus](https://epoch.ai/models/claude-opus-5-5) model pages; Epoch rounds these). EMB v1.1 financial modeling **−10.4 pts** (above). | 14-tests #1, #4; Epoch FrontierMath; EMB v1.1 |
| **Legal and contract reading** | **Haiku with a check** for a first pass and issue spotting. **Opus** for a research memo or anything that will be relied on; a person should still review. | Vals AI Legal Research Bench (US legal research, all-pass, 19 Nov 2026): Haiku **43.75%** vs Opus **50.48%** (**−6.7 pts**). Modest gap, and neither score is high enough to treat as finished legal advice. | [Legal Research Bench](https://www.vals.ai/benchmarks/legal_research) |
| **Translation** | **Haiku OK** for everyday translation. **Opus** for high-stakes, literary, or low-resource work if quality matters. | Official, same setup, max, no tools: GMMLU (42 languages) **87.8% vs 94.3% (−6.5 pts)**; MILU (11 Indic + English) **87.6% vs 93.1% (−5.5 pts)**. These are knowledge-in-language tests, not a dedicated translation eval, but they are the official multilingual numbers. | Haiku card §8.12.1–8.12.2 (Opus figures taken from its card, as stated there) |
| **Image-generation prompting** | **Opus required** | No official “prompt quality” benchmark was found for this pair. This is visual creation: Chartography and Anthropic’s own “graphics and polish” report (Opus launch, game-from-a-prompt tester) are the nearby evidence. Haiku may run the image API once the prompt is written. | Opus launch; Chartography above |
| **Video and audio work** | **Haiku OK** for mechanical steps (trim, export, transcribe, burn captions, loudness) once the recipe exists. **Opus** to design, cut, or judge the piece. | Short AgentLab tests: transcribe + title card, captions rule, and trim/export all passed on Haiku. Creative direction and visual QA still belong on Opus (see visual/create rules). A longer film job on Haiku can meet a tech spec and still miss a qualitative brief; that is a satisficing problem, not a reason to route all video to Opus. | 14-tests #7, #9, #11 |
| **Customer-facing writing** | **Opus required** | Same evidence as email: no percentage, but this is the use case Anthropic and testers praise Opus for, and our Haiku page reused old wording. | Opus launch; 14-tests #12 |
| **Planning multi-step tasks** | **Haiku OK** for a short, well-specified job. **Opus** as lead planner on a complex or ambiguous job; Haiku executes the steps. | Anthropic and Devin: Opus (or a frontier lead) plans, Haiku is the sidekick/subagent. Devin Fusion: “Haiku 5.5 as the sidekick … Opus 5.5 as the lead.” Choosing-a-model: Opus for “multihour autonomous coding agents.” | Haiku launch (Devin quote); Choosing the right model; [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) |
| **Tool-calling reliability** | **Unknown** as a named tau-bench score. Treat hard multi-step tool work as **Haiku with a check**; escalate on loops. | No tau-bench number for either 5.5 model in the system cards or launch pages. Best published proxies: Terminal-Bench 4.0 (**−27.2 pts**) and OSWorld 2.1 strict (**−16.1 pts**). Short tool jobs in our suite (form fill, reminder, memory, shell) passed. | — |
| **Agentic long-horizon tasks** | **Opus** as lead on long or open-ended jobs. Haiku as executor of bounded steps. | FrontierSWE v2 **−18.5 pts**; Terminal-Bench 4.0 **−27.2 pts**; AA-Briefcase **1578 vs 1822**. ProgramBench (long-context *coding*, 166 tasks): **82.0% vs 91.2% (−9.2 pts)** — a relative Haiku strength; it even beat Sonnet 5.5 (79.7%) on that set. Long context itself is not the main failure mode. Satisficing and dropping qualitative constraints on a long fuzzy brief is. | Haiku card §8.6, §8.7.1; Opus card §8.7; AA-Briefcase in both cards |
| **Safety and over-refusal** | Default **Haiku**. If it refuses a legitimate step, **retry that step on Opus**. | Haiku is the more conservative model, which is usually what you want. Single-turn harmful (API, no system prompt): harmless rate **98.39% vs Opus 94.28%**. Single-turn *benign* over-refusal (API): **0.17% vs 0%**; with a claude.ai-style prompt **0.82% vs 0.33%**. In the broader automated behavioral audit, “Claude Haiku 5.5 over-refused more than any other model we tested,” though it over-refused *less* than Haiku 4.5 on the single-turn benign set. No audit percentage is given in prose (figure only). Our title-card `look` QA was refused; Haiku used `agent_view` instead. Malicious computer-use refusal: Haiku **82.59%** vs Opus **79.46%** (higher is better). | Haiku card §4.1.1–4.1.2, §5.1.2, §6.2.2; 14-tests #10 |

---

## 2. Escalation rules

Default worker: Haiku 5.5. Hand **only the step that needs it** to Opus, then return to Haiku. Switch at a step boundary (new helper / `switch_llm`), not mid-call — mid-conversation switches break the prompt cache.

**Start on Opus (do not wait for failure):**

1. **Creating or judging anything visual** — graphics, motion graphics, image or video prompts, layout and typography, shot or cut choices, “does this look right?”, chart or slide *design*. Haiku may call the image/video API or run ffmpeg once the prompt or recipe exists.
2. **Code from a picture** — implement or fix UI, layout, or typography from a screenshot or mockup (SWE-bench Multimodal −30.7 pts).
3. **Hard engineering** — multi-file apps and refactors, unfamiliar failing tests after a first attempt, AgentLab/runner changes, hard CLI or DevOps incidents (Terminal-Bench / SWE-Bench Pro / FrontierSWE).
4. **Lead planning** on a complex or ambiguous multi-step job.
5. **Customer-facing or high-stakes writing** — emails to the outside, public pages, polished decks, VO or announcement copy.
6. **Conflict-heavy or expert synthesis** — “what should we conclude?”, not “find this quote and URL.”
7. **Hard or research-level math, and full financial models.**
8. **Legal research memos or contract advice that will be relied on** (still review with a person).

**Haiku does these without an Opus handoff:**

- Search, fetch, extract, summarize, invoices, simple spreadsheets, reminders, memory, translation of everyday text, simple scripts with tests.
- Browser form-fills and routine computer use, with an explicit success check (URL, field values, screenshot).
- Mechanical media: trim, export, transcribe, burn captions, loudness, once the recipe exists.
- Narrow subagent work: “pull this line from the 10-K,” “list matching files,” “run this test and return the failure.”
- Factual work only with sources open. Do not answer prices, dates, people, or product facts from memory (SimpleQA −48.4 pts closed-book).

**Minimal-step tripwire. Escalate just the current step to Opus when any of these fire, then hand back:**

- The same step fails twice (tool error, test red, render or booking broken, fetch exhausted), or a stuck/loop detector trips.
- A quality gate fails, or Haiku finishes early / offers to retry after admitting the brief was only partly met.
- Haiku **refuses** a legitimate step (audit: it over-refuses more than the other Claude models tested). Retry that step on Opus rather than arguing with the refusal.
- A visual captcha or a “does this look right?” check is the blocker.
- The user asked for premium, original, delicate, or public-facing work.

**Cheaper lever than Opus, for Haiku-class steps only:** raising `reasoning_effort` above the current `low` can close some gaps without a model switch (GDPval medium vs max is a documented drop). Do not use this as a substitute for the visual, legal-advice, or hard-engineering rules.

**Per-job override:** keep a way to pin a job to Opus, and log Haiku vs Opus spend separately.

The 190K emergency condensation, if it ever fires, is not a reason to change the default model. Pin the definition of done and escalate only if the current step is one of the Opus cases above.

---

## 3. Non-obvious cases that should be Opus (or an Opus step)

These are the ones easy to miss if you only think “visual work” and “Haiku is stuck”:

1. **Anything Haiku might answer from memory** — prices, people, dates, product specs, “who won X.” The closed-book SimpleQA gap is ~48 points. The fix is usually “search, then stay on Haiku,” not “switch models.” Switch to Opus when the job is to *judge* conflicting sources, not when it is to look a fact up.
2. **Code or UI fixes from a screenshot** (−30.7 pts). This shows up as “the button is clipped in this capture, fix the CSS,” not only as “draw a new graphic.”
3. **Hard debugging, apps, and refactors**, including changes to AgentLab. Short scripts are fine on Haiku. The published agentic-coding gap is 25–38 points.
4. **Lead planner on a complex or fuzzy job.** A cheap model as lead under-scopes. Opus writes the plan and the checklist; Haiku runs the steps.
5. **Over-refusal recovery.** Haiku is safer, and in the broad audit it over-refuses more than the other models tested. If a legitimate login, research, or vision step is refused, one Opus retry is the fix.
6. **Visual captchas and hard GUI recoveries.** Ordinary form-fill is a Haiku strength. Same-set reCAPTCHA was 68.75% vs 98.21%. Long or surprising desktop flows trail by 15–16 OSWorld points.
7. **Client-facing decks, financial models, and polished spreadsheets.** A simple budget sheet is Haiku. EMB v1.1 is 10 points back; GDPval/Briefcase also trail. “The bigger model builds the deck” is Anthropic’s own pattern.
8. **Unaided chart or screenshot reading** (Chartography no-tools −18 pts). If Haiku can crop or measure, the gap almost disappears; if the question is aesthetic or “what does this mean?”, use Opus.
9. **Public or delicate writing.** No percentage, but this is a stated Opus strength, and Haiku has already reused old wording on a page test.
10. **Hard math and research-level calculation.** Everyday arithmetic is fine (and should be checked in code). FrontierMath Tier 4 is a different league (~46% vs ~95%).
11. **Legal work product**, even though the official gap is only ~7 points — because 50% all-pass is not a finished memo.
12. **Satisficing on fuzzy briefs.** “Make it good” or “use your judgment,” without a checklist, is where a cheaper model stops early. Turn the bar into a checklist, or start the plan on Opus.

Not recommended: putting *all* computer use, *all* research, or *all* coding on Opus. Anthropic calls Haiku a good browser-use and subagent model, and our short tests agree.

---

## Sources

- Live AgentLab config, this turn, read-only: `root@204.168.139.158` `/opt/agent/oh-home/profiles/lab-anthropic.json`, `lab-opus.json`, `oh-home/settings.json`, and `/opt/agent/runner/agentd.py` (emergency backstop comment and `HAIKU_CTX_BACKSTOP`, default 190000). Compaction rollback note: `/opt/agent/backups/2026-11-24-compaction-rollback/ROLLBACK.md`.
- Anthropic: [Haiku 5.5 launch](https://www.anthropic.com/claude-haiku-5-5) (7 Oct 2026); [Haiku 5.5 System Card](https://assets.claude.com/e1080d6bf5ae2018ea3c2f414064be03232f5be5.pdf); [Opus 5.5 launch](https://www.anthropic.com/claude-opus-5-5) (22 Sep 2026); [Opus 5.5 System Card](https://assets.claude.com/fc1b44717c85dc068bc6ba5024219938094694bd.pdf); [Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model); [Claude Code subagents](https://code.claude.com/docs/en/sub-agents).
- Independent boards: [Epoch SimpleQA Verified](https://epoch.ai/benchmarks/simple-qa-verified); [Epoch Haiku 5.5](https://epoch.ai/models/claude-haiku-5-5); [Epoch Opus 5.5](https://epoch.ai/models/claude-opus-5-5); [Vals Legal Research Bench](https://www.vals.ai/benchmarks/legal_research); [Vals EMB v1.1](https://www.vals.ai/benchmarks/emb-v1-1); [capbench Haiku](https://capbench.ai/models/anthropic-claude-haiku-5.5); [capbench Opus](https://capbench.ai/models/anthropic-claude-opus-5.5).
- In-house short tests (not documentary-focused): [haiku-vs-opus-14-tests.md](haiku-vs-opus-14-tests.md).
