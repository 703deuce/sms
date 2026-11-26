# AgentLab gap audit, Nov 26 (Hermes Agent, Grok Bot, Muse, Claude, ChatGPT)

Written Thu Nov 26, 2026, about 5:50 AM ET. Goal: tighten the core autonomous agent before any CRM/automation work. Emphasis: resilience (a route fails, switch to the next, and finish instead of giving up).

**How this was done.** Read-only. I cloned `NousResearch/hermes-agent` (main, Nov 26 01:29 -0800 commit) to `/workspace/gap26/hermes-agent` and read its code and docs. I read AgentLab's code, config and files on the server (`/opt/agent`, `ls`/`cat`/`grep`, one `docker inspect`). No probes, no test jobs, no site fetches, no spend, no secret values printed. For Muse, Claude and ChatGPT I used public docs and changelogs (links at the bottom). "Have" below means the code exists and I read it; I did not run it.

**Do not duplicate.** Another worker is building coding work, and routing/cache work shipped this week. I skip those.

## 0. Already built this week (verified by reading files, not re-listed as gaps)

Much of the old gap list is now closed, and several pieces were borrowed from Hermes:

| Built | Where on server | Hermes origin |
|---|---|---|
| Loop and stall guard (identical calls, A-B-A-B cycles, warn then halt) | `runner/loop_guard.py` | `agent/tool_guardrails.py` |
| Goal judge before finishing (done / continue / blocked) | `runner/goal_judge.py` | `hermes_cli/goals.py` |
| Post-job learning review (1 memory or pitfall per job) | `runner/learn_review.py` | `agent/background_review.py` |
| Past-conversation search | `tools/history-search` (indexed every 5 min by cron) | `tools/session_search_tool.py` |
| Batched browser scripts | `tools/browser-run` | browser_cdp |
| Own Chromium per job and helper | `tools/job-browser` | Hermes browser sessions |
| 3-tier fetch: direct, residential, mobile, with structured block detection and a browser hook that reloads blocked pages on a paid tier | `tools/egress/egresslib.py`, `blockdetect.py`, `chrome_hook.py`, `egress-fetch`, `readpage`, `mcp-fetch-egress` | none (own design) |
| Research ledger and fan-out search | `research-coverage`, `research-fanout` | none |
| Skill router and read-proof gate | `runner/skill_gate.py` | none |
| Doc check before handoff, video digest, evidence screenshots | `doc-verify`, `video-digest`, `evidence-shot` | none |
| Docker log limit (20 MB x 5), weekly temp cleanup, restart-resume state, model fallback, per-run step budget | host config, `ops/weekly-cleanup`, `runner/state/*.json` | none |
| "Find another way" skill (`lab-unblock-another-way`) | `workspace/skills/` | none |

Still true from `agentlab-hidden-gaps.md` (verified again today): **push to phone is off** (`push.json` `enabled: false`), **no outside heartbeat**, no tool self-test. The condenser stays at 2,000 events by John's decision (the runner asks for compaction near ~190K tokens; see `agentd.py` line ~646), so I do not list it.

## 1. The fallback chains, side by side (what John asked for most)

| Failure | Hermes | Grok Bot (this platform) | Claude (Code / Cowork) | ChatGPT / Muse | AgentLab today |
|---|---|---|---|---|---|
| **Site blocks plain fetch** | Search backend ring; a failed keyed backend gets a one-shot rescue through free keyless endpoints (`tools/web_tools_rescue.py`, `plugins/web/keyless_mcp.py`); results cached 20 min (`tools/web_result_cache.py`) | WebFetch, then curl from the box (different network), then browser | n/a | "Try another site or open it in your browser"; no bypass | **Partial.** direct, residential, mobile. Then stops. No archive, mirror, search-for-copy or TLS-impersonation route |
| **Still blocked after proxies** | Cloud browser with stealth and residential proxy (`plugins/browser/browserbase`, `browser_use`, docs `browser.md`) | Browser subagent | n/a | Takeover handoff to the user | **Missing.** Goal judge ends the job as `blocked_by_site`. `lab-unblock` says Glassdoor and G2 still block our browser |
| **Captcha** | Provider-side solving or user takeover | Handoff / solver | n/a | Takeover only; they say they do not bypass | **Partial.** `captcha-solve` tool exists but has no key; sign-in handoff exists |
| **Login** | Vault fill, origin-bound (`tools/browser_vault_tool.py`) | Vault | n/a | Secure form, phishing review, session persists | **Have.** `fill-login`, `vaultd` |
| **Site rate limit (429)** | Backoff with jitter on provider errors | n/a | Honors `Retry-After` | n/a | **Gap.** `blockdetect` treats 429 as "blocked" and escalates to paid IPs at once |
| **LLM 429/5xx/overload** | Classifier with 30+ reasons (`agent/error_classifier.py`), jittered backoff (`retry_utils.py`), shared cooldown (`fallback_cooldown.py`), fallback walk (`chat_completion_helpers.try_activate_fallback`) | Auto-retry | 10 retries, then fallback model after 3 straight 529s; background work drops instead of retrying | n/a | **Partial.** 5 retries, then runner swaps to DeepSeek/Gemini per conversation (`agentd.py` ~563-636). No shared "provider is down" memory |
| **Provider down for a scheduled run** | `cron/unreachable_retry.py` (5, 15, 30 min), `missed_runs.py` (catch up once), `quota_hold.py`, `incidents.py` (dedupe alerts) | Routines resume | Cowork: up to 8 re-runs over 3-4 h (6 h cap on 5xx), missed run runs once after wake, plus visible run status | n/a | **Gap.** `agentd.py` line 1539: "no backfill of missed runs"; failed routines are not retried on a schedule |
| **Tool error / bad arguments** | `tools/arg_coercion.py`, `arg_validation.py`, `escape_drift_autocorrect.py` | Tool returns error and I retry | Tool retry first (cheapest layer) | n/a | **Mostly OpenHands built-ins; not verified** |
| **Tool or step timeout** | One deadline layer (`agent/deadline.py`) | Per-call timeouts | n/a | n/a | **Have.** stuck-terminal release (`agentd.py` ~680-700), no-activity watchdog |
| **Long job / restart** | `tools/process_registry_checkpoint.py`, `delegate_tool_auto_resume.py`, `async_delegation_recovery_hints.py` (puts transcript tail plus git state into the recovery note) | Background tasks | Failed background agent returns its partial result | Muse keeps working after the app closes | **Partial.** The run resumes with a checkpoint note, but the note does not say which `bgjob`s died or give their last log lines |
| **Context overflow** | Compress at 50%, strip oversized media, spill big results (`context_compressor.py`, `tool_result_storage.py`) | Large results written to a file | Drain, then reactive compact, then compact again; strip images | n/a | **Have.** emergency compaction with snapshot and re-injection |
| **Oversized or bad image** | Shrink to 8000 px and retry, evict (`conversation_compression_image_shrink.py`, `image_eviction_policy.py`, `tools/vision_tools_image_prep.py`) | n/a | Strip images and retry | n/a | **Gap.** `agentd.py` ~1186: image over 4 MB is silently skipped |
| **File format** | `tools/read_extract.py` (docx, xlsx, ipynb, plus legacy Office/epub/rtf/pdf), `binary_extensions.py` | Read tool handles PDFs and images | n/a | n/a | **Partial.** Separate tools; no OCR (no tesseract or OCR library) |
| **Media download fails** | n/a (relies on tools) | n/a | n/a | n/a | **Partial.** `ytdl` retries 5 sticky IPs, then stops. No non-download route |

## 2. Ranked gaps

Hours are working hours, never days. "Quick" = under about 2 hours and low risk.

### MUST FIX

**M1. Finish-instead-of-give-up route ladder after the proxies fail.**
- *What:* when all three egress tiers are blocked, try different routes automatically before reporting "blocked".
- *Who has it:* Hermes `tools/web_tools_rescue.py` and `web_tools_extract.py` (one-shot rescue through another backend on failure) plus `plugins/web/keyless_mcp.py`. ChatGPT and Muse hand to the user instead.
- *AgentLab:* `egresslib.py` stops after the mobile tier; `runner/goal_judge.py` then ends the job as `blocked_by_site`. `curl_cffi` (Chrome TLS impersonation) is installed in the container but nothing uses it.
- *Implement:* one `fetch-alt` ladder called by `readpage`/`egress-fetch` after tier failure:
  1. `curl_cffi` with Chrome impersonation, direct then residential (free, fixes TLS-fingerprint 403s);
  2. Wayback availability API / `web.archive.org` copy;
  3. search the exact title or a quoted sentence with `search` and read a syndicated or mirrored copy;
  4. the job browser on the paid tier (the hook already exists);
  5. last: `ask-user` "open this URL and save it as PDF/HTML into inputs/", then continue.
  Log every route tried to the job's `log/routes.jsonl`.
