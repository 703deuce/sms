# Voice IA — Business Knowledge Permanent Page Specification

**Route:** `/voice/knowledge`  
**Voice nav label:** Business Knowledge  
**Pass type:** Read-only design + source-of-truth (no implementation in this pass)  
**Revalidated against branch:** `master` (post–Receptionist Pass 2 on `cursor/voice-receptionist-pass-2-2304`; spec branch does not include Pass 2 code, but Pass 2 behaviors are cited where they affect dependencies)

---

## 1. Executive Design Decision

**MOVE AND CONSOLIDATE THE CUSTOMER SURFACE. PRESERVE THE PROVEN KNOWLEDGE ENGINE.**

Business Knowledge becomes the single Voice customer-facing workspace for teaching Amy accurate business information, managing retrievable sources, and resolving gaps—without exposing internal storage (Company Brain JSON, vector stores, crawl jobs, `knowledgeItems` IDs, etc.).

**Locked decisions for implementation:**

| Decision | Choice |
|----------|--------|
| Runtime engines | No replacement; reuse wizard `knowledgeItems`, `operatingMaturity.businessSchedule`, KB/RAG pipeline, Company Brain compatibility sync, website crawl |
| Hours/timezone | **One canonical editor** on Business Knowledge using existing `BusinessScheduleEditor`; runtime authority remains `operatingMaturity.businessSchedule` |
| Website | **One customer workflow** spanning RAG indexing + owner-reviewed hot facts |
| Gap resolution | **Must invoke `processKnowledgeSource`** after `appendApprovedAnswerToKnowledgeBase` (defect confirmed) |
| Company Brain | Remains shared underlying state; `/company-brain` not deleted; Voice facts edited once on Business Knowledge |
| Persistence | Reuse existing wizard step ownership (`information` + `call-handling` for schedule), KB APIs, gap API—not a new Receptionist-style JSON model |
| Save semantics | **No fake global Save**; region-appropriate immediate or section save per matrix §30 |
| Publish semantics | Distinguish **saved**, **approved**, **indexed/searchable**, and **published/live** in UI copy |

---

## 2. Revalidated Runtime Knowledge Architecture

### 2.1 Changed / confirmed assumptions (vs prior audit)

| Topic | Finding |
|-------|---------|
| Receptionist Pass 2 | **Conforms** §24 intent on `master` Pass 2 branch: read-only `DependencyRow` for business hours → `/voice/knowledge`; no editable timezone on Receptionist |
| Call Handling page | **Still violates** locked ownership: `call-handling-operational-page.tsx` mounts full `BusinessScheduleEditor` (duplicate editor). **Fix in BK implementation pass**, not this pass |
| Wizard step ownership | `operatingMaturity` owned by **`call-handling`**; `knowledgeItems`, `websiteUrl`, `linkedKnowledgeBaseId`, `businessName`, **`timezone`** owned by **`information`** (`merge-wizard-state-on-save.ts`) — **split ownership** requires BK save plan to touch both step IDs when needed |
| Information wizard step | Still embeds `BusinessScheduleEditor` + website scan (`information-step.tsx`) — BK consolidation should **relocate** UI, not duplicate |
| Current `/voice/knowledge` | Dev-oriented KB admin (create KB, Telnyx jargon, test search); **not** the target product surface |
| Gap reindex defect | **Still present** on `master`: `appendApprovedAnswerToKnowledgeBase` creates `voiceKnowledgeSource` with `status: "active"` and **never** calls `processKnowledgeSource` (`owner-service.ts`); contrast `sources/route.ts`, `upload/route.ts`, `activate-hooks.ts` |
| Compiler timezone | `compileVoiceV3AgentConfig` prefers `wizard.timezone` **before** `businessSchedule.timezone` (lines 295–298) — compatibility plan must address |
| Hours display authority | `compileBusinessHoursAmyDisplay`: structured schedule wins; `knowledgeItems[id=hours]` is prose-only with conflict flag |
| MCTB | `loadMctbApprovedBusinessInformation()` → `loadBusinessBrain()` only; **no** Voice KB/RAG |
| Config load | `from-published-agent.ts` resolves `resolveAgentKnowledgeRetrieval` + `compileVoiceV3AgentConfig` at publish/load time; live tool `searchKnowledge` / `execute-search-business-knowledge` reads DB at runtime |

### 2.2 Protected chains (preserve)

```
Approved structured facts (knowledgeItems + statuses)
  → merge on save (information step)
  → syncCompanyBrainFromWizard (on appointment-receptionist save)
  → compileVoiceV3AgentConfig → hotContextFromWizard
  → BUSINESS FACTS / Voice instructions (published config)

Knowledge sources (VoiceKnowledgeSource)
  → processKnowledgeSource (knowledge-processor.ts)
  → indexed (+ OpenAI vector store when GPT Live RAG)
  → resolveAgentKnowledgeRetrieval
  → FileSearch / search_business_knowledge / resolveBusinessAnswer RAG leg

Company Brain (workspace businessBrain)
  → loadBusinessBrain
  → resolveBusinessAnswer (structured + fallback)
  → MCTB approved business information

operatingMaturity.businessSchedule
  → compileVoiceV3AgentConfig.operatingPolicy.businessSchedule
  → operating-state / after-hours / transfer gating (Call Handling consumers)
```

**No schema migration for IA. No replacement compiler.**

---

## 3. Existing Visual Primitive Inventory

| Primitive | Component | Source | Existing classes/tokens | Business Knowledge use |
|-----------|-----------|--------|-------------------------|------------------------|
| Page container | `VoiceSubNav` + content wrapper | `voice-subnav.tsx`, Receptionist `max-w-5xl mx-auto px-4` | `max-w-5xl`, `px-4`, `pb-24` | **Use `max-w-5xl`** for fact/schedule sections; allow **full-width table** only inside Sources subsection |
| Page header | `PageHeader` | `components/ui/page-header.tsx` | `font-display text-2xl`, `text-muted-foreground` description | H1 Business Knowledge + supporting copy |
| Section card | `Card` | `components/ui/card.tsx` | `rounded-xl border border-border bg-card p-5` | Major sections (not one card per source) |
| Section title | Native `h2` | Receptionist editor | `text-lg font-semibold` or `text-sm font-semibold` | Consistent with Receptionist/Call Handling |
| Settings / dependency row | `DependencyRow` pattern | `voice-receptionist-editor.tsx` | `divide-y divide-border`, link + detail | Read-only summaries elsewhere; BK uses editable rows |
| Status pill | `StatusPill` | `appointment-receptionist/ui` | semantic colors | Fact/source/review status |
| Form fields | `Input`, `Label`, `Textarea` | `components/ui/input.tsx` | design tokens | Facts, URL, gap answers |
| Data table | `Table`, `TR`, `TH`, `TD` | `components/ui/table.tsx` | semantic table | Source list (desktop) |
| Callout | `InfoCallout` | appointment-receptionist `ui` | bordered info | Website vs review explanation |
| Schedule | `BusinessScheduleEditor` | `operating-maturity-editor.tsx` | weekly rows, holidays, tz input | **Reuse unchanged** in BK hours section |
| Review list | `KnowledgeGapsPanel` | `knowledge-gaps-panel.tsx` | bordered list items | Adapt styling; keep behavior |
| Buttons | `Button` | `components/ui/button.tsx` | primary / outline / destructive | Per-region actions |
| Empty state | Text in card | patterns across Voice | `text-sm text-muted-foreground` | No hero empty states |
| Sticky footer | Receptionist pattern | `voice-receptionist-editor.tsx` | `sticky bottom-0` | **Only** where wizard slice save is needed (facts + schedule groups)—not for every KB CRUD |
| Expandable | Collapsible sections | Information step patterns | `rounded-lg border` rows | Optional FAQ long text |

**No visual redesign. No new design tokens.**

---

## 4. Page Archetype

**Configuration / Knowledge Workspace** (settings + operational review queue hybrid).

**Primary job:** Teach Amy accurate business information, manage sources she can search, resolve information she could not answer.

**Not:** document library alone, Company Brain JSON editor, RAG debug console, wizard, dashboard, or unrelated card soup.

---

## 5. Page Frame

| Token | Value | Rationale |
|-------|-------|-----------|
| Max width | `max-w-5xl mx-auto` | Matches Receptionist; facts + schedule are form-heavy |
| Outer padding | `px-4 sm:px-6` | Align Voice product pages |
| Header spacing | `PageHeader` default `mb-6` | Existing |
| Major section gap | `space-y-8` between sections | Long page; scroll-friendly |
| Section padding | `Card` `p-5` or section `space-y-4` | Receptionist section cards |
| Row padding | `py-3` fact rows; `p-3` schedule day rows | Existing editor density |
| List density | Medium (table rows ~48px; review rows compact) | Sources may be 10–30 rows |
| Columns | Single column primary; source table 2-col grid on `lg` only for add-source panel | Current knowledge page uses `lg:grid-cols-2` for add/test—**demote test search** to dev-only or collapsed “Preview search” |
| Breakpoints | `sm` stack header actions; table → stacked records under `md` per table standards | No horizontal page scroll |

---

## 6. Page Header

```
H1: Business Knowledge
Description: Teach Amy accurate information about your business, manage sources she can search, and resolve questions she could not answer on calls.
Actions: none at page level (dominant actions live in sections)
```

Optional quiet link: “Company-wide brain (advanced)” → `/company-brain` for admins only, secondary text link—not primary nav duplicate.

---

## 7. Local Navigation Decision

**No peer routes. No horizontal tabs.**

Use **in-page anchor nav** (compact, optional, `sticky top` below Voice subnav) only if page length warrants it after implementation:

- Overview / Needs review  
- Business information  
- Hours  
- Website  
- Sources  
- Unanswered questions  

