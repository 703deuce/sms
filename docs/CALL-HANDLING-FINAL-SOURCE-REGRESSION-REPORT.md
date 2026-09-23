# Call Handling PR #483 — Final source regression report

**Date:** 2026-09-23  
**Branch:** `cursor/call-handling-ownership-switch-2304`  
**SHA:** `3888d4f6732c8c9a1003c0ef67ec261dbc613d24`  
**Git status:** Clean (synced with `origin/cursor/call-handling-ownership-switch-2304`)  
**PR:** https://github.com/703deuce/sms/pull/483  

**Architecture:** Accepted — no further architecture changes in this PR.

---

## Changed files (vs `master`)

**Call Handling**

- `src/lib/call-handling/*` (orchestration, ingress resolution, publish gate, readiness, types)
- `src/app/api/call-handling/route.ts`
- `src/components/call-handling/call-handling-switcher.tsx`
- `src/components/layout/header.tsx`, `sidebar.tsx`
- `src/components/mctb/overview-view.tsx`
- `src/app/api/solutions/appointment-receptionist/route.ts`

**MCTB ingress (non-destructive route only)**

- `src/lib/mctb/texml-ingress/provision.ts` — `routePhoneToMctbCallHandlingIngress`

**Voice (publish gate + deterministic PSTN bind only)**

- `src/lib/voice/agent-service.ts`
- `src/lib/voice-v3/resolve-pstn-wizard-binding.ts`
- `src/lib/voice-v3/pstn-wizard-agent-selection.ts`

**Tests / docs**

- `scripts/test-call-handling-ownership.ts`
- `scripts/test-call-handling-pstn-wizard-binding.ts`
- `docs/CALL-HANDLING-*.md`, `docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md`, related audits

---

## Automated regression results

| Command | Result |
|---------|--------|
| `npx tsx scripts/test-call-handling-ownership.ts` | **PASS** |
| `npx tsx scripts/test-call-handling-pstn-wizard-binding.ts` | **PASS** |
| `npx tsx scripts/test-voice-v3-wizard-step7-v3-path.ts` | **PASS** |
| `npx tsx scripts/test-mctb-final-pipeline-contract.ts` | **PASS** |
| `npx tsx scripts/test-mctb-setup-consent.ts` | **PASS** |
| `npx tsx scripts/test-mctb-setup-phone-forwarding.ts` | **PASS** |
| `npx tsx scripts/test-mctb-setup-links.ts` | **PASS** |
| `npx tsx scripts/test-mctb-setup-notifications.ts` | **PASS** |
| `npx tsx scripts/test-mctb-setup-exclusions.ts` | **PASS** |
| `npx tsx scripts/test-mctb-setup-recovery.ts` | **PASS** |
| `npx tsx scripts/test-mctb-handoff.ts` | **PASS** |
| `npx tsx scripts/test-mctb-onboarding-wizard-flow.ts` | **PASS** |
| `npm run verify:mctb-final-pipeline` | **FAIL** (environment / stale Telnyx + DB — **not PR #483**) |

### `verify:mctb-final-pipeline` failure analysis

**Not caused by Call Handling PR.** Script targets live reference DID `+18663464256` and workspace DB/Telnyx state in **this** environment.

Failing checks (evidence from run):

| Check | Detail | Assessment |
|-------|--------|------------|
| `db_routing_mode_mctb_texml` | `missing` | Reference workspace not in certified routing mode in this DB |
| `ai_after_hours_disabled` | `true` (expected false) | Workspace flags not production-certified here |
| `mctb_voice_trigger_866` | phone id `cmsgtjms84g6l2h0o255w1e3v` | Reference id mismatch vs script expectations |
| `telnyx_on_mctb_texml_app` | connection `3049083284135872095 (AI Direct …)` | **Live Telnyx row points at AI app, not MCTB TeXML** — stale/wrong ingress for cert DID |
| `press1_texml_has_gather_and_consent_audio` | TeXML is test Say/Hangup, not MCTB gather | Consequence of wrong Telnyx routing / not on MCTB app |

**Action:** Re-run `verify:mctb-final-pipeline` on **production/staging** after Coolify deploy against the **certified** MCTB reference workspace. Do **not** change PR #483 source to satisfy this VM’s stale rows.

---

## Confirmations (unchanged by this report)

| Item | Status |
|------|--------|
| Canonical ingress logic (`resolveCanonicalVoiceIngressPhoneNumberId`, CFNA target) | **Intact** |
| Deterministic explicit receptionist bind (`parkedAiReceptionistAgentId` + validation on PSTN) | **Intact** |
| Legacy V3 fallback (`legacy_recency` when no explicit Call Handling AI) | **Intact** |
| MCTB TeXML / eligibility / SMS dispatch runtime | **Unchanged** (orchestration + non-destructive ingress route only) |
| Voice V3 downstream (SIP forward, Live accept, sessions, tools, booking) | **Unchanged** (binding resolver only) |
| SMS sender / outbound route | **Untouched** by Call Handling |
| Explicit PLATFORM vs CUSTOMER SMS sender mode | **Separate launch item** — `docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md` |

---

## Verdict

All **source** regressions tied to PR #483 **PASS**.

`verify:mctb-final-pipeline` **FAIL** is **environmental** (Telnyx connection + reference workspace state), not a regression from this branch.

# SOURCE READY FOR MERGE AND LIVE PSTN CERTIFICATION

---

## Deployment process (correct order)

1. Merge PR #483 to `master` (normal GitHub workflow).
2. **Coolify** automatic rebuild/deploy — wait until build succeeds and new SHA is live.
3. **Do not** certify PSTN behavior until deployed code is receiving Telnyx webhooks on the target environment.
4. If Coolify build fails: fix smallest build-only issue, push, redeploy — still no architecture changes.

**Do not** require live PSTN certification before production/staging contains this SHA (impossible without deployed webhook endpoint).

---

## Live PSTN certification (after successful deploy)

Use **same business number** and **same canonical ingress DID** throughout.

| Test | Purpose |
|------|---------|
| **A** | AI active — business → ingress A → V3 → explicit receptionist |
| **B** | AI → MCTB — same CFNA, MCTB TeXML + recovery (sender per existing config) |
| **C** | MCTB → AI — same ingress, same receptionist, DID B association preserved |
| **D** | AI → MCTB → AI → MCTB → AI — no degradation |
| **E** | **Two receptionists** — #123 explicit, #456 newer → **#123**; log `bindSource: explicit_call_handling` |
| **F** | Publish AI while MCTB owns ingress — `connection_id` stays MCTB |
| **G** | MCTB paused — still MCTB owner, no V3, no recovery SMS |
| **H** | Ingress A vs agent DID B — no reassignment required |

**SMS:** Only confirm Call Handling did not mutate sender selection; PLATFORM/CUSTOMER mode remains separate work.

**Stop on failure:** Capture call control id, To/From, ingress phone id, Telnyx connection id, handlers, parked/bound agent ids, logs — report before architecture changes.