- *Hours:* 5-6. Not quick (steps 1-2 alone are quick, about 2 h).

**M2. Make "blocked" provable before the judge accepts it.**
- *What:* the judge should only accept `blocked_by_site` when at least 3 different route types were tried.
- *Who:* AgentLab's own `AGENTS.md` rule ("fewer only after at least 2 more different routes"), enforced by Hermes-style goal gating (`hermes_cli/goals.py`, already borrowed).
- *AgentLab:* the rule is only in the prompt. `goal_judge.py` reads files, not a route log.
- *Implement:* read `log/routes.jsonl` (from M1) in `goal_judge.py`; if fewer than 3 distinct routes, send back "try: ..." once.
- *Hours:* 2. Quick after M1.

**M3. Shared provider-outage handling and scheduled-run retry.**
- *What:* remember "primary model is down for N minutes" across runs; re-run scheduled jobs that never reached the model; catch up one missed run.
- *Who:* Hermes `agent/fallback_cooldown.py`, `agent/error_classifier.py`, `cron/unreachable_retry.py`, `cron/missed_runs.py`, `cron/quota_hold.py`, `cron/incidents.py`. Cowork does the same (retries over 3-4 h, missed run runs once).
- *AgentLab:* `llm_fallback` works per conversation. A new job during an Anthropic outage burns 5 retries (8-64 s waits) before it falls over, then restores the primary at run end. `agentd.py` line 1539 skips missed runs.
- *Implement:* `runner/state/provider-health.json` (open for 5-10 min after 3 provider errors in a row); new runs start on the fallback while open. Scheduled runs that fail with zero model calls re-queue at 5, 15, 30 min. One catch-up run for a routine missed within the last 24 h. Dedupe repeat failure alerts by job plus error text.
- *Hours:* 5-6. Not quick.

**M4. Push to phone and an outside heartbeat (still open from the last audit).**
- *What:* John is told when a job ends or fails, and when the box or runner goes silent.
- *Who:* Hermes `agent/monitoring/` and `hermes_startup_watchdog.py`, `hermes doctor`. Cowork shows run status and notifies on failure.
- *AgentLab:* ntfy sender exists but `enabled: false`; no heartbeat; no self-test.
- *Implement:* turn on ntfy (topic stays secret); add a 5-minute dead-man ping to an external checker; add a `lab-doctor` script (services up, disk, one cheap `ytdl` transcript, one `egress-fetch`) run daily, alert on failure.
- *Hours:* 2-3. Push alone is quick (15 min).

**M5. Oversized images are dropped without a word.**
- *What:* `agentd.py` ~1186: `if os.path.getsize(host) > 4_000_000: continue`. The agent asked to look at an image and gets nothing back, no error.
- *Who:* Hermes shrinks and retries (`agent/conversation_compression_image_shrink.py`, `tools/vision_tools_image_prep.py`); Claude Code strips media and retries.
- *Implement:* downscale to at most 1568 px / 3.5 MB JPEG with PIL and send it; if it still cannot be sent, tell the agent plainly. Add a "media too large/corrupt" case to the transient-error handler that strips images and retries once.
- *Hours:* 1.5-2.5. **Quick.**

### SHOULD FIX

**S1. 429 is not a "blocked" signal.**
- *What:* `blockdetect.py` `BLOCK_STATUSES = {403, 429, 451}` sends a rate-limited request straight to paid proxies, which does not help and costs money.
- *Implement:* on 429 honor `Retry-After` (cap 60 s) and retry direct once or twice with jitter, escalate only if it persists. Per-host token spacing in `egress-fetch`.
- *Who:* Hermes `agent/retry_utils.py` (jittered, `Retry-After`-aware); Claude Code honors `retry-after`.
- *Hours:* 1-1.5. **Quick.**

**S2. Free search ladder.**
- *What:* `search` is SearXNG (Yahoo, Brave, Mojeek) then Gemini-with-Google. SearXNG settings note that DuckDuckGo "came back empty".
- *Who:* Hermes `plugins/web/` (`ddgs`, `brave_free`, `searxng`, `keyless_mcp` for Exa/Parallel/Keenable free endpoints, others) plus the rescue in `web_tools_rescue.py`.
- *Implement:* add the `ddgs` Python library and the free Exa/Parallel MCP endpoints as rungs in `tools/search`, tried in order when the current ones return nothing or error. Mark rescue-served results as not cached.
- *Hours:* 3-4.