Pattern: same as Receptionist section jump links (`scroll-mt-24`, `id` on sections). **Do not** create `/voice/knowledge/sources` etc.

---

## 8. Exact Section Hierarchy

**First viewport must answer:** (1) Is knowledge ready? (2) What core facts is Amy using? (3) What needs review?

**Top → bottom order:**

1. **Knowledge status & needs review** (banner + counts: open gaps, discovered facts pending, failed sources, processing website)  
2. **Core business information** (name, description, services, areas, pricing, policies)  
3. **Business hours & timezone** (`BusinessScheduleEditor`)  
4. **Website** (URL, lifecycle status, discovered-fact review)  
5. **FAQs / approved facts** (if not folded into §2—see §19)  
6. **Knowledge sources** (linked KB + row list; add text/url/file)  
7. **Unanswered questions** (`KnowledgeGapsPanel` elevated, `id="knowledge-gaps"`)

---

## 9. Business Information Specification

Canonical customer fields map to wizard `knowledgeItems` + `businessName` + `websiteUrl`:

| Customer field | Primary UI control | Persisted field(s) | Compiler / loader | Consumer |
|----------------|-------------------|--------------------|-------------------|----------|
| Business name | Text | `businessName` + `knowledgeItems[id=business]` summary | `hotContextFromWizard` (parses `business` item), `businessName` in compile | Voice identity, Brain `businessName` |
| Description / location | Textarea (business item) | `knowledgeItems[business].summary` (`name · address` pattern) | hot context `companyDescription`, `location` | Amy spoken context |
| Services | Textarea or bullet field | `knowledgeItems[services]`; optional mirror from `appointmentTypes` names | hot `servicesSummary`; Brain `services` from appointment types on sync | Voice, MCTB services list |
| Service area | Text | `knowledgeItems[service_area]` (cert scripts use id; defaults omit—**add row in UI**) | `resolveBusinessAnswer`, prompt builders | Voice qualification |
| Pricing | Text | `knowledgeItems[pricing]` | hot `pricingSummary` | Voice |
| Policies | Text | `knowledgeItems[policies]` | hot `policiesSummary` | Voice |
| Website URL | URL input | `websiteUrl`, crawl/KB linkage | KB crawl, Brain `website` | RAG + Brain |
| FAQs | Structured Q&A or `knowledgeItems[faqs]` | `knowledgeItems[faqs]` or dedicated approved rows | hot `knowledgeItemSummaries`; gap-created text sources | Voice + RAG |

**Save path:** `POST /api/solutions/appointment-receptionist` with `wizardStepId: "information"` and partial state slice (same pattern as Receptionist `receptionist-editor-persist.ts`). Triggers `syncCompanyBrainFromWizard` on server save.

---

## 10. Business Fact Authority Rules

**Rule:** Customer edits **once** on Business Knowledge → canonical wizard field updated → `syncCompanyBrainFromWizard` on save → hot context on **publish** → RAG only when content is in a **processed source** or search path uses Brain/RAG fallback.

**No bidirectional uncontrolled sync.**

### Fact authority matrix

| Fact | Customer authority | Derived / mirror | Runtime consumers | Sync direction |
|------|-------------------|------------------|-------------------|----------------|
| Business name | `businessName` + business item | Brain `businessName` | Voice compile, MCTB name | BK → wizard → Brain |
| Description/address | `knowledgeItems.business` | Brain facts (if approved status) | hot context | BK → wizard → Brain on save |
| Services | `knowledgeItems.services` (+ optional read-only appt type names) | Brain `services[]` from appointment types | Voice, MCTB services | Types → Brain on save; text item → wizard |
| Service area | `knowledgeItems.service_area` | Brain knowledgeFacts | Voice tools | BK → wizard → Brain |
| Pricing | `knowledgeItems.pricing` | Brain / resolveBusinessAnswer | Voice | BK → wizard → Brain |
| Policies | `knowledgeItems.policies` | Brain knowledgeFacts | Voice | BK → wizard → Brain |
| Website | `websiteUrl` + KB/crawl | Brain `website`, RAG sources | RAG, Brain, MCTB website | BK → wizard + KB APIs |
| FAQs | Approved Q&A rows or `faqs` item | Text `VoiceKnowledgeSource` after gap resolve | RAG + hot summaries | BK → wizard and/or KB |
| Hours (structured) | `operatingMaturity.businessSchedule` | Derived Amy display via `compileBusinessHoursAmyDisplay` | operating policy, hot `hoursDisplay`, Brain `businessHoursSummary` (from approved hours **prose** item today) | Schedule → compile; prose derived |
| Timezone | `businessSchedule.timezone` | `state.timezone` mirror (compat) | compile TZ, on-call TZ default | schedule → `state.timezone` one-way |
| Holidays | `businessSchedule.holidays` | — | operating policy | BK editor only |

---

## 11. Business Hours & Timezone Specification

**Ownership:** Business Knowledge hosts the only customer-editable business schedule.

**Component:** Reuse `BusinessScheduleEditor` from `operating-maturity-editor.tsx` without forking.

