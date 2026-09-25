# Voice IA — Pass 1 Implementation (Navigation + Calls + Compatibility)

**Date:** 2026-09-25  
**Scope:** Pass 1 only — no high-risk editor extraction, no runtime/compiler changes.

**Locked product decisions applied:**

- Business Knowledge URL stays `/voice/knowledge` (label only).
- Company Brain remains shared underlying state (no Pass 1 consolidation).
- Draft → publish/activate unchanged; Receptionist hub links to wizard only.
- Voice attention on Calls; MCTB `mctb_reply` / `missed_call` excluded from Voice queue.

---

## Navigation

| Before | After |
|--------|--------|
| Overview, Calls, **AI Agent**, **Knowledge**, Call Handling, Analytics, **Needs attention** | Overview, Calls, **Receptionist**, **Business Knowledge**, Call Handling, Analytics (6 items) |

**Files:** `src/lib/products/mctb-nav.ts`, `src/components/voice/voice-nav.ts`, `src/lib/products/mctb-bundled-receptionist-paths.ts`

---

## Routes

| Route | Change |
|-------|--------|
| `/voice/receptionist` | Permanent destination — transitional summary shell (not final editor) |
| `/voice/needs-attention` | Redirect → `/voice/calls?attention=open` |
| `/voice/knowledge` | URL unchanged; title **Business Knowledge** |
| `/voice/operations` | Unchanged redirect → call-handling |
| `/voice/analytics/after-hours` | Unchanged redirect → analytics |
| `/mctb/voice-agent` | Unchanged first-run wizard |

---

## Page specifications (Pass 1)

### Calls list (`/voice/calls`)

1. **Archetype:** List / management  
2. **Primary job:** Find a call and see what happened at a glance.  
3. **Visual reference:** Existing `voice/calls/page.tsx` grid table (`max-w-[1200px]`, `px-4 sm:px-8`, `rounded-xl border` table shell) — **no new table design**.  
4. **Frame:** `max-w-[1200px]`; horizontal `px-4` / `sm:px-8`; section gaps `mb-4` / `mb-6`; existing Calls metrics strip unchanged.  
5. **Header:** Existing `h1` + subtitle (unchanged typography).  
6. **Content order:** Header → metrics → search + period select → **All calls | Needs attention** → outcome filters → table → pagination.  
7. **Columns:** Existing 6-column grid preserved; outcome column shows **primary** + optional **attention** badge (max 2).  
8. **Rows:** Caller left (name, phone, summary); outcome badges; date/duration unchanged.  
9. **Typography:** Existing `text-sm` / `text-xs` / `font-semibold` on calls page.  
10. **Controls:** Removed fake date range picker and export; wired **Period** select to API `dateRange` (`today` | `7d` | `30d`).  
11. **Status:** `CallOutcomeBadge` + `CallAttentionBadge` (text labels, ring styles from `OUTCOME_BADGE_STYLES`).  
12. **Density:** Medium — same as pre–Pass 1 list.  
13. **Disclosure:** Needs attention embeds `NeedsAttentionView` (replaces table, not a new page).  
14. **States:** Loading row message; empty filter message; attention empty via existing view.  
15. **Responsive:** Existing grid; outcome stack in column on narrow widths.  
16. **A11y:** Search label via placeholder; tab buttons keyboard operable.

### Call detail (`/voice/calls/[id]`)

1. **Archetype:** Detail  
2. **Primary job:** Understand who called, what happened, and what still needs follow-up without reading the transcript first.  
3. **Visual reference:** Same container as list; existing `rounded-xl border bg-white p-5 shadow-sm` sections **reordered**, not redesigned.  
4. **Frame:** `max-w-[1200px]`; `lg:grid-cols-[1fr_280-320px]` unchanged.  
5. **Header:** Caller name + phone; metadata line; optional **View contact** link.  
6. **Content order (main column):** What happened (outcome + action items) → follow-up (callback) → summary → information collected → knowledge gaps → recording → transcript preview → technical details (collapsed).  
7. **Sidebar:** Call data + activity feed + caller card (unchanged components).  
8. **Badges:** `CallOutcomeBadge` / `CallAttentionBadge` in outcome region only.  
9. **Evidence:** Recording and transcript **below** outcome/summary.  
10. **Technical:** `executionTrace` + failed tool runs behind **Technical details** toggle.