**S3. Cache and de-duplicate web fetches.**
- *What:* `readpage` and `egress-fetch` have no cache, so retries and re-reads pay proxy bytes again. (`ytdl` already caches.)
- *Who:* Hermes `tools/web_result_cache.py` (20-minute TTL, disk-backed, single-flight; only successes cached).
- *Implement:* cache by URL digest in `/workspace/usage/webcache` with a 20-minute TTL; skip caching for rescue-served pages.
- *Hours:* 2. **Quick.**

**S4. Local stealth browser tier for the hard sites.**
- *What:* `lab-unblock` says Glassdoor (Cloudflare) and G2 (DataDome) block our automated Chromium. No stealth library is installed (only `curl_cffi`).
- *Who:* Hermes supports camofox and cloud stealth browsers (`tools/browser_tool.py`, `plugins/browser/*`).
- *Implement:* install patchright or camoufox in the container, expose it as `job-browser --stealth`, and make it step 4 of M1. Test on one blocked site first.
- *Hours:* 4-6 (includes testing, which needs approval for any traffic). Free software.

**S5. Tell the resumed agent what its background jobs did.**
- *What:* after a crash or restart the `[Recovery]` note lists the checkpoint and files, but not which `bgjob`s are dead, finished or still running.
- *Who:* Hermes `tools/process_registry_checkpoint.py` (PID-safe recovery), `tools/async_delegation_recovery_hints.py` (last transcript lines plus git state in the recovery event). Claude Code returns a failed background agent's partial result.
- *Implement:* in the recovery message, run the `bgjob` status over the job folder and include state, exit code, last 20 log lines and the saved command; add the last assistant text to failed-helper alerts.
- *Hours:* 2-3.

**S6. Secrets never reach the model or transcripts.**
- *What:* keys sit in the container environment, and only `push_redact` and `scrub-logs` redact. Tool output going back to the model is not scrubbed. Rule 6 in `AGENTS.md` is the only guard in the loop.
- *Who:* Hermes `agent/redact*.py` (about 30 modules, for example `redact_secret_sources.py`, `redact_vault_values.py`), `tools/environments/local_secret_handoff.py`, `agent/proxy_sources/iron_proxy.py` (injects credentials at the proxy so the sandbox never holds them). Muse keeps credentials in a store outside the agent's runtime.
- *Implement:* a post-tool hook that runs `redactlib` over tool results before they re-enter the transcript; strip key variables inside `job-exec` for helper shells; keep keys in the proxy/keyclient path only.
- *Hours:* 3-4.

**S7. Untrusted-content fencing in code (still open).**
- *What:* only webhook text and triggered emails are fenced. `readpage`, `search`, `x-read`, `yt-transcript`, `egress-fetch` and the fetch MCP output are not.
- *Who:* Hermes `tools/threat_patterns.py` (shared injection/exfiltration patterns scanned in tool results and memory), `cron/prompt_scan.py`. Muse runs classifiers over page text, images and downloaded files.
- *Implement:* wrap web-reading tool output in a fenced "untrusted data" block and add a warn-level regex scan (Hermes-style patterns, anchored on attack vocabulary, not "you must").
- *Hours:* 3.

**S8. One document reader with a format fallback chain, and OCR.**
- *What:* docx, xlsx, pptx, pdf, epub, rtf each need a different command; scanned PDFs and screenshots have no OCR.
- *Who:* Hermes `tools/read_extract.py`.
- *Implement:* `readdoc FILE`: pdftotext, then pypdf/pdfplumber, then pandoc, then LibreOffice, then OCR with `rapidocr-onnxruntime` (free pip) or Gemini vision as last resort.
- *Hours:* 3-4.

**S9. Non-download route for YouTube when `ytdl` fails.**
- *What:* after 5 sticky IPs fail, `ytdl` gives up.
- *Implement:* fall back in order to the transcript API, then Gemini's native handling of a public YouTube URL (check the current API for limits before building), then report. I did not verify the Gemini URL feature on this server.
- *Hours:* 2-3.

### NICE TO HAVE