**Includes:** weekly schedule, closed days, intervals (first range per day as today), holidays, timezone field on schedule, effective summary line (read-only, from `formatWeeklyHoursForAmy` / same helper as Receptionist `formatHoursSummary`).

**Save path:**

```
UI patch operatingMaturity
  → POST appointment-receptionist wizardStepId: "call-handling"
  → merge-wizard-state-on-save preserves other call-handling fields
  → compile on publish uses ensureWizardOperatingMaturity
```

**Also:** one-way mirror `state.timezone = businessSchedule.timezone` on save (implementation) for legacy readers.

**Remove** `BusinessScheduleEditor` from Call Handling and Information step when BK ships (implementation boundary).

---

## 12. Timezone Compatibility Plan

**Canonical:** `operatingMaturity.businessSchedule.timezone`

**Readers of `state.timezone` (must receive mirror, not separate UI):**

- `syncCompanyBrainFromWizard` → `defaultTimezone`
- `compileVoiceV3AgentConfig` (currently **prefers** `wizard.timezone` first — **implementation:** invert preference to `businessSchedule.timezone` first, then `state.timezone` fallback, or stop writing divergent `state.timezone`)
- `build-agent-config.ts`, `activate-hooks.ts`, `build-business-context.ts`, `recompile.ts`, scripts (unchanged reads OK if mirror kept)
- `ensureWizardOperatingMaturity` already merges schedule TZ over `state.timezone`

**Migration-free plan:**

1. BK editor only mutates `businessSchedule.timezone`.  
2. On successful call-handling save from BK, set `state.timezone` to same IANA string.  
3. Compiler change (flagged): `timezone = maturity.businessSchedule.timezone || wizard.timezone` — **only if** mirror proves insufficient; prefer mirror first.  
4. Remove any standalone timezone control from Information/Receptionist (already removed on Receptionist Pass 2).

---

## 13. Business Hours Prose Plan

**Three representations today:**

1. Structured `operatingMaturity.businessSchedule` (**scheduling authority**)  
2. `knowledgeItems[id=hours].summary` (prose)  
3. Brain `businessHoursSummary` (from approved hours item on sync)

**Preferred product behavior:**

- Structured schedule **generates** Amy’s primary hours text (`compileBusinessHoursAmyDisplay` → `hoursDisplay`).  
- UI shows **read-only** “How Amy describes your hours” when structured exists, with optional **advanced override** textarea for `knowledgeItems.hours` only if `hoursProseConflictsWithStructured` warning is shown.  
- Default onboarding: **do not** ask for duplicate prose; auto-mark hours item complete from structured on save (implementation helper).  
- MCTB `business_hours` continues to use Brain summary → keep syncing **derived prose** from structured formatter into Brain on save (implementation), not a third manual field.

---

## 14. Website Ingestion UX

**Single workflow** combining crawl → RAG indexing → suggestions review.

### Customer-visible stages

| # | Customer label | Backend |
|---|----------------|---------|
| 1 | No website | `websiteUrl` empty |
| 2 | Add your website | URL captured |
| 3 | Discovering pages | `VoiceWebsiteCrawlJob.status = DISCOVERING` |
| 4 | Reading website | `CRAWLING` |
| 5 | Preparing search | sources `processing`, vector wait |
| 6 | Ready for Amy to search | job `READY`/`PARTIAL`, sources `indexed` |
| 7 | Details found for review | `job.suggestions` populated |
| 8 | Waiting for your review | suggestions not applied to `knowledgeItems` |
| 9 | Added to business information | approved items `owner_approved` / `complete` |
| 10 | Some pages could not be read | `PARTIAL`, `errorSummary` |
| 11 | Website could not be processed | `FAILED` |
| 12 | Try again | re-enqueue crawl |

**Actions:** Save URL to wizard (`information` save) → “Scan website” calls `POST /api/voice/knowledge` `action: scan_website` (existing) → poll job status (new read API or extend GET KB detail in implementation).

---

## 15. Website Status Semantics

**Two truths (must not conflate):**

| State | Customer copy |
|-------|----------------|
| **Searchable** | “Amy can search this website when callers ask questions.” (indexed RAG) |
| **Approved core facts** | “Review these details before they’re added to Amy’s core business information.” (suggestions queue) |

RAG may work **before** owner approves suggestions. UI never implies approval is required for search if runtime allows post-index retrieval.

---

## 16. Discovered Fact Review

**Canonical queue:** `VoiceWebsiteCrawlJob.suggestions` (structured: phone, services, hoursText, serviceArea, etc. from `extract-business-suggestions.ts`).

**Do not** maintain parallel placeholder-only `knowledgeItems` from `itemsForScanResult` as a second queue—transition to:

- Display suggestions from **latest crawl job** for workspace/KB  
- On approve/edit: write to appropriate `knowledgeItems` + statuses `owner_approved` / `complete`  
- Dismiss: store dismissed suggestion keys on job or wizard meta (implementation—no schema migration preferred: wizard `conversationBehaviors` or crawl job JSON)

