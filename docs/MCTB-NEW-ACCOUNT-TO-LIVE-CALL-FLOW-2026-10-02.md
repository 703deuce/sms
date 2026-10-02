# MCTB — New account to live call (what actually happens)

**Date:** 2026-10-02  
**Audience:** Product / ops / anyone asking “if I sign up right now, does it just work?”  
**Basis:** Current code paths (`signup`, onboarding, trial gates, frozen TeXML pipeline, setup APIs)—not marketing copy.

---

## Short answer

**Mostly yes on the backend path**, with important **you-still-have-to-do** steps (especially **carrier call forwarding** and **live test**). **Settings you save after setup are meant to hit the same runtime** the live call path uses—but a few UI surfaces are duplicates of the same fields, and one area (notifications) has had **browser cert** issues on some deploys even when the API saves correctly.

---

## 1. New account → wizard

**Depends how you sign up:**

- **Missed Call Text Back / voice signup** (`productIntent === "voice"` on business signup): workspace gets initial onboarding state (default **Press 1**), **`ensureMctbWorkspaceBootstrap`** runs (seed + toll-free **ingress** provisioning attempt), and you’re in the MCTB product story.
- **Generic signup** (SMS-only, etc.): you may **not** get that MCTB bootstrap until you open MCTB / grant feature.

After login, with **Stage 2 UI** (default unless env turns it off):

- You land on **`/mctb`**, not the old full-page `/onboarding/mctb` (middleware redirects legacy onboarding to `/mctb`).
- **`MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE`** is **on**: a **modal wizard** opens on MCTB pages until onboarding is **complete** (`trialActivatedAt` is set). You can use dedicated setup URLs without the modal blocking you.

So: **new MCTB-oriented account → `/mctb` + wizard**, not “random dashboard with no wizard.”

---

## 2. What the wizard actually provisions (automatic vs you)

**Automatic (server), when Telnyx/DB/env are healthy:**

- Workspace **seed** + **`ensureMctbWorkspaceIngressReady`** (hidden **toll-free** number for **CFNA** into frozen TeXML `mctb-entry`).
- **Platform sender** default is applied on setup/onboarding loads (typical **Free** path—no customer-owned TFV for outbound recovery SMS).
- **Consent mode** (Press 1 vs existing permission), templates, triggers, pause rules, etc. are **saved to DB** as you step through.

**You must still do:**

| Step | Why |
|------|-----|
| **Your public business number** | System needs to know what customers call. |
| **Choose Press 1 or existing consent** | Existing consent needs **attestation** (not pre-checked). |
| **Carrier conditional forwarding (CFNA)** | Transovo **does not** flip forwarding at your carrier. You forward **your business line** to the **ingress** number we show you. |
| **Live test** | “I’ve turned it on” ≠ verified. Activation gates require **forwarding evidence** + **live test passed** (`trial-gates.ts`: `forwarding_connected`, `live_test_passed`). |

Until CFNA works, **calls never hit** `/api/telnyx/voice/mctb-entry`, so nothing “just works” on the phone side.

**Trial “go live”** (`activate_trial` / `trialActivatedAt`) is blocked until those gates pass (platform sender skips **your** TFV, but **not** forwarding + live test).

---

## 3. After forwarding: missed call → text

Once a call **reaches ingress** on a workspace with **active MCTB** and completed activation:

- **`press_1`:** consent audio → press 1 → compliance SMS + recovery opener (frozen pipeline).
- **`existing_consent`:** voicemail greeting → hangup → auto SMS on status (no press 1).

That’s what **`docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`** certifies in CI (`verify:mctb-final-pipeline`, contract tests). **Real handset** proof is still separate from “code says yes.”

Other gates still apply: **opt-out**, **pause recovery**, **cooldown**, **free monthly recovery cap**, etc.

---

## 4. After setup: do settings “just work” when you save?

**Backend intent: yes** — one config domain, same APIs the runtime reads:

| Area | Save path | Runtime |
|------|-----------|---------|
| Pause, triggers, delay, template, consent mode | `POST /api/mctb/setup` | Eligibility + send pipeline |
| Exclusions | `/api/mctb/exclusions` | Suppression |
| Notifications / handoff | `/api/mctb/handoff` | Reply alerts, AI replies toggle |
| Booking links | `/api/mctb/booking-links` | Template / links |
| Consent prompt audio | `/api/mctb/consent-prompt` | Voice ingress |
| Recovery / cooldown / max messages | setup + recovery surfaces | Same `MissedCallTextConfig` (see `setup-field-authority.ts`) |

Automated **persistence scripts** in commercial guards pass for those sections.

**Caveats to expect in the real UI:**

- **Launch IA** spreads setup across **Missed-Call Recovery**, **Text Back**, **Phone**, **Notifications**, etc., not only `/mctb/setup/*`—but they’re wired to the **same** backend fields where documented.
- **Template / consent mode changes** apply to **future** sends; they don’t rewrite history.
- **Pause MCTB** stops automated recovery texts; it does **not** turn off carrier forwarding.
- **Notifications**: API/tests pass; **production browser cert** has sometimes failed on **recipient row after refresh** on older deploys—worth re-checking on **your** current SHA after save + hard refresh.

---

## 5. One-sentence version

**Sign up for MCTB → `/mctb` + wizard → we provision ingress + platform texting and save your choices → you configure carrier forwarding and pass live test → then missed calls on that path should text back per Press 1 or existing consent → later saves on setup/notifications/recovery/etc. should persist and affect live behavior, with forwarding and monthly/eligibility limits as the main “it didn’t text” reasons.**

---

## Key code / doc references

| Topic | Location |
|--------|----------|
| Signup + MCTB bootstrap | `src/app/api/auth/signup/route.ts`, `src/lib/mctb/provisioning/workspace-bootstrap.ts` |
| Post-login MCTB redirect | `src/middleware.ts` (`product=mctb` → `/mctb`) |
| First-run wizard modal | `src/components/mctb/onboarding/mctb-first-run-wizard-host.tsx`, `src/lib/mctb/onboarding/first-run-policy.ts` |
| Onboarding complete | `src/lib/mctb/onboarding/completion.ts` (`trialActivatedAt`) |
| Trial activation gates | `src/lib/mctb/onboarding/trial-gates.ts` |
| Frozen voice + SMS pipeline | `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md` |
| Duplicate setup surfaces → same fields | `src/lib/mctb/setup-field-authority.ts` |
| Ingress provision contracts | `scripts/test-mctb-trial-ingress-provision-contract.ts` |
| Live test / forwarding evidence | `scripts/test-mctb-live-test-forwarding-evidence.ts` |

---

## Signup path note

If signup is **not** voice/MCTB intent (`productIntent !== "voice"`), bootstrap and wizard state may differ until the user enters MCTB and entitlements are granted. For a step-by-step map of a **specific** marketing URL (`?product=mctb` vs generic signup), trace `productIntent` and `grantWorkspaceProductFeature` for that entry point.
