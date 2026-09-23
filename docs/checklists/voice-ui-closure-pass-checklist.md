# Voice + MCTB UI closure pass — full checklist

Copy everything below the line. Mark `[x]` as you complete items.

**Starting SHA (baseline):** `ccfa2d3e1d0effb9fea39f86dcf146bfd915f14b`  
**Target:** one candidate SHA with UI + call-history; **no production deploy** until PSTN smoke passes.

---

## 0. Google V3 (audit only — do not implement in UI pass)

- [ ] Trace `master` for `src/lib/voice-v3/calendar/google/*`
- [ ] Trace `book-dispatch.ts` / `find-dispatch.ts` for provider-neutral paths
- [ ] Record determination: A present on master | B on branch not merged | C never built
- [ ] If B: note branch `cursor/voice-v3-google-calendar-2304` @ `02fc3415`
- [ ] Do **not** implement Google in UI-only pass

---

## 1. Voice call detail truth (`/voice/calls/[id]`)

- [ ] Remove mock Activity Feed for real calls
- [ ] Remove fake `$0.15 (est.)` cost
- [ ] Remove hard-coded `Twilio` provider
- [ ] Remove static Sales / Interested (High) tags
- [ ] Remove fake “Last contact: 10 mins ago”
- [ ] Wire Activity Feed to `/api/voice/calls/[id]` events (customer-level labels only)
- [ ] No FunctionTool names / request IDs / forensic internals in feed
- [ ] Show cost only if authoritative `costCents > 0`
- [ ] Show provider only if API has authoritative provider
- [ ] Contact card: name, phone, email if known; real timestamps only
- [ ] Demo call IDs may keep demo fixtures only

---

## 2. Terminology

- [ ] Breadcrumb/header: **AI After Hours** (not AI Receptionist) on call workspace
- [ ] Do not rename unrelated products/contexts globally

---

## 3. Call history product (do not rebuild)

- [ ] Recording: READY / PROCESSING / FAILED or UNAVAILABLE states
- [ ] Transcript: READY / PROCESSING / FAILED or UNAVAILABLE states
- [ ] Summary: READY / PROCESSING / FAILED or UNAVAILABLE states
- [ ] One failed artifact does not break entire page
- [ ] Still uses existing recording / transcript / summary pipeline

---

## 4. Knowledge crawl UI (`/voice/knowledge`)

- [ ] On scan, store `crawlJobId` from API
- [ ] Poll `/api/voice/knowledge/crawl/[jobId]` (reasonable interval)
- [ ] Show: Waiting to scan / Scanning / Preparing / Ready for Amy / Failed
- [ ] Show page counts when API provides them
- [ ] Retry on failure when supported
- [ ] Stop polling on terminal state; cleanup on unmount
- [ ] No vector store IDs / OpenAI file IDs / job IDs in customer UI

---

## 5. Wizard information step

- [ ] Scan website → `crawlJobId` → poll same endpoint
- [ ] Success means ready state, not enqueue-only
- [ ] Honest indeterminate progress if backend cannot split crawl vs index

---

## 6. Voice test entry (AI After Hours)

- [ ] Primary browser test uses `VoiceV3BrowserCall`
- [ ] `/voice/agents/[id]/voice-test` reaches V3 test component
- [ ] Clear “Test Amy” / Test in browser / Call my phone where applicable
- [ ] Do not delete `AgentBrowserCall` if other products use it

---

## 7. MCTB — fresh browser cert first

- [ ] Run cert against **current candidate** (not Sept 8 results alone)
- [ ] Classify each old FAIL: PASS NOW | STILL FAILING | STALE TEST | EXTERNAL BLOCKED
- [ ] Fix **only** current frontend failures

### Phone `/mctb/setup/phone`

- [ ] Open → load values → Save → hard reload → values identical

### Consent `/mctb/setup/consent`

- [ ] `press_1` → Save → reload → still `press_1`
- [ ] `existing_consent` → Save → reload → still `existing_consent`

### Links

- [ ] `/mctb/setup/links` loads and saves

### Recovery redirects

- [ ] `/mctb/setup/business-hours` → canonical recovery
- [ ] Legacy follow-up route → canonical recovery

### Conversations context

- [ ] MCTB-originated flow keeps MCTB context (not generic inbox drop)

---

## 8. MCTB nav cleanup only

- [ ] Audit primary nav links: calendar, appointments, booking, reminders, ai-lead-recovery, voice-agent
- [ ] Remove from **primary** MCTB nav if non-canonical (do not delete routes)
- [ ] Label cross-sells clearly if kept elsewhere

---

## 9. R-05 (only if data exists)

- [ ] Confirm backend can detect “no forwarded calls in 7 days” authoritatively
- [ ] If yes: Overview/setup-health warning + CTA to phone setup
- [ ] If no: mark blocked; do not fake heuristic

---

## 10. Browser quality (changed Voice pages)

- [ ] Calls list
- [ ] Call detail
- [ ] Knowledge
- [ ] Wizard Information
- [ ] V3 test entry
- [ ] Desktop width
- [ ] Mobile width
- [ ] Loading / empty / error / processing states
- [ ] Long transcript / summary / caller name / URL / failed crawl

---

## 11. Tests

- [ ] Voice call-history tests (if applicable to change)
- [ ] Wizard tests for information step
- [ ] Knowledge crawl tests
- [ ] MCTB tests / launch-readiness matrix
- [ ] Browser certification (preview)
- [ ] Typecheck/build for touched packages
- [ ] Separate new regression vs pre-existing failures

---

## 12. Do not touch

- [ ] No GPT-Live / delegation / Sol architecture changes
- [ ] No Microsoft BOOK commit path changes
- [ ] No transfer / recording / Deepgram / FileSearch runtime changes
- [ ] No freshness / filler optimization in this pass

---

## 13. Final gate

- [ ] Record starting SHA, final SHA, commits
- [ ] Google A/B/C written up
- [ ] **Do not deploy production**
- [ ] One PSTN call on **final candidate** only after merge