**Actions per row:** title, proposed value, source “From your website”, Approve, Edit then approve, Dismiss. **No bulk approve** for pricing/policies without explicit confirmation.

---

## 17. Knowledge Sources Specification

Preserve `VoiceKnowledgeBase` + `VoiceKnowledgeSource` model.

**Presentation:** Medium-density **table** (name, type, status, updated, actions)—not one card per document.

**Row actions:** Reindex (POST `action: reindex`), Delete (confirm), optional View snippet (collapsed).

**Types:** `text`, `url`, `file`, website-derived URL sources from crawl.

**Link agent:** Show `linkedKnowledgeBaseId` from wizard; changing link = `information` save + may need agent publish for compile metadata—not for RAG search at tool time if link saved.

---

## 18. Source Status Mapping

Derived from `knowledge-processor.ts` and schema defaults:

| DB / internal | Customer label | Notes |
|---------------|----------------|-------|
| `pending` | Waiting to process | Rare after create |
| `processing` | Processing | In-flight |
| `indexed` | Ready for search | RAG retrievable |
| `active` | Needs processing | **Gap-resolve bug:** created as `active` without index—treat as “Processing” or “Needs attention” until `processKnowledgeSource` |
| `failed` | Needs attention | Show `errorMessage` sanitized |
| `ready` | Ready | Legacy/alternate—map to Ready for search |
| KB `telnyxEmbeddingStatus` | **Hide** | Do not show bucket/embeddings in customer UI |

---

## 19. FAQs / Approved Facts

**Canonical:** subsection under **Core business information** using `knowledgeItems[faqs]` for simple FAQ block **plus** gap-resolved text sources in KB.

**Priority at runtime** (`resolveBusinessAnswer`): structured Brain/hot → topic handlers → RAG search → fallbacks.

**Do not** duplicate the same Q&A as both hot fact and separate source without sync; gap resolution **creates** KB source—optionally also add summary to `faqs` item or leave RAG-only with UI showing “Answered via knowledge source”.

---

## 20. Unanswered Questions

**Canonical home:** Business Knowledge (`#knowledge-gaps`).

**Keep** call-level visibility on Call Detail (link only).

**Queue fields:** question, caller wording (`recentWording`), related call links (`/voice/calls/:id`), times asked, status OPEN/DISMISSED/RESOLVED, resolve with answer + KB picker (existing panel).

---

## 21. Knowledge Gap Reindex Fix Plan

**Verified defect (master):**

```
PATCH knowledge-gaps RESOLVED
  → appendApprovedAnswerToKnowledgeBase (creates source, status active)
  → updateVoiceKnowledgeGapStatus
  — missing processKnowledgeSource(source.id)
```

**Implementation fix (required):**

1. In `appendApprovedAnswerToKnowledgeBase`, after `create`, capture `source.id`.  
2. Invoke `await processKnowledgeSource(source.id)` (same as `sources/route.ts`).  
3. On failure: set gap remains OPEN or new status `RESOLVED_PENDING_INDEX` (optional), surface error on gap row, allow Retry reindex.  
4. UI: after resolve click, show **Processing** until `status === indexed`; only then show “Amy can search this answer”.  
5. Hot context: resolved FAQ is **not** in hot context unless also copied to `knowledgeItems`—do not claim “Amy knows this” for live PSTN hot context without publish; **do** claim searchable when indexed.

**Sync vs async:** `processKnowledgeSource` may await vector store; use async job only if request timeout—prefer same pattern as upload route (await with loading UI).

---

## 22. Company Brain Relationship

| Surface | Role |
|---------|------|
| **Business Knowledge** | Voice customer-facing editor for facts, hours, website, sources, gaps |
| **/company-brain** | Shared workspace brain for multi-agent / legacy hire flows; **read-mostly** for Voice customers |
| **Sync** | `syncCompanyBrainFromWizard` on receptionist save—BK must use same API path |

**What BK edits directly:** wizard fields + KB APIs + gap API + schedule via wizard.

**What auto-syncs:** Brain mirrors approved wizard facts (not raw crawl suggestions).

**What links out:** Company Brain as “Advanced / shared workspace knowledge”.

**Never:** delete Brain data when consolidating UI.

---

## 23. MCTB Dependency Protection

On each BK save (`syncCompanyBrainFromWizard`):

| MCTB field | Source after BK |
|------------|-----------------|
| business_name | Brain `businessName` from `state.businessName` |
| business_hours | Brain `businessHoursSummary` (derive from structured + sync plan) |
| services | Brain `services` from appointment types |
| website | Brain `website` |
| knowledge_facts | Brain `knowledgeFacts` from approved items |
| policies/pricing | Via knowledgeFacts / summaries |

**Test:** changing BK must not clear Brain; blocked statuses in MCTB loader still apply.

---

## 24. Call Handling Dependency

After BK migration, Call Handling shows **read-only** summary:

