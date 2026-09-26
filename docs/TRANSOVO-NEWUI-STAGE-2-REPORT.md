# New UI → Production — Stage 2 consolidated report

**Branch:** `cursor/newui-stage2-transplant-2304` (from Stage 1 `cursor/newui-shell-stage1-2304`)  
**Rule:** **Change the boundary, not the component.**  
**Stage 3:** not started (gaps below).

---

## Coverage (25 audited routes)

| Route | Transplanted | Real reads | Writes (where New UI had them) | Category B deferred |
|-------|--------------|------------|--------------------------------|---------------------|
| `/voice/overview` | Yes | `loadVoiceOverviewSummary` | — | Attention/deps copy vs full legacy dashboard |
| `/voice/calls` | Yes | `GET /api/voice/calls` | — | Legacy table features in `calls-legacy-page.tsx` |
| `/voice/calls/[id]` | Yes | production detail loader/API | — | Full recording/timeline vs legacy detail |
| `/voice/receptionist` | Partial | existing editor data | legacy editor saves | Full newui static layout |
| `/voice/knowledge` | Partial | existing editor | legacy saves | Full newui layout |
| `/voice/call-handling` | Partial | persisted state | switch via existing ops page | Full newui layout; **no nav Telnyx regression** (Stage 1 arch preserved) |
| `/voice/analytics` | Yes | production analytics loaders | — | Chart metric parity |
| `/voice/numbers` | Yes | numbers API | — | Buy/drawer flows |
| `/mctb` | Yes | `loadMctbOverview` | — | Activity feed depth |
| `/mctb/missed-calls` | Yes | `loadMctbMissedCallsListData` | — | Filter URL parity with legacy |
| `/mctb/missed-calls/[id]` | Yes | detail API | — | Full lifecycle timeline (legacy kept) |
| `/mctb/conversations` | Yes | `GET /api/inbox` | send **deferred** | Eligibility/composer (Stage 3) |
| `/mctb/ai-recovery` | Shell | production page data | legacy saves | Full newui editor wiring |
| `/mctb/voicemail` | Yes | voicemail API | — | Workspace actions vs legacy |
| `/mctb/analytics` | Yes | MCTB analytics loaders | — | Drilldown parity |
| `/mctb/setup` | Shell | setup overview loader | — | Pure newui setup IA |
| `/mctb/setup/phone` … `test` (10) | Shell + editors | existing setup GETs | **SaveBar/demo saves deferred** on several | Consent/exclusions POST wiring |

**Not in Stage 2 list:** `/mctb/setup/missed-call-rules` remains **Category C / legacy** (no newui page).

---

## Exact-code integrity

### Transplanted once under `src/newui-transplant/`

- **App:** `kit`, `button-link`, `charts`, `link-tabs`, `range-toggle`, `save-bar`, `status`, `app-sidebar`, `topbar` (shell)
- **Voice:** `calls-browser`, `recent-calls-table`
- **MCTB:** `inbox`, `missed-calls-browser`, `voicemail-browser`, `consent-editor`, `exclusions-table`, `text-back-editor`
- **UI primitives:** `button`, `input`, `sidebar`, `sheet`, … + `chart`, `checkbox`, `dialog`, `dropdown-menu`, `label`, `select`, `switch`, `textarea`
- **Types:** `lib/view-models.ts` (no mock arrays)
- **Sync script:** `scripts/sync-newui-transplant.mjs`

### Meaningful diffs vs `newui/` (integration only)

| Area | Why |
|------|-----|
| Import paths | `@/newui-transplant/...` |
| Browser components | Props for `calls`, `missedCalls`, `voicemails`, `conversations`, `business` instead of `@/lib/data` |
| `app-sidebar` / `topbar` | Production nav/session boundaries (Stage 1) |

`newui/` **untouched**.

---

## Mock elimination

| Check | Result |
|-------|--------|
| `@/lib/data` in `src/newui-transplant/**` | None (README only) |
| `VOICE_CALLS` / `MISSED_CALLS` constants in transplant runtime | Removed — props/adapters |
| Fake `setTimeout` saves | **Still present in `SaveBar` demo paths** — Stage 3 |

---

## Production integration

| Layer | Location |
|-------|----------|
| Feature flag | `isNewUiStage2Enabled()` — `NEXT_PUBLIC_NEWUI_STAGE2=0` rollback |
| Adapters | `src/lib/newui-transplant/adapters/*` (thin DTO → view model) |
| Connected pages | `src/newui-transplant/connected/**` |
| Legacy preserved | `*-legacy-page.tsx`, existing `*View` / `*Dashboard` components |

No duplicate backend systems introduced.

---

## Functional preservation (Stage 3)

Legacy implementations remain importable behind `isNewUiStage2Enabled() === false` or embedded in Category B shells:

- `VoiceOverviewDashboard`, `MctbOverviewView`, `MctbMissedCallsView`, call detail legacy, inbox composer, setup save flows, consent/exclusions APIs, voicemail workspace, numbers purchase drawer.

---

## Performance / call handling

- Stage 1 certified: **0** browser `GET /api/call-handling` on shell navigation; layout read stays DB/config-only.
- Stage 2: no intentional reintroduction of mount-time call-handling GET or passive Telnyx reconciliation.
- List pages prefer existing loaders/APIs over duplicate mock fallbacks (`MOCK_CALL_ROWS` bypassed when Stage 2 on for `/voice/calls`).

---

## Validation

| Type | Result |
|------|--------|
| Static grep mock imports | Pass |
| Runtime (Stage 2 batch) | **Deferred** — same low-RAM policy as Stage 1; recommend one session after merge: overview + calls + mctb + one setup route |
| `next build` | Not run (checkpoint / Coolify) |

---

## Git

- **Branch:** `cursor/newui-stage2-transplant-2304`
- **Commits:** stage2 adapters + sync; voice routes; MCTB routes (+ Stage 1 cert on ancestry)
- **Legacy deletion:** none
- **Rollback:** `NEXT_PUBLIC_NEWUI_SHELL=0` and/or `NEXT_PUBLIC_NEWUI_STAGE2=0`

---

## Dependencies added (transplant-required)

- `class-variance-authority` (Stage 1 cert)
- `recharts` (newui charts)

---

## Stop before Stage 3

Stage 2 safe transplant pass complete. Next: Category B write-path completion, compliance gates on editable controls, batched functional certification.
