# MCTB final launch reconciliation — report

**Branch:** `cursor/mctb-first-text-templates-f350`  
**Certified SHA (this pass):** `da0712f1b9e10c1415afb89f52e0b2818d78a455`  
**PR:** https://github.com/703deuce/sms/pull/609

---

## Summary table

| Area | Result | Evidence | Changes required |
|------|--------|----------|------------------|
| AI Recovery removed from active deterministic UX | **Done** | Overview banner gated on `capabilities.aiRecoveryEntitled`; `buildMctbOverviewLeadRecoveryCard` only sets attention when `surfaceAttentionInOverview`; notifications **Urgent Reply Alerts** block omitted when `urgentDetectionAvailable` is false; `urgent_detected` row hidden from events | None for deterministic launch |
| Handled on missed calls list | **Done** | `followUpStatus` loaded in `missed-calls-list-data.ts`; Reply column shows **Needs follow-up** / **Handled**; overflow **Mark handled** → `POST /api/mctb/handoff/actions` | None |
| Handled in analytics | **Done** | `handledLeads` from `mctbConversationAutomationState` (`followUpStatus: resolved`, `followUpAt` in range); funnel stage **Handled** | None |
| Overview setup links (canonical IA) | **Done** | `MCTB_ROUTES.phone`, `missedCallRecovery`, `textBack`, consent tab on recovery hub | None |
| Consent history link | **Verified (code)** | Recovery → Consent → `MCTB_ROUTES.complianceConsent` in `mctb-ia-pages.tsx` | Browser re-check on deployed app |
| Notification recipient persistence | **Not re-tested (blocked)** | No `MCTB_PROD_CERT_*` / DB in cloud VM | Run `testNotificationsCrud` via `mctb-production-browser-cert-exercise-all.ts` on deployed candidate |
| Analytics React #418 | **Not re-tested (blocked)** | Same | Load `/mctb/analytics` on deployed candidate |
| `verify:mctb-final-pipeline` | **PASS (static)** | Static first-text checks pass without Supabase; live DB/Telnyx skipped when Supabase unset | Full live check needs Supabase + Telnyx on cert workspace |
| Commercial launch guards | **Partial** | New `test-mctb-deterministic-first-text-guard.ts` **PASS**; `message-template.test` **PASS**; **`verify:mctb-stage2-legacy-imports` FAIL** (pre-existing: `mctb-messaging-hours-panel.tsx` → legacy weekly schedule) | Fix legacy import or accept stage2 waiver for freeze |
| Simplified launch test | **PASS** | `scripts/test-mctb-simplified-launch.ts` | None |
| Consolidated non-human matrix | **55 PASS / 6 FAIL** | Fails: `31-guards` (stage2), `31-bullmq-worker` (Redis), `9-press1-db`, `23-platform-sender`, `28-number-scope` (DB), `34-stage2-presentation` — env/infra + stage2 drift, not this UX diff | Re-run matrix on CI/agent with `DATABASE_URL` + Redis; address stage2 import separately |
| Current browser certification | **Not run** | No production cert URL/credentials in cloud VM | `MCTB_PROD_CERT_BASE_URL` + email per `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` |
| Live PSTN certification | **Not run** | Per instruction: after repo/browser green | Real phone on deployed build with `MCTB_LEGACY_AI_SMS_REPLY=0` |

---

## Explicit checklist (items 1–12)

1. **AI Recovery references** — Removed from deterministic paths (overview + notifications); routes/code preserved; AI-entitled workspaces can still see urgent UI with optional criteria link.

2. **Handled list** — `followUpStatus` only; labels on list; **Mark handled** in row menu when `needs_follow_up`.

3. **Handled analytics** — `handledLeads` + funnel **Handled** stage.

4. **Notification persistence** — **Not validated in cloud VM**; re-test on deployment (no code change unless repro fails).

5. **Analytics hydration** — **Not validated in cloud VM**; no patch without reproduction.

6. **`verify:mctb-final-pipeline`** — **PASS** for deterministic template checks in VM (static); live ingress checks need Supabase.

7. **Commercial guards** — Template guards **PASS**; overall script still reports **stage2 legacy-import FAIL** (unchanged by this pass).

8. **Simplified launch** — **PASS**.

9. **Consolidated matrix** — **6 failures** (mostly missing DB/Redis + stage2); not full-matrix green in cloud VM.

10. **Browser cert** — **Not executed**.

11. **SHA** — `da0712f1b9e10c1415afb89f52e0b2818d78a455`.

12. **Ready for live PSTN?** — **Not yet.** Product inconsistencies from the audit are closed in code, but freeze criteria still need: production browser cert (notifications + analytics), matrix green on an environment with DB/Redis, and optionally resolving the **stage2 legacy-import** guard (or an explicit waiver). **Do not start PSTN until those are green.**

---

## What changed (commit `da0712f1`)

- **Overview:** No AI Recovery attention for non-entitled; canonical setup-health hrefs (`/mctb/phone`, `/mctb/missed-call-recovery`, `/mctb/text-back`, consent tab).
- **Missed calls + analytics:** Operational **Handled** lifecycle on list and analytics funnel.
- **Notifications:** No AI Recovery section/links for deterministic customers (`urgentDetectionAvailable` from handoff API).
- **Tests:** `scripts/lib/mctb-deterministic-first-text-verify.ts`, pipeline verifier static checks, `message-template.test` aligned with rendered first-text templates.

**Unchanged (as requested):** Conversations composer entitlement, voicemail entitlement, duplicate-call suppression, deterministic ack architecture, AI Recovery routes/backend.

---

## Consolidated matrix failures (reference)

When re-running `bash scripts/run-mctb-consolidated-nonhuman-matrix.sh`:

- `31-guards` — stage2 legacy imports
- `31-bullmq-worker` — Redis
- `9-press1-db` — DATABASE_URL
- `23-platform-sender` — DATABASE_URL
- `28-number-scope` — DATABASE_URL
- `34-stage2-presentation` — stage2 legacy imports

---

## Next steps (freeze → PSTN)

1. Deploy `da0712f1` (or merge PR #609 and deploy `master`).
2. Set `MCTB_LEGACY_AI_SMS_REPLY=0` on candidate; owner SMS entitlement for test workspace.
3. Run current browser certification (`docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` / `scripts/mctb-production-browser-cert-exercise-all.ts`).
4. Re-run consolidated matrix with `DATABASE_URL` + Redis.
5. Live PSTN certification (Tests 1–6 from launch reconciliation brief).

**Production-certified** only after live PSTN run succeeds — not declared by this reconciliation pass.