```
Business hours
Mon–Fri · 8:00 AM–5:00 PM · Eastern
Used to determine when after-hours rules apply.
Manage business hours → /voice/knowledge#hours
```

**Remove** `BusinessScheduleEditor` from `call-handling-operational-page.tsx` (implementation).

On-call schedule editor **stays** on Call Handling (not BK).

---

## 25. Receptionist Dependency

Pass 2 (`voice-receptionist-editor.tsx`): read-only hours + link—**conforms**.

No hours/timezone editor on Receptionist. BK implementation must not reintroduce.

**Certification note (Receptionist):** `pendingPublication` is session-local; unrelated to BK but publish copy should align.

---

## 26. Status / Readiness

**Derived banner** (no percentage score):

| Condition | Message |
|-----------|---------|
| Missing business name | “Add your business name” |
| Website processing | “Website is still being prepared for search” |
| No linked KB + RAG expected | “Connect a knowledge base or add sources” |
| Failed sources | “N sources need attention” |
| Open gaps | “N unanswered questions” |
| Suggestions pending | “N details from your website need review” |
| Schedule empty | “Business hours not set” |

Multiple bullets allowed; no “85% complete”.

---

## 27. Standard Fact Row

```
[Label]                    [Optional status pill]
[Value preview or em dash]
[Edit] or inline field on edit mode
```

Classes: `flex flex-wrap items-start justify-between gap-2 py-3 border-b border-border last:border-0`

Mobile: stack label above value; full-width Edit.

---

## 28. Source List

| Region | Desktop | Mobile |
|--------|---------|--------|
| Name | col 1 | row title |
| Type | col 2 icon + label | subtitle |
| Status | col 3 pill | pill under title |
| Updated | col 4 `text-muted-foreground` | hide or short date |
| Actions | col 5 Reindex · Remove | menu or stacked buttons |

Processing: spinner + “Processing”; failed: `text-danger` + Retry.

---

## 29. Review Queue

**Shared visual language** (bordered row, Needs review pill) but **separate lists**:

- Website discovered facts (from crawl suggestions)  
- Unanswered questions (gaps)

Do not merge into one sortable list (different actions and persistence).

---

## 30. Save Semantics

| UI region | Persistence authority | Save behavior | Runtime availability | Compatibility sync |
|---------|----------------------|---------------|----------------------|-------------------|
| Core facts | wizard `information` | Section Save or auto-debounce → appointment-receptionist API | Hot context after **publish** | Brain on save |
| Hours/holidays | wizard `call-handling` (`operatingMaturity`) | Section Save | Operating policy after **publish** | Mirror `state.timezone`; Brain hours summary |
| Website URL | wizard `information` | Save URL button | Crawl on explicit Scan | Brain website on save |
| Scan/crawl | KB + crawl job APIs | Immediate POST scan_website | RAG when indexed | — |
| Add text/url/file source | KB source APIs | Immediate per action | After `processKnowledgeSource` | — |
| Approve suggestion | wizard `information` | Per approval | Hot after publish | Brain |
| Resolve gap | gap PATCH + KB | Immediate | Searchable after **index fix** | — |
| Link KB | wizard `information` | Save link | Retrieval when saved + indexed | — |

**No single Save for entire page.**

---

## 31. Publish / Live Availability Semantics

| Change | Saved immediately? | Requires processing? | Requires Voice publish? | When live Amy sees it |
|--------|-------------------|----------------------|-------------------------|------------------------|
| knowledgeItems / businessName | Yes (wizard save) | No | **Yes** for PSTN compiled hot context | After publish |
| businessSchedule | Yes (call-handling save) | No | **Yes** for after-hours policy in compiled config | After publish |
| Company Brain mirror | On wizard save | No | N/A | MCTB/immediate Brain readers |
| New indexed source | Yes | **Yes** (`processKnowledgeSource`) | **No** for RAG tool search at runtime* | When `indexed` |
| Website crawl | Yes | **Yes** | No for search; yes for hot facts on approve + publish | Staged |
| Gap answer (post-fix) | Yes | **Yes** | No for RAG; not hot unless item added | When indexed |
| linkedKnowledgeBaseId | Yes | No | **Yes** for compile metadata / retrieval bundle at publish | After publish for embedded config; live search may still use DB |

\*Live calls load published config snapshot; tool handlers that call `searchKnowledge` directly still benefit from new indexed content without republish—UI must say **“Searchable on calls”** vs **“In Amy’s published instructions”** where both exist.

---

## 32. Six UI States

| State | Behavior |
|-------|----------|
| Normal | All sections populated |
| First-use | Honest empties; CTAs to add name, hours, website |
| Loading | Skeleton per section; no default facts as truth |
| Error | Per-region retry; API message |
| Partial | e.g. website searchable but review pending; one failed source |
| Success | Precise: Saved / Approved / Processing / Ready for search / Published (link Receptionist) |

---

## 33. Responsive Contract

- 320px: single column; schedule rows wrap; table → cards  
- 200% zoom: no clipped controls; schedule checkboxes keyboard accessible  
- All regions remain usable on mobile (no hid­ing delete/review)

---

## 34. Accessibility

- One H1 (`PageHeader`)  
- Section `h2`/`h3` hierarchy  
- Labels on all inputs; schedule day checkboxes named  
- `aria-live` on processing status  
- Status not color-only (text + icon)  
- Confirm before source delete  
- Approve/Dismiss buttons name the fact/question  
- No drag-only uploads (file input + button)

---

## 35. Component Reuse Matrix

| Future region | Existing component | Source | Reuse unchanged? | Adapter? | Persistence risk | Runtime risk |
|---------------|-------------------|--------|------------------|----------|------------------|--------------|
| Hours | BusinessScheduleEditor | operating-maturity-editor.tsx | Yes | Wrap in BK save footer | call-handling merge | Low |
| Gaps | KnowledgeGapsPanel | knowledge-gaps-panel.tsx | Mostly | Styling, KB default from wizard link | gap API | **High** until reindex fix |
| Sources | knowledge page table | voice/knowledge/page.tsx | Partial | Strip dev test; customer copy | KB APIs | Low |
| Website scan | InformationStep flow | information-step.tsx | Logic only | Extract hook/service | crawl + wizard | Medium |
| Facts | InformationStep guided rows | information-step.tsx | Partial | Row template | information merge | Low |
| Brain | CompanyBrainSetup | company-brain | No mount | Link only | Brain API | Medium if bypass sync |
| Save | receptionist-editor-persist | Pass 2 | Pattern | New `knowledge-editor-persist.ts` | step IDs | Low |
| Status | Receptionist DependencyRow | receptionist | Read-only elsewhere | — | — | — |

---

## 36. Business Fact Source-of-Truth Matrix

| Customer fact | Current representations | Proposed authority | Mirrors | Compiler/loader | Voice | MCTB |
|---------------|-------------------------|-------------------|---------|-----------------|-------|------|
| business name | businessName, business item, Brain | BK fields | Brain | compile name | yes | yes |
| description | business item | BK | Brain facts | hot context | yes | facts |
| services | services item, appointmentTypes | BK + types read-only hint | Brain services | hot | yes | yes |
| service area | service_area item (optional) | BK | Brain | resolveBusinessAnswer | yes | optional |
| pricing | pricing item | BK | Brain | hot | yes | facts |
| policies | policies item | BK | Brain | hot | yes | facts |
| website | websiteUrl, KB crawl | BK website section | Brain | RAG + Brain | yes | yes |
| FAQs | faqs item, text sources | BK | KB sources | RAG + summaries | yes | facts |
| hours | businessSchedule, hours item, Brain summary | **businessSchedule** | derived prose + Brain | compileBusinessHoursAmyDisplay | yes | hours string |
| timezone | businessSchedule.tz, state.timezone | **businessSchedule.tz** | state.timezone | compile | yes | via Brain TZ |
| holidays | businessSchedule.holidays | BK editor | — | operating policy | yes | — |

---

## 37. Website Pipeline Matrix

| Customer stage | Backend state | Persistence | RAG | Hot context | UI action |
|----------------|---------------|-------------|-----|-------------|-----------|
| No website | — | — | — | — | Enter URL |
| URL saved | wizard websiteUrl | information save | — | — | Save |
| Discovering | job DISCOVERING | VoiceWebsiteCrawlJob | — | — | Scan |
| Crawling | CRAWLING | job + pages | sources creating | — | Wait |
| Processing | source processing | VoiceKnowledgeSource | indexing | — | Wait |
| Searchable | job READY, indexed | KB | yes | — | Show success |
| Facts found | suggestions JSON | job | yes | — | Show review list |
| Awaiting review | — | — | yes | — | Approve/dismiss |
| Approved | knowledgeItems updated | wizard | yes | after publish | Approve |
| Partial | PARTIAL | job | partial | — | Retry failed |
| Failed | FAILED | job | no | — | Retry scan |

---

## 38. Knowledge-Gap Pipeline Matrix

| Stage | Backend | Persistence | Indexing | Customer state |
|-------|---------|-------------|----------|----------------|
| Asked on call | gap create/update | VoiceKnowledgeGap OPEN | — | Appears in queue |
| Owner enters answer | PATCH RESOLVED | gap + source create | **must process** | Processing |
| Indexed | processKnowledgeSource | source indexed | yes | Ready for search |
| Failed index | source failed | errorMessage | no | Needs attention + Retry |
| Dismissed | PATCH DISMISSED | gap | — | Hidden from open |
| Hot context copy (optional) | wizard item | information save | — | Needs publish |

---

## 39. Exact Text Wireframe

