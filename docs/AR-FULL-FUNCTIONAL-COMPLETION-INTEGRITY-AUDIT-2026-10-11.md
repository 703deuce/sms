# Appointment Reminders — Full Functional Completion Integrity Audit

**Date:** 2026-10-11  
**Branch:** `cursor/ar-full-functional-completion-f350` (PR #638)  
**Matrix:** `docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md`

## Purpose

Reconcile reported completion totals with row-level evidence. A requirement is **complete** only when the full customer behavior is implemented and backed by cited code paths; live provider behavior requires **production** verification, not mocked or unit tests alone.

## Count reconciliation

| Bucket | Count | Notes |
|--------|------:|-------|
| Workstream rows (`AR-WS*`) | 90 | Eight workstreams |
| In-table **excluded** | 4 | WS1-03, WS2-14, WS3-12, WS4-10 |
| AR-X policy table (not counted as WS rows) | 5 | Documented product exclusions |
| **Applicable** implementable rows | **86** | 90 − 4 |
| Implementation **complete** | **76** | Derived from matrix rows |
| Implementation **partial** | **10** | See unresolved list |
| Implementation **missing** | **0** | — |

The prior summary claimed 87 applicable / 87 complete with zero partial. That was wrong because:

1. **WS4-10** is excluded in-table (arrival windows) but was omitted from the excluded count (3 → **4**).
2. Several rows were marked **complete** while evidence still described gaps (cold signup UX, Graph mapping, per-calendar UI, prod runbook, etc.).
3. **Production verification** was conflated with automated tests.

**Completion pass status: NOT FINISHED** until all applicable rows are `complete` (or explicitly accepted as partial with product sign-off).

## Verification separation

| Layer | What it proves |
|-------|----------------|
| **Impl** | Code + UX implement the requirement behavior |
| **Auto** | Unit/API/static tests in `npm run test:appointment-reminders` |
| **Prod** | Live Telnyx, Stripe, Brevo, Luna, Microsoft Graph, or documented runbook execution |

Rows with **Prod: not_run** are not live-certified even when **Impl: complete**.

## Unresolved requirements (partial — 10)

| ID | Topic | Why partial | Next proof |
|----|-------|-------------|------------|
| AR-WS1-01 | Cold signup | Shared product signup; no AR-only onboarding E2E | Dedicated AR signup UX + browser cert |
| AR-WS2-15 | Graph extended properties | Env key list only | Tenant field mapping + import proof |
| AR-WS2-16 | Shared/delegated mailbox | UPN override in config | Graph permission probe + error UX |
| AR-WS2-17 | Per-calendar rules | Backend `importRulesByCalendarId` | Calendar-level rules UI + save |
| AR-WS3-06 | Outlook Contacts | Import enrich hook | Live Contacts.Read reconnect cert |
| AR-WS3-07 | Name personalization | Title-only events weak | Name extraction tests + live samples |
| AR-WS3-08 | Contact continuity | Email-only CRM link | Phone-keyed identity design |
| AR-WS5-05 | Real-appointment preview | Sample/fixture preview | Pick live appointment in configure UI |
| AR-WS8-05 | Prod runbook | Documented only | Execute `AR-LAUNCH-READINESS-NOW.md` cold tenant |
| AR-WS8-06 | Throughput 600 | Script exists | Run `test-ar-reminder-throughput.ts` and record |

## User-flagged rows — disposition

| ID | Prior issue | Disposition after audit |
|----|-------------|-------------------------|
| AR-WS1-13 | “Optional gate not enforced” | **Complete** — `setupConfigureCompletedAt` + `activation.ts` blocker |
| AR-WS3-10 | “Re-import same phone risk” | **Complete** — suppression enrich on import + eligibility; prod re-import E2E still not_run |
| AR-WS4-10 | Arrival windows | **Excluded** — v1 scope; generic range merge var only |
| AR-WS5-08 | “Needs notification channel design” | **Complete** — staff email/SMS via `ar-staff-delivery-alert.ts`; live alert not_run |
| AR-WS8-07 | “Process doc update pending” | **Complete** — `V1-PRODUCTION-CERTIFICATION.md` AR section updated |

## Automated tests (this branch)

Command:

```bash
npm run test:appointment-reminders
```

Includes matrix integrity script `scripts/test-ar-functional-completion-cert.ts` and row reconcile `--check`.

## Production verification

**Not executed in cloud agent environment** for cold-tenant runbook, live Telnyx SMS, Stripe checkout, Luna phone extraction, or Microsoft Graph delegated mailbox. Matrix **Prod** column marks these `not_run` unless a row is pure in-process logic (e.g. eligibility unit tests → **prod pass** for code-path truth only).

## Tooling added

- `scripts/apply-ar-matrix-integrity.mjs` — evidence column + overrides + summary refresh
- `scripts/ar-matrix-row-overrides.mjs` — row-level truth for flagged IDs
- `scripts/reconcile-ar-completion-matrix.mjs` — derive counts; `--check` stale evidence on complete rows

## PR status

PR #638 remains open. This audit **does not** close the functional completion pass.
