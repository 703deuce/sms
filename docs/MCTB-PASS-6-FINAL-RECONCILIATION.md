# MCTB Pass 6 — Final reconciliation

## 1. Executive verdict

**PASS — architecture freeze approved.** Canonical `/mctb/ai-recovery` renders Pass 3 simplified settings. Legacy routes redirect. MCTB nav matches seven launch destinations. No P0 architecture blockers found in static reconciliation.

## 2. Canonical route inventory

See `docs/MCTB-LAUNCH-ARCHITECTURE-FREEZE.md` §3. Full `/mctb/*` pages inventoried; scheduling URLs redirect to `/appointments/*`; voice-agent redirects to Voice.

## 3. Nav verification

`buildMctbV1Nav`: Overview → Missed Calls → Inbox → **AI Recovery** → Voicemail → Analytics → Setup. Voice bundle uses `/voice/agents` (not `/mctb/voice-agent`). Tests: `test-mctb-nav-ia.ts`, `test-mctb-pass-6-final-reconciliation.ts`.

## 4. AI Recovery production render

`/mctb/ai-recovery` → `AiRecoverySettingsPage` (Status, Business information, Information to collect, Booking link). Verified by static import check + Pass 3 test script.

## 5. Legacy AI page

`/mctb/ai-lead-recovery` → redirect to `/mctb/ai-recovery` (query preserved). `ai-lead-recovery-page.tsx` retained for compatibility; not linked from nav.

## 6. `/mctb/voice-agent`

**Decision:** REDIRECT → `/voice/agents`. Voice owns agent configuration. Removed from MCTB nav; bundled chrome still recognizes legacy URL for redirects.

## 7–8. Voicemail

Operational `/mctb/voicemail` uses `MctbVoicemailWorkspace` (list, playback, transcript, links to Setup). Configuration `/mctb/setup/voicemail`. Cross-links to Setup present; greeting drawer in inbox remains with Setup shortcuts (non-blocker).

## 9. Consent Log

`/mctb/compliance/consent` — contextual; access via Setup → Consent → View consent history.

## 10–12. Numbers & Setup redirects

Verified redirect pages for numbers, business-hours, follow-up, missed-call-rules.

## 13. Scheduling routes

`removed-scheduling-routes.ts` updated to `/appointments`, `/appointments/calendar`, `/appointments/types`, `/appointments/reminders`.

## 14–26. Ownership

Aligned with freeze doc matrix — no duplicate booking editor; Text Back / Consent / Recovery / AI Recovery / Inbox / Missed Calls / Analytics / Overview boundaries unchanged from Passes 3–5.

## 27–28. Contacts / Appointments

No `/mctb/contacts`. Legacy `/mctb/appointments*` redirect out of MCTB.

## 29–31. Searches

No-reply chase UI remains hidden via launch flags; dormant copy in `recovery-controls-view.tsx` (internal). TTP/AI_BOOK hidden in LR via flags. Customer-facing nav uses “AI Recovery” not “AI Lead Recovery”.

## 32. Terminology

Updated Setup recovery link, overview attention href, home/manage links. Internal `lib/` names unchanged.

## 33–34. Cross-links / breadcrumbs

Setup subpages use ← Setup pattern (Pass 4). AI Recovery links to business information editors via context API.

## 35. Feature-to-owner matrix

`docs/MCTB-LAUNCH-ARCHITECTURE-FREEZE.md` §4.

## 36–37. Customer actions / API alignment

Reconciliation only — no new anomalies requiring runtime changes in this pass.

## 38–41. Spot checks

Sender authority, platform AI, takeover — no regressions introduced; not re-opened.

## 42–44. Analytics / Overview / Setup

Pass 5 metrics and Pass 4 setup IA assumed accepted; static analytics checks in Pass 6 script.

## 45. Launch flags

Documented in freeze doc §18.

## 46. Dead presentation

`ai-lead-recovery-page.tsx` — **KEEP FOR COMPATIBILITY** (redirect only).

## 47. Files changed (primary)

- Nav, routes, redirects (ai-lead-recovery, voice-agent, analytics/mctb)
- Pass 3 AI Recovery tree merged to master branch work
- Pass 5 overview/analytics merged
- `removed-scheduling-routes.ts`, `mctb-bundled-receptionist-paths.ts`
- Tests + freeze docs

## 48–52. Tests

```
npx tsx scripts/test-mctb-pass-6-final-reconciliation.ts
npx tsx scripts/test-mctb-nav-ia.ts
npx tsx scripts/test-mctb-pass-3-ai-recovery.ts
npx tsx scripts/test-mctb-pass-5-overview-analytics.ts
```

All PASS.

## 53. Schema / runtime

None.

## 54. Remaining blockers

None for architecture freeze.

## 55. Owner certification checklist

- [ ] Browser walk all seven nav destinations
- [ ] `/mctb/ai-recovery` simplified page in staging/production build
- [ ] Legacy bookmarks redirect
- [ ] Voicemail cross-links on real data
- [ ] Live SMS/call certification

## 56. Architecture freeze recommendation

**MCTB PRODUCT ARCHITECTURE FROZEN — READY FOR VISUAL UI/UX POLISH**
