# MCTB Pass 2 — Missed Calls & Missed Call Detail

## 1. Executive summary

Pass 2 delivers operational **Missed Calls** list and **Missed Call Detail** surfaces on canonical routes `/mctb/missed-calls` and `/mctb/missed-calls/[id]`, grounded in existing `MissedCallEvent` runtime data. Recovery status, suppression explanations, consent evidence, conversation/automation context, voicemail, lifecycle milestones, and booking-link gating are presented without rewriting telephony, eligibility, or sender-authority systems from Pass 1/1B/1C.

**Finish line:** MCTB PASS 2 IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED

## 2. Page contracts

### Missed Calls list

| Field | Value |
|-------|--------|
| Archetype | Operational list |
| Primary job | See who called, recovery outcome, conversation state, next action |
| Header | Missed Calls + optional summary strip |
| Controls | Search, recovery status filter, date range, more filters (trigger/sort) |
| Columns | Caller · Missed (workspace TZ) · Recovery · Conversation · Next action |
| Status hierarchy | Recovery SMS canonical labels; suppression secondary line via centralized mapper |
| States | Loading skeleton, true empty, filtered empty, error+retry, partial enrichment tolerant |
| Mobile | Compact records with same fields |

### Missed Call Detail

| Field | Value |
|-------|--------|
| Archetype | Object detail / operational evidence |
| Primary job | Exact story of one missed call and why |
| Section order | Back · Header · Lifecycle · Why not texted (if applicable) · Captured info · Call details · Consent & messaging · Text-back · Voicemail · Callback actions · Conversation · Diagnostics |
| Primary action | Open conversation / Call customer / Review voicemail (state-driven) |
| Lifecycle | API-built milestones from traces + event facts only |
| Evidence | Consent history link, sender label, suppression mapper |
| Timeline | Authoritative trace in collapsed diagnostics |
| States | Skeleton, not found, error with back link |

## 3. Files changed

See git diff on `cursor/mctb-pass-2-missed-calls-2304`.

## 4. Data sources

- `MissedCallEvent` (status, suppressionReason, timestamps, disposition)
- `MctbConversationAutomationState` (automation, follow-up, captured fields)
- `MctbLeadSnapshot` (summary + customer facts)
- `buildMctbEventTimeline` / `missedCallTextTrace`
- Consent: `loadConsentForMissedCallEvent`
- Voicemail: `voicemailMessage` time-window match
- Conversation: MCTB `conversation` + last message
- Config: timezone, sender mode (`loadMissedCallTextConfig`)

## 5. List query behavior

Existing `loadMctbMissedCallsListData` + filters; enriched with automation state per conversation and workspace `timezone`.

## 6. Filters

Unchanged server filters (replied, suppressed, failed, waiting consent, needs attention, date, trigger, search).

## 7. Recovery status derivation

`formatRecoveryStatus` on `MissedCallEvent.status` + `suppressionReason` (Suppressed ≠ Failed).

## 8. Conversation state derivation

`deriveMissedCallConversationPresentation` using reply status + automation state + follow-up.

## 9. Next-action derivation

`deriveMissedCallNextAction` — open conversation, call, review voicemail, callback, quiet resolved.

## 10. Detail header

Caller identity, business line, workspace-local missed time, single recovery status badge.

## 11. Recovery lifecycle

`buildMissedCallLifecycleMilestones` from event + consent + timeline + automation.

## 12. Captured information

Merged `capturedFieldsJson` + lead snapshot facts; optional AI summary labeled separately.

## 13. Consent evidence

Press-1 vs existing permission; link to `/mctb/compliance/consent`; separate from recovery status.

## 14. Why-not-texted mapping

`presentRecoverySuppression` in `recovery-suppression-presentation.ts` — centralized customer copy.

## 15. Voicemail integration

Detail section with link to `/mctb/voicemail`; list uses disposition `voicemail` for next-action hint.

## 16. Conversation integration

Links to canonical MCTB conversations route; no duplicate composer.

## 17. Callback integration

`POST /api/mctb/handoff/actions` follow_up (called_back / resolved) when automation indicates callback need.

## 18. Booking-link gating

`resolveMissedCallBookingActionEligibility` — paid + entitlement + URL; secondary action on detail only.

## 19. Timeline sources

`buildMctbEventTimeline` — full trace in diagnostics `<details>`.

## 20. Diagnostics

Collapsed technical IDs, suppression code, sender label, trace steps.

## 21. Loading/empty/error/partial

List skeleton rows; filtered vs first-use empty copy; detail skeleton; API partial failures do not block core event.

## 22. Responsive behavior

Existing mobile list pattern updated for new columns.

## 23. Accessibility

Semantic table headers, keyboard row navigation, status text not color-only.

## 24. Tests/results

`npx tsx scripts/test-mctb-pass-2-missed-calls.ts`

## 25. Runtime files changed

List/detail loaders and API `[id]` enrichment only — no TeXML/SMS pipeline edits.

## 26. Schema changes

None.

## 27. Deferred work

Owner UI visual polish pass; optional owner-selectable platform responses; deeper voicemail ID on list rows without N+1 lookup.

## 28. Owner certification

Verify list filters, detail why-not-texted copy, Press-1 vs recovery labels, booking gating on free vs paid, callback actions, back-navigation list context.
