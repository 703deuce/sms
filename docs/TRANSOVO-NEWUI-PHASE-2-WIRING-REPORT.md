# New UI Phase 2 — Backend/data wiring report

**Branch:** `cursor/newui-stage2-transplant-2304`  
**Scope:** Connect approved Opus Stage 2 UI to existing production APIs. **No intentional UI/layout/copy changes.**

## Route wiring summary

| Route | Real reads | Real writes/actions | Remaining mock/fake (active Stage 2 path) | Deferred (no production UI in Opus) | UI changed? |
|-------|------------|----------------------|-------------------------------------------|-------------------------------------|-------------|
| `/voice/overview` | `loadVoiceOverviewSummary` | Links only | None on connected page | — | NO |
| `/voice/calls` | `GET /api/voice/calls` | Filters local; pagination UI disabled | None | Server pagination | NO |
| `/voice/calls/[id]` | `GET /api/voice/calls/:id` | Call back (`tel:`) | Detail layout is connected adapter (not full mirror transcript blocks) | Recording URL, lifecycle steps, open conversation | NO |
| `/voice/analytics` | `GET /api/voice/analytics` | Range toggle | Booked series approximated from totals | — | NO |
| `/voice/receptionist` | `GET /api/voice/overview` | — | Capability rows still static Opus copy | Full receptionist editor fields | NO |
| `/voice/knowledge` | `GET /api/voice/knowledge-gaps`, `GET /api/mctb/ai-recovery/context` | Gap dismiss/add, save, crawl, FAQ CRUD | FAQs, sources, hours table, save button | Source upload/crawl mutations | NO |
| `/voice/call-handling` | — | — | Entire page still Opus demo data | Transfer list, switches, recent transfers (no 1:1 API) | NO |
| `/voice/numbers` | `GET /api/mctb/numbers` | Refresh, add link | — | Per-number actions beyond table | NO |
| `/mctb` | `loadMctbOverview` | — | — | — | NO |
| `/mctb/missed-calls` | `GET /api/mctb/missed-calls` | Filters local | Stat deltas still decorative Opus | Server-driven filters/pagination | NO |
| `/mctb/missed-calls/[id]` | `GET /api/mctb/missed-calls/:id` | — | Simplified connected detail vs full mirror lifecycle | Full mirror sections | NO |
| `/mctb/conversations` | Inbox list + `fetchConversation` | `sendNewMessage` → `/api/sms/send` | Optimistic local bubble after send | Mine/Unassigned/Closed/Spam filters | NO |
| `/mctb/ai-recovery` | `GET /api/mctb/ai-recovery/context` | `POST /api/mctb/ai-recovery/settings` (save bar) | Per-field toggles not persisted individually | Booking link pickers beyond Opus | NO |
| `/mctb/voicemail` | `GET /api/phone/voicemail` | — | — | Mark reviewed if not in Opus | NO |
| `/mctb/analytics` | `loadMctbAnalytics` / `GET /api/mctb/analytics` | Range toggle | — | — | NO |
| `/mctb/setup` | `GET /api/mctb/setup` | — | Activity log rows static | Pause button, per-row readiness | NO |
| `/mctb/setup/phone` | `GET /api/mctb/setup` | SaveBar → `POST /api/mctb/setup` (minimal) | Carrier/ring/instructions still Opus | Full forwarding wizard | NO |
| `/mctb/setup/consent` | Setup + consent prompt | Save/Publish → `POST /api/mctb/setup` | — | — | NO |
| `/mctb/setup/text-back` | `GET /api/mctb/setup` | Save → `POST /api/mctb/setup` | — | — | NO |
| `/mctb/setup/exclusions` | `GET /api/mctb/exclusions` | Add/delete exclusions | — | — | NO |
| `/mctb/setup/recovery` | — | — | Opus demo controls | Cooldown/pause APIs | NO |
| `/mctb/setup/voicemail` | — | — | Opus demo | Greeting editor runtime | NO |
| `/mctb/setup/notifications` | — | — | Opus demo | Notification prefs API | NO |
| `/mctb/setup/links` | — | — | Opus demo | Booking links API | NO |
| `/mctb/setup/test` | — | — | Opus demo | Live test pipeline | NO |

## Global checklist

1. **Active Stage 2 `sandbox-data` imports:** Fallbacks remain in mirror/components for dev-only paths; **app routes no longer import mirror `Transplant*` pages.** Production Stage 2 uses `connected/*` + `OpusWorkspaceDataProvider`.
2. **Mock arrays:** Inbox/mirror still contain sandbox fallbacks when props omitted; Stage 2 connected pages pass real arrays.
3. **Fake `setTimeout` saves:** Removed from `SaveBar` when `onSave` provided; consent/text-back/exclusions/ai-recovery use real saves.
4. **Local-only fake mutations:** Exclusions and inbox send use production APIs.
5. **Hardcoded demo business:** Sidebar/topbar/workspace strip use `/api/mctb/setup` via `OpusWorkspaceDataProvider`.
6. **Controls not connected:** Call-handling Opus controls; setup recovery/voicemail/notifications/links/test save actions; voice call detail mirror fields; knowledge FAQs/sources/crawl/save.
7. **No new production UI features added.**
8. **No legacy editor substitution** (`NewUiLegacyEditorPage` unused on Stage 2 routes).
9. **Opus sidebar/nav unchanged** (`NAV` + transplant shell).
10. **Presentation still sourced from `newui/` transplant** (`src/newui-transplant/`).
11. **`newui/` directory untouched.**
12. **Legacy production implementations preserved** under `src/components/**` for later inventory pass.

## Architecture

`production API/service → thin adapter or connected client loader → Opus component (optional \`wired\` props)`
