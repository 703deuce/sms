# MCTB Pass 1 — Shell, Navigation & Inbox Implementation

## 1. Executive summary

Pass 1 implements approved IA exposure without rewriting MCTB runtime: **seven-destination MCTB navigation** (Voice IA removed from MCTB local nav), **canonical `/mctb/ai-recovery`** with legacy redirect, and **shared Inbox extensions** that mount existing handoff APIs (`mctbConversationAutomationState`, take over / resume / follow-up) via `MctbRecoveryContextPanel`. Generic Inbox AI Assist automation ownership is suppressed for `productSource === "mctb"` threads so it does not compete with MCTB recovery automation.

**Finish line:** Owner UI certification required (browser/live).

## 2. Files changed

| Area | Files |
|------|--------|
| Nav | `src/lib/products/mctb-nav.ts` |
| Routes | `src/lib/mctb/routes.ts`, `next.config.ts` |
| AI Recovery route | `src/app/(app)/mctb/ai-recovery/page.tsx`, `src/app/(app)/mctb/ai-lead-recovery/page.tsx` |
| Inbox | `src/components/inbox/conversations-thread-area.tsx`, `src/components/ai-replies/inbox-ai-assist-panel.tsx` |
| Recovery panel | `src/components/mctb/handoff/mctb-recovery-context-panel.tsx`, `mctb-handoff-context-panel.tsx` (re-export) |
| Presentation | `src/lib/mctb/inbox/is-mctb-thread.ts`, `thread-presentation.ts` |
| API (narrow) | `src/app/api/mctb/handoff/context/route.ts` (workspace conversation guard) |
| Links | `src/lib/mctb/overview.ts`, `mctb-home-sections.tsx`, `setup-recovery-view.tsx` |
| Tests | `scripts/test-mctb-pass-1-shell-inbox.ts`, `scripts/test-mctb-nav-ia.ts`, `scripts/test-product-shell.ts` (nav assertions) |

## 3. Shell architecture before / after

**Before:** `buildMctbV1Nav({ hasVoice: true })` injected AI Receptionist destinations (Overview, Calls, AI Agent → `/mctb/voice-agent`, Knowledge, Call Rules) above MCTB items — Voice looked like part of MCTB.

**After:** MCTB shell shows only MCTB operational/config destinations + shared Integrations/Numbers/Billing/Settings. Voice remains on **`ai_after_hours` product shell** via existing product switcher (`visibleProductShells`, `ProductShellSwitcher`). `hasVoice` on `MctbNavOptions` is deprecated and ignored for nav injection.

## 4. Entitlement behavior

| Case | Behavior |
|------|----------|
| MCTB only | Seven MCTB nav items; no Voice routes in MCTB sidebar |
| Voice only | Unchanged — `buildAiAfterHoursNav` / six-page Voice IA |
| Both | Product switcher; separate shells — nav lists are **not** concatenated |

## 5. Final MCTB nav (core)

1. Overview → `/mctb`
2. Missed Calls → `/mctb/missed-calls`
3. Inbox → `/mctb/conversations`
4. AI Recovery → `/mctb/ai-recovery`
5. Voicemail → `/mctb/voicemail`
6. Analytics → `/mctb/analytics`
7. Setup → `/mctb/setup`

Mobile bottom nav: Home, Missed, Inbox, Setup (unchanged compact pattern).

## 6. AI Recovery route compatibility

- Canonical: `MCTB_ROUTES.aiRecovery` = `/mctb/ai-recovery` (reuses `AiLeadRecoveryPage` — Pass 3 owns simplification).
- Legacy: `/mctb/ai-lead-recovery` → server redirect + `next.config` redirect.

## 7. `/mctb/voice-agent` disposition

**No redirect (STOP per spec §10).** Route still hosts the **After-Hours Voice Agent** wizard (`MctbVoiceAgentPage` / appointment receptionist wizard) — capability not duplicated on `/mctb/ai-recovery`. Removed from MCTB nav; direct URL/bookmarks still work. Customers with Voice entitlement should use **AI Receptionist** product shell.

## 8. Shared Inbox architecture preserved

- Still `KimiConversationsConnected` + `ConversationsThreadArea` + shared composer/fetch paths.
- No forked store, composer, or SMS pipeline.

## 9. MCTB thread identification

`productSource === "mctb"` via `isMctbInboxThread()` — not route string, phone shape, or missed-call presence alone.

## 10. Recovery context data source