### Receptionist (`/voice/receptionist`) — transitional only

1. **Archetype:** Configuration summary (interim)  
2. **Primary job:** Durable nav target + truthful status until approved full page spec.  
3. **Visual reference:** `PageHeader` + single bordered `dl` divide-y (same pattern as call detail metadata / overview cards).  
4. **Not built:** Final Receptionist editor, capability rows, publish banner UX — **deferred to spec + Pass 2+**.  
5. **Actions:** Primary → wizard (`/mctb/voice-agent`); no duplicate config controls.

---

## Calls list — outcome hierarchy

Central helper: `src/lib/voice/calls/outcome-display.ts` → `deriveCallListOutcomeDisplay()`.

**Precedence (primary):** transfer failed → voicemail → booking link sent → appointment requested / request_only → appointment booked → transferred → emergency → urgent → solicitor → spam → callback → message → lead → …

**Attention (secondary, when distinct):** unanswered question (`hasKnowledgeGap`), transfer failed, urgent, emergency, spam, solicitor.

---

## Outcome derivation — fields used

| Display | Fields |
|---------|--------|
| Transfer Failed | `outcome` contains `transfer_failed` / `transfer_exhausted`; or `transfers[0].status === 'failed'` |
| Voicemail | `voicemailDetected` |
| Booking Link Sent | `outcome` contains `booking_link_sent` |
| Appointment Requested | `outcome` contains `appointment_requested` / `request_only` |
| Appointment Booked | `appointmentBooked` (if not request path); or `outcome` booked |
| Transferred | `transferred` (if not failed) |
| Emergency / Urgent / Spam / Solicitor | `outcome` substring |
| Callback / Message | `outcome` substring |
| Unanswered question (attention) | `knowledgeGaps.length > 0` on detail only |

No new persisted outcome columns.

---

## Needs attention

- **Nav:** Removed from primary Voice nav.  
- **Calls:** `?attention=open` shows `NeedsAttentionView` with `voiceOnly` + `embedded`.  
- **Filter:** `src/lib/platform/voice-attention-kinds.ts` — includes `callback_request`, `failed_transfer`, `voicemail`, `form_submission`, `repeat_caller`; **excludes** `mctb_reply`, `missed_call`.  
- **Redirect:** `/voice/needs-attention` → `/voice/calls?attention=open`.  
- **API:** Unchanged; filtering is client-side on `primaryKind`.

---

## Stub controls

| Control | Decision |
|---------|----------|
| Date range fake button | **Removed**; replaced with wired `dateRange` select (API already supports `today` / `7d` / `30d`). |
| Export | **Removed** (no list export API in Pass 1). |

---

## Components reused

- `PageHeader`, `Button`, `Card` (design system)  
- `CallsMetrics`, `CallOutcomeBadge`, `CallAttentionBadge`  
- `NeedsAttentionView`, `WaveformRecordingPlayer`  
- `VoiceIngressSetupPanel` / call-handling editors — **untouched**  
- MCTB wizard — **untouched**

---

## Runtime files changed

**NONE** (no `compileVoiceV3AgentConfig`, LiveKit, booking, transfer executors, RAG, or MCTB runtime).

---

## Persistence / schema

**NONE**

---

## Validation

| Check | Result |
|-------|--------|
| `npx vitest run src/lib/voice/calls/outcome-display.test.ts` | **4/4 pass** |
| Manual grep: nav labels | 6 destinations, correct names |
| TypeScript | Not run (full build excluded per Pass 1 rules) |

---

## Deferred to Pass 2+

- Receptionist permanent editor extraction  
- Business Knowledge / Company Brain consolidation  
- Call Handling schedule editor move  
- Analytics metric exposure  
- Overview redesign  
- Knowledge-gap reindex functional fix (reconciliation item)

---

## UI governance (forward rule)

No page may be materially built from an IA label alone. Future passes require an approved **page specification** (archetype, reference page, frame tokens, section order, rows, states, responsive contract) before implementation — see user **Pass 1 UI Implementation Addendum**.

---

PASS 1 IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED
