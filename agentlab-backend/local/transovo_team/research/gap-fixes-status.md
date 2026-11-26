# Gap-fix build: status at handoff

Written Thu Nov 26, 2026, about 5:30 AM ET. Build started about 5:18 AM ET and was stopped at the next safe point on John's instruction. A fresh agent takes over. Spend so far: about $0.01 (a few residential-proxy page loads during tests; no Haiku jobs were run, no LLM calls).

**Backup:** `/opt/agent/backups/gap-fixes-20261126-101834/` on the AgentLab server. It holds `files.tgz` (every edited file, taken before any change), `crontab.txt`, `ROLLBACK.md` (restore commands, list of new files) and `staged-copies/` (copies of the new and changed files, plus the M5 patch script and `lab-doctor`). Local working copies: `/workspace/gap26/new/` (and `/workspace/gap26/srv/` for pulled originals).

**Server state now:** consistent. All edited files compile; services runner, chrome, egress and keys are active; runner `/health` is OK; containers up; no stray processes; my test job folders were deleted. Crontab untouched. **The runner was not restarted**, so the M5 edit in `runner/agentd.py` is on disk but not yet live (needs `systemctl restart agent-lab-runner`, best done when no job is running).

## Correction to the earlier audit
The audit said `captcha-solve` was dormant with no key. That was wrong: I looked in `/opt/agent/secrets` but the CapSolver key is in `/workspace/secrets/captcha.env` (container path; host `/opt/agent/workspace/secrets/captcha.env`). `captcha-solve --check` returns `ready: true`. It is simply never called automatically; skills tell the agent to hand off or to run it by hand. It is already paid for (about $6 balance), so it counts as a free tier in the ladder.

## Item status

### Done (tested)
| Item | What exists | Evidence |
|---|---|---|
| **S1: 429 backoff** | `egresslib._with_429_backoff`, `retry_after_seconds`: on 429, waits `Retry-After` (cap 20 s, plus jitter) and retries the same tier twice before any paid tier | Unit test: 429,429,200 gave status 200 after 3 calls with sleeps 1.2 s and 1.8 s; persistent 429 stops after 3 calls; HTTP-date and large values capped at 20 s |
| **S3: fetch cache + single-flight** | `egresslib.cache_get/cache_put/_Flight`, dir `/workspace/usage/webcache`, 20 min TTL, successes only, not for Wayback or stealth results; `--no-cache` on `readpage` and `egress-fetch` | Live test: second fetch of example.com reported `via cache` |
| **M1 (curl_cffi tier)** | `egresslib._cffi_once` (Chrome TLS fingerprint); direct tries curl then Chrome-TLS; residential/mobile try Chrome-TLS first | Live: `_cffi_once` on example.com gave 200 |
| **M1 (rest of ladder)** | `altroutes.rescue()` after all tiers fail: stealth browser direct, stealth browser residential (with CapSolver when a captcha widget is on the page, capped 3 per job and 15 per day, logged in `/workspace/usage/captcha-solves.jsonl`), Wayback copy, search candidates, then a hint to `ask-user`. Wired into `readpage` and `egress-fetch`. Paid-tier slot is `altroutes.paid_slot()` (returns None; nothing else is paid for) | Live test on g2.com (DataDome): direct 403, direct_tls 403, residential_tls 403, stealth 403, stealth_residential 403 (captcha: no widget found), then Wayback returned a 2024 copy (78 KB) in about 15 s; `readpage` prints a "this is the Wayback copy from DATE" note. Each route was written to `<job>/log/routes.jsonl` |
| **S4: stealth browser** | `tools/stealth-fetch` (patchright in `/workspace/usage/stealthvenv`, system Chromium, US locale/timezone, "Headless" removed from UA) | example.com: ok, status 200, 5.6 s. It did not get past DataDome on G2 (as the lab-unblock skill already says); not tested on other hard sites |
| **S7 (partial, see below): fencing** | `tools/egress/fence.py`: wraps text in an "untrusted web content" block and adds a warning line when injection wording is found; also redacts key-shaped strings. Used by `readpage` and `egress-fetch` | Scan test: an injected sample flagged 3 patterns; an ordinary "you must restart, don't forget the instructions" text flagged none; a fake `sk-ant-...` key was redacted |
| **N6: spill long pages** | `readpage` saves pages longer than `--max` to `<job>/log/web/<hash>.txt` and prints the path plus a `readfile` hint | Code in place; not run on a long page |
| **M5: oversized/corrupt images** | `runner/agentd.py`: new `normalize_view_image()` (real JPEG, longest side 1568 px, under 3.5 MB) and a changed `deliver_view()` loop; unreadable or still-too-big images are reported to the agent in a `[view]` note instead of being dropped silently | Unit test (function extracted from the file): 90 MB PNG gave a 747 KB JPEG at 1568x1307; corrupt file gave a clear reason; 8 KB JPEG passed through unchanged. **Not live until the runner is restarted, and no real oversized-image job was run** |

### Partly done
| Item | State | What is left |
|---|---|---|
| **M4 heartbeat / self-test** | `lab-doctor` is written and saved at `.../staged-copies/lab-doctor` and `/workspace/gap26/new/lab-doctor`. **It is NOT installed on the server** (the copy was interrupted) and has never been run | Copy to `/opt/agent/ops/lab-doctor` (chmod 755), run `lab-doctor --verbose`, fix any false failures, then add two cron lines: every 5 min `lab-doctor --quiet`, weekly `lab-doctor --deep`. It writes `runner/state/doctor.json` and `heartbeat.json`, adds one deduped notification to the Agent Lab page feed on failure, and supports an optional dead-man ping from `/opt/agent/secrets/heartbeat.env`. Push and texts stay off |
| **S7 fencing** | Done for `readpage` and `egress-fetch` only | Same wrapper for `x-read`, `yt-transcript`, `search` snippets and the fetch MCP wrapper (`mcp-fetch-egress`) |
| **S6 secrets** | Key-shaped strings are redacted in fenced web text only | Check which env vars the per-job shell sees (names only) and strip key variables in the job sandbox; a post-tool redaction hook is likely not possible in OpenHands, so env scrubbing is the real fix |
| **S2 search ladder** | `ddgs` and `rapidocr-onnxruntime` installed in `/workspace/usage/stealthvenv`; Exa/Parallel free endpoints not touched | Add rungs to `tools/search` (read Hermes `plugins/web/keyless_mcp.py` first); SearXNG has DuckDuckGo disabled because it returned nothing |
| **S8 readdoc** | rapidocr installed in the venv only | Write `tools/readdoc` (pdftotext, pypdf, pdfplumber, pandoc, LibreOffice, then OCR) |
| **M2** | The route log it needs now exists | Edit `runner/goal_judge.py`: when the verdict is `blocked_by_site` and `log/routes.jsonl` shows fewer than 3 different route types, send one "try these routes" message instead (counts as one of its 2 extra rounds; fail open) |

### Not started
- **M3** provider-outage handling (shared `provider-health.json`, scheduled-run retry at 5/15/30 min, one catch-up for a missed routine, deduped failure alerts). Touches `runner/agentd.py` around the fallback code (~lines 563-636) and the routine scheduler (~line 1539); re-read before editing since COS-43 is working in that file.
- **S5** list dead `bgjob`s in the `[Recovery]` note, and add the last assistant text to failed-helper alerts.
- **S9** non-download route for YouTube (Gemini YouTube-URL understanding; check the API first).
- **N1** JS dialogs/iframes, **N2** empty-response guard, **N3** skill curator, **N4** programmatic script tool, **N5** URL log per job, **N6** spill for the shell tool.
- Real Haiku jobs (blocked-site job through the ladder, oversized-image job): none run.

## Notes for the next agent
- Shared-file rule from John: re-read `agentd.py`, `runlib.py`, skills and MCP config right before each edit; make small edits. I patched `agentd.py` with `patch_m5.py` (it asserts the old text is present and compile-checks before replacing).
- Keep the cross-job prompt cache intact: no change to the tool list or system prompt was made; all new behavior is inside tool output or runner code.
- `scp` to the server is slow (about 3 s per file); batch copies or use one ssh heredoc.
- Test pages used: `example.com` and `g2.com/products/*/reviews` (blocked by DataDome). Residential-proxy bytes used in tests were a few hundred KB.
- Do not touch the phone line (`agentlab-phone` container) or prod Transovo.
