# MCTB Pass 4 — Setup, Consent & configuration consolidation

## 1. Executive verdict

**PASS — implementation complete.** Setup is organized into one canonical IA with a compact home, nine configuration sections, legacy redirects preserved, sender/consent boundaries enforced, and AI Recovery separated from operational recovery controls. No schema, TeXML, eligibility, or platform-response changes.

## 2. Setup inventory (before)

| Area | Prior route | Issue |
|------|-------------|--------|
| Overview | `/mctb/setup` | Flow strip + activity panels heavy |
| Phone | `/mctb/setup/phone` | OK |
| Consent | `/mctb/setup/consent` | OK |
| Text Back | `/mctb/setup/text-back` | Nav grouped under Recovery |
| Recovery | `/mctb/setup/recovery` | AI Lead Recovery duplicate CTA; follow-up remnants |
| Missed-call rules | redirect → recovery | OK |
| Business hours / follow-up | redirects | OK |
| Numbers | `/mctb/numbers` | redirect → phone |
| Links | `/mctb/setup/links` | Overlapped booking mental model |
| AI Recovery | `/mctb/ai-lead-recovery` | Split from Setup (correct) |

## 3. Final Setup IA

`/mctb/setup` → Phone & Forwarding → Consent → Text Back → Recovery → Voicemail → Notifications → Exclusions → Links → Test

Horizontal nav: `MCTB_SETUP_SECTIONS` (10 entries including Overview).

## 4. Setup root page contract

Configuration index; calm when healthy; section rows with status + Configure link; compact mode hides flow strip, activity, and quick-action panels (`MCTB_LAUNCH_COMPACT_SETUP_HOME`).

## 5. Subpage contracts

Each editor: ← Setup breadcrumb (`MctbSetupSectionLayout`), title, purpose copy, save pattern unchanged.

## 6. Phone & Forwarding

Unchanged runtime; customer copy already explains forward unanswered calls. `/mctb/numbers` → `/mctb/setup/phone?open=manage`.

## 7. Sender presentation

`describeMctbSenderPresentation()` — Transovo-managed vs connected messaging. Exposed on `GET /api/mctb/setup` as `data.messaging`.

## 8. Consent

Plain-language labels; Press-1 vs Use existing permission. **Paid + messaging** required for existing permission (`isExistingConsentModeEligible` + API/onboarding enforcement).

## 9. Consent Log relationship

Link label: **View consent history** → `/mctb/compliance/consent`.

## 10. Text Back

Platform sender: read-only opener preview (`canEditRecoveryOpener: false`); POST strips `messageTemplate` when `senderMode === PLATFORM`.

## 11. Sender-authority behavior

UI does not expose PLATFORM/WORKSPACE enums. Workspace A2P may still customize opener when `canEditRecoveryOpener` is true.

## 12. Recovery

Pause, triggers, cooldown, duplicate protection. AI Recovery link to `/mctb/ai-recovery` (not duplicated config). No-reply follow-up UI removed from launch surface.

## 13. No-reply removal/hiding

Follow-up behavior / max-attempt launch controls removed from Recovery guardrails UI. Dormant solution config fields untouched.

## 14. Business-hours ownership

`/mctb/setup/business-hours` → `/mctb/setup/recovery`. No standalone business-hours product page.

## 15. Voicemail

`/mctb/setup/voicemail` unchanged; operational inbox remains `/mctb/voicemail`.

## 16. Notifications

Existing handoff/email surfaces; launch flag still limits to supported channels.

## 17. Exclusions

Unchanged; eligibility runtime preserved.

## 18. Links decision

**Remain** — owns `{{link}}` variable + request form. Booking link for AI is **AI Recovery** only (banner on Links page).

## 19. Test

`/mctb/setup/test` unchanged.

## 20. AI Recovery boundary

Recovery page links out; no collection fields or booking config duplicated in Setup.

## 21. Onboarding reconciliation

`POST /api/mctb/onboarding` existing_consent now uses same paid + messaging eligibility as Setup POST.

## 22. Entitlement behavior

Free: Press-1; existing permission hidden and API-blocked. Paid: existing permission when messaging ready.

## 23. Duplicate editors removed/consolidated

- Text Back own nav section (not under Recovery nav highlight)
- AI Recovery CTA unified on Recovery page
- Booking link configuration not on Recovery (AI_BOOK section already hidden)

## 24. Legacy routes

| Legacy | Target |
|--------|--------|
| `/mctb/numbers` | `/mctb/setup/phone?open=manage` |
| `/mctb/setup/business-hours` | `/mctb/setup/recovery` |
| `/mctb/setup/follow-up` | `/mctb/setup/recovery` |
| `/mctb/setup/missed-call-rules` | `/mctb/setup/recovery` |
| `/mctb/ai-lead-recovery` | `/mctb/ai-recovery` |

## 25. Files changed (primary)

- `src/lib/mctb/setup-sections.ts`, `setup-section-order.ts`, `setup-overview-model.ts`, `sender-presentation.ts`, `setup-consent-eligibility.ts`, `launch-flags.ts`, `routes.ts`
- `src/app/api/mctb/setup/route.ts`, `src/app/api/mctb/onboarding/route.ts`
- `src/components/mctb/setup/setup-overview-view.tsx`, `setup-recovery-view.tsx`, `setup-text-back-view.tsx`, `setup-consent-view.tsx`, `setup-links-view.tsx`, `mctb-recovery-goal-setup-section.tsx`, `mctb-setup-section-layout.tsx`
- `src/app/(app)/mctb/ai-recovery/page.tsx`, `ai-lead-recovery/page.tsx` (redirect)
- `scripts/test-mctb-setup-sections.ts`, `test-mctb-setup-consent.ts`, `test-mctb-pass-4-setup-consolidation.ts`

## 26. Runtime files changed

Minimal: setup POST ignores platform template edits; consent eligibility checks paid on API/onboarding. No telephony/SMS pipeline changes.

## 27. Schema changes

**NONE**

## 28. Tests / results

- `npx tsx scripts/test-mctb-setup-sections.ts` — OK
- `npx tsx scripts/test-mctb-setup-consent.ts` — OK
- `npx tsx scripts/test-mctb-pass-4-setup-consolidation.ts` — OK

## 29. Deferred

- Full visual polish (Mode 4)
- Merge Pass 3 simplified AI Recovery page over legacy component at `/mctb/ai-recovery`
- `/mctb/voice-agent` — Pass 6

## 30. Owner certification checklist

- [ ] Setup nav order matches spec
- [ ] Free cannot enable existing permission (UI + API)
- [ ] Platform Text Back preview read-only
- [ ] Recovery has no no-reply chase controls
- [ ] AI Recovery link works; no duplicate booking in Setup
- [ ] Legacy URLs redirect
- [ ] Onboarding consent matches Setup authorization