`GET /api/mctb/handoff/context?conversationId=` → `mctbConversationAutomationState`, latest `mctbLeadSnapshot`, `loadMctbHandoffConfig` response mode.

## 11. Captured fields surfaced

Rendered only when present in snapshot/captured JSON: Name, What they need, Location (address or zip), Urgency, Callback preference. No Unknown/N/A rows.

## 12. AI summary behavior

Label **Summary**; text from `summaryText` or `aiDerived.aiSummary`. Structured fields take precedence over prose.

## 13. Operational state helper

`deriveMctbOperationalLabel()` in `src/lib/mctb/inbox/thread-presentation.ts`:

Precedence: **Needs reply** (unread) → **Needs callback** (`followUpStatus` / `callback_requested`) → **Called back** / **Booking link sent** / **Resolved** from follow-up or automation state.

(List row badges not wired in Pass 1 — list API does not load per-row automation; thread panel uses live handoff fetch.)

## 14. Automation state helper

`deriveMctbAutomationIndicator()` — **AI active** vs **Human active** from `mctbConversationAutomationState.state` (+ `notify_only` suppresses AI badge).

## 15. Human takeover flow

Panel **Take over conversation** → `POST /api/mctb/handoff/actions` `{ action: "take_over" }` → `takeOverMctbConversation()` → refetch context. No client-only state.

## 16. Resume flow

**Resume AI Recovery** when `state === human_active` → `resume_automation` action → `resumeMctbAutomation()`.

## 17. Manual-send behavior

**Gap (documented):** Staff manual send via shared composer was **not** traced to automatic `takeOverMctbConversation` in this pass. Only explicit handoff actions and runtime inbound paths update automation state. Owner should verify whether outbound staff send should imply takeover.

## 18. AI Assist interaction

For MCTB threads: hide `InboxAiBanner` and AI Assist session/takeover UI (`hideAutomationOwnership`). Suggested responses/knowledge rail may still appear when present — drafting-only, not autonomous MCTB ownership.

## 19. Callback state / actions

Uses `followUpStatus` + handoff actions: **Call customer** (`tel:`), **Mark called back**, **Resolve**. Operational labels derived from same fields.

## 20. Booking-link action

`MctbConversationBookingActions` shown when `productSource === "mctb"` (not only appointments-primary). SEND_BOOKING_LINK path via `/api/contacts/actions` — no FIND/BOOK/AI_BOOK UI.

## 21. Saved Replies integration

Existing `ConversationsComposer` + template picker (“Saved replies”) unchanged — shared `/conversations/saved-replies` management; no MCTB duplicate storage.

## 22. Consent / returning caller context

`MctbConversationContextBanner` still shown for MCTB threads with `missedCallEventId` (repeat caller). Full consent log not duplicated.

## 23. Loading / error / partial states

Recovery panel: inline skeleton, retry on load failure (thread remains usable), inline alert on action failure without optimistic ownership flip.

## 24. Responsive / a11y

Panel: `section` + `aria-label="AI recovery context"`; semantic buttons; compact above-message placement (no new right rail).

## 25. Tests run / results

```bash
npx tsx scripts/test-mctb-pass-1-shell-inbox.ts   # OK
npx tsx scripts/test-mctb-nav-ia.ts               # OK
```

`test-product-shell.ts` / `test-mctb-booking-simplification.ts` — pre-existing failures unrelated to Pass 1 nav (visible shells list, appointments page path).

## 26. Runtime files changed

None in TeXML, eligibility, SMS send, consent ledger, or lead-recovery conversation runtime. **API:** handoff context route — workspace conversation guard only.

## 27. Schema changes

**NONE**

## 28. Deferred items

- Pass 2: Missed Calls redesign
- Pass 3: AI Recovery configuration simplification / customer copy (“AI Lead Recovery” → “AI Recovery” on page H1)
- Inbox list operational/automation badges (needs list API enrichment)
- Needs callback filter (if query architecture insufficient)
- `/mctb/voice-agent` redirect decision after product owner review
- Manual-send → takeover verification

## 29. Owner certification remaining

- [ ] MCTB-only vs MCTB+Voice product switcher in browser
- [ ] Inbox MCTB thread: recovery panel, takeover, resume, callback actions
- [ ] Legacy `/mctb/ai-lead-recovery` bookmark
- [ ] Booking link send from MCTB inbox
- [ ] Confirm no duplicate AI Assist takeover on MCTB threads
- [ ] Voice six-page IA unchanged when Voice shell selected

---

**Protected runtime:** No certified TeXML / CFNA / Press-1 / eligibility / SMS pipeline changes.