- **N1. JS dialogs and iframes in the browser.** Hermes `tools/browser_supervisor.py`, `browser_supervisor_dialogs.py`, `browser_supervisor_frames.py`, `browser_dialog_tool.py`. I found no dialog handling in AgentLab beyond `--noerrdialogs`; whether OpenHands' browser tool already covers it is unverified. 4 h with testing.
- **N2. Cost-aware empty-response guard.** Hermes `agent/empty_response_guard.py`. AgentLab treats `LLMNoResponse` as transient and falls back. 2 h.
- **N3. Skill curator** (archive stale skills, never delete). Hermes `agent/curator.py`, `tools/skill_usage.py`. `learn_review.py` already adds lessons. 3 h.
- **N4. Programmatic multi-tool script (one turn, only stdout returns).** Hermes `tools/code_execution_tool.py`. `browser-run`, `run-script`, `research-fanout` cover most of it. 3 h.
- **N5. Per-run browsing log John can read** ("show every URL you visited"). Muse offers it. `evidence-shot` saves screenshots; a URL list from the same hook is 1 h. **Quick.**
- **N6. Shell-output spill to file with preview and path.** Hermes `tools/tool_result_storage.py`, `tool_output_truncate.py`. Our own CLIs mostly page already (`readfile`); OpenHands' built-in terminal clips the middle past 30,000 characters. 2-3 h.

### Paid or new-spend items (not recommended without John's yes)

| Item | Why | Rough cost |
|---|---|---|
| Captcha solver key (CapSolver or 2Captcha) | `captcha-solve` is built but dormant. Solving may violate some sites' terms; ChatGPT and Muse choose takeover instead | ~$1-3 per 1,000 solves (unverified) |
| Cloud stealth browser (Browserbase, Browser Use) | What Hermes uses for the hardest sites | Per-session fees; check current pricing |
| Second Anthropic key or org | Key rotation for 429s (Hermes `agent/credential_pool.py`) | New account; no extra price per token |
| Brave Search API or Tavily | Better search than free rungs | Per 1,000 queries; check current pricing |

## 3. Suggested order (about 32-45 hours total; first block about 12-15)

1. **Quick block (about 6-8 h):** M5 image shrink, S1 429 backoff, S3 web cache, M4 push (+ heartbeat), the quick half of M1 (`curl_cffi` tier and Wayback route).
2. **Resilience core (about 12-14 h):** rest of M1, M2, M3, S5.
3. **Research and safety (about 12-15 h):** S2 search ladder, S8 `readdoc`, S6 secrets, S7 fencing, S9 media route.
4. **Then, if wanted:** S4 stealth browser, nice-to-haves.

## 4. Grok Bot and the others: what AgentLab already matches

- Muse and ChatGPT: watch the live screen, pause, take over, stop; AgentLab has the live desktop plus `handoff`.
- Muse: login credentials hidden from the model; AgentLab has `fill-login` and `vaultd` (not re-tested).
- Grok Bot: subagents in parallel, durable memory, routines, transcript recall, file delivery, approvals. AgentLab has helpers, `remember`/`recall`, routines, `history-search`, `notify`. Excluded by John: spend approvals, multi-user security, phone/meetings, OAuth, CRM.
- Claude Code: five-layer error recovery. AgentLab covers fallback model and compaction; M3 and M5 close most of the rest.

## 5. Not verified

OpenHands built-ins (argument repair, stream-stall handling, dialog handling), whether `fill-login` has stored logins, whether the ntfy topic is valid, and every "have" item at runtime. The Gemini YouTube URL route and all prices are from memory, not checked today.

## Sources

- Hermes repo: https://github.com/NousResearch/hermes-agent (cloned; files cited above)
- Claude Cowork changelog and scheduled tasks: https://claude.com/docs/cowork/changelog, https://claude.com/docs/third-party/claude-desktop/scheduled-tasks
- Claude Code error recovery (third-party source reads): https://claude-wiki.com/error-handling-and-recovery.html, https://oldeucryptoboi.com/blog/api-client-pipeline-deep-dive/, https://getaidrops.com/claude/changelog/2.1.284
- ChatGPT cloud browser: https://help.openai.com/en/articles/20001280-using-cloud-browser-in-chatgpt, https://help.openai.com/en/articles/11752874-chatgpt-agent
- Muse (Meta): https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/, https://www.meta.com/help/superintelligence/2124746764949121/, https://muse.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse
