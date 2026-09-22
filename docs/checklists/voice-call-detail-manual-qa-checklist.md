# Voice UI — manual browser QA checklist

After UI closure merge. Desktop + narrow (~375px) width.

**Base URL:** _______________________  
**SHA:** _______________________

---

## Calls list — `/voice/calls`

- [ ] Loads without console errors
- [ ] Real calls listed; demo calls labeled if present
- [ ] Row opens detail

---

## Call detail — `/voice/calls/[id]` (real call)

- [ ] Breadcrumb says AI After Hours
- [ ] No `$0.15 (est.)` unless real `costCents`
- [ ] No hard-coded Twilio unless recording provider says so
- [ ] Activity feed: real events or empty state (not mock timeline)
- [ ] No Tags & Lead Status block
- [ ] Contact: phone; email if known
- [ ] Recording section: player OR processing/unavailable message
- [ ] Summary: text OR processing/unavailable
- [ ] Transcript tab: segments OR processing/unavailable
- [ ] Long caller name does not break layout
- [ ] Long transcript scrolls

---

## Call detail — demo call (`demo-call-*`)

- [ ] Demo content allowed; clearly not production data

---

## Knowledge — `/voice/knowledge`

- [ ] Create / select KB
- [ ] Scan website starts job
- [ ] Progress messages update until Ready or Failed
- [ ] Retry visible on failure
- [ ] No internal job IDs in UI

---

## Wizard — Information step (website scan)

- [ ] Scan does not show success until crawl/index terminal state
- [ ] Progress visible during scan

---

## Voice test — `/voice/agents/[id]/voice-test`

- [ ] “Test Amy” / AI After Hours labeling
- [ ] Browser test uses V3 path (not ambiguous legacy Telnyx-only UI)

---

## Mobile width

- [ ] Call detail readable; sidebar stacks
- [ ] Knowledge scan UI usable

**Manual QA:** PASS / FAIL — ___________