```
BUSINESS KNOWLEDGE
│
├─ PAGE HEADER (PageHeader)
│
├─ KNOWLEDGE STATUS (InfoCallout / bullets — real counts)
│
├─ NEEDS YOUR REVIEW (optional combined strip)
│  ├─ Website details (N) → jump
│  └─ Unanswered questions (N) → jump
│
├─ CORE BUSINESS INFORMATION (Card)
│  ├─ Fact rows (business, services, service area, pricing, policies)
│  └─ [Save business information] → wizardStepId information
│
├─ BUSINESS HOURS & TIMEZONE (id=hours) (Card + BusinessScheduleEditor)
│  ├─ Read-only "How Amy describes…" when structured set
│  └─ [Save hours] → wizardStepId call-handling (operatingMaturity slice)
│
├─ WEBSITE (Card)
│  ├─ URL input + Save / Scan website
│  ├─ Status stepper (customer labels §14)
│  └─ Discovered details review rows
│
├─ FAQs (subsection or Card)
│
├─ KNOWLEDGE SOURCES (Card + Table)
│  ├─ Linked knowledge base selector
│  ├─ Add text | URL | Upload
│  └─ Source rows
│
└─ UNANSWERED QUESTIONS (id=knowledge-gaps) (KnowledgeGapsPanel)
```

---

## 40. Density Review

| Item | Estimate |
|------|----------|
| Always-visible editors | Facts (~6 rows), full schedule (~7 days + holidays), URL row |
| Source rows | Often 5–20 after crawl |
| Review burden | 0–10 suggestions + 0–15 gaps |
| Desktop page length | ~3–5 viewports |
| Mobile | Heavier; anchor nav helps |
| Disclosure | Collapse “Test search” (dev); collapse FAQ if empty |

---

## 41. Visual Failure Checklist

| Failure | Spec avoids |
|---------|-------------|
| Giant hero | ✓ |
| Card soup | ✓ one card per major section only |
| Source card per doc | ✓ table rows |
| Giant upload panel | ✓ inline in sources |
| Huge empty states | ✓ compact |
| Completion score | ✓ |
| RAG/Brain jargon | ✓ customer labels §18 |
| Duplicate hours editors | ✓ calls out Call Handling fix |
| Duplicate timezone | ✓ |
| Multiple unclear Saves | ✓ labeled per region |
| Fake “Amy knows” | ✓ publish/index matrix §31 |

---

## 42. Implementation Risks

| Risk | Mitigation |
|------|------------|
| Split wizard step ownership | BK persist helper with sequential saves (information + call-handling) |
| Call Handling regression | Replace editor with summary in same PR as BK hours |
| Gap fix timeout | Async job + polling UI |
| MCTB Brain drift | Always route saves through appointment-receptionist + sync |
| Compiler TZ order | Mirror + optional compile tweak |
| Crawl/wizard desync | Single website section owns URL + job polling |
| Pass 2 not on master yet | Merge order: land Pass 2 before BK UI |

---

## 43. Exact Implementation Boundary

### Phase A — UI consolidation (primary)

- Replace `src/app/(app)/voice/knowledge/page.tsx` with BK workspace shell  
- New `src/components/voice/knowledge/business-knowledge-editor.tsx` (or similar)  
- Extract fact rows / website workflow from `information-step.tsx` **without** mounting full wizard step  
- Reuse `BusinessScheduleEditor`, `KnowledgeGapsPanel`  
- `knowledge-editor-ownership.ts` / `knowledge-editor-persist.ts` modeled on Receptionist  
- Remove schedule UI from `information-step.tsx` and `call-handling-operational-page.tsx`  
- Customer-facing copy; remove Telnyx/bucket/dev search from default view  

### Phase B — Compatibility synchronization

- `state.timezone` mirror on schedule save  
- Optional: derive `knowledgeItems.hours` + Brain `businessHoursSummary` from structured schedule  
- Crawl suggestions approval → `knowledgeItems` + save  

### Phase C — Functional bug fixes (required)

- `appendApprovedAnswerToKnowledgeBase` → `processKnowledgeSource`  
- Gap UI processing states + retry  
- Website job status polling endpoint if missing  

### Protected files (avoid casual edits)

- `compile-voice-v3-agent-config.ts` (only TZ precedence if Phase B requires)  
- `knowledge-processor.ts` (consumer only unless bugfix)  
- `run-crawl-job.ts` / crawl pipeline  
- `loadBusinessBrain` / Brain storage shape  
- MCTB lead recovery engines  
- Prisma schema  

### Files expected to change (non-exhaustive)

- `src/app/(app)/voice/knowledge/page.tsx`  
- `src/components/voice/knowledge/**`  
- `src/lib/voice-v3/knowledge-gaps/owner-service.ts`  
- `src/app/api/voice/knowledge-gaps/route.ts` (error handling)  
- `src/components/solutions/appointment-receptionist/steps/information-step.tsx` (remove duplicate sections)  
- `src/components/voice/call-handling-operational-page.tsx` (read-only hours)  
- Possible `src/app/api/voice/knowledge/**` (crawl status read)  

---

BUSINESS KNOWLEDGE PAGE SPEC COMPLETE — READY FOR IMPLEMENTATION REVIEW
