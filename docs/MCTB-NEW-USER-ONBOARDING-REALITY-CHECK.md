# MCTB new-user onboarding — what works today (reality check)

**Context:** New user starting from onboarding, billing/checkout ignored. Question: Can they enter a phone number, get provisioned, turn on Missed Call Text Back, change settings afterward, and have it work on current `master`?

**Short answer:** You can walk through onboarding and configure most of MCTB, but **“finish onboarding” is not the same as “MCTB is live.”** For a real new workspace, the product expects **Press-1**, **async number provisioning**, **carrier messaging approval (TFV/A2P)**, **real no-answer forwarding**, and a **live phone test that includes replying to the recovery SMS** before trial activation and reliable production behavior. Post-wizard settings are largely wired to the same APIs recent UI passes fixed—but some options stay gated by plan/compliance.

---

## Where onboarding lives now

With Stage 2 UI on, `/onboarding/mctb` redirects to **`/mctb`**. First-time setup is the **modal wizard** (`MctbFirstRunWizardHost`), not a separate long-lived onboarding URL.

The flow is seven steps:

**Business → Consent → Text Back → Voicemail → Notifications → Connect phone → Test & go live**

Source: `src/lib/mctb/onboarding/wizard-flow.ts` (`MCTB_WIZARD_PRIMARY_STEPS`).

---

## What works if you actually do the steps

| Step | What the app does |
|------|-------------------|
| **Business line** | Saves your public number; kicks off **`provisionTrialMctbNumber`** (Telnyx local by default, Twilio toll-free fallback). |
| **Consent** | **Press 1** is the default path for new/trial users. **Existing permission** is disabled unless **`recoveryPaid`** (paid Recovery)—not “billing checkout” only, but a commercial entitlement flag). |
| **Text back / recovery / voicemail / notifications** | Persists through onboarding APIs and the same setup/recovery hooks used on `/mctb/missed-call-recovery` and related pages. |
| **Connect phone** | Carrier instructions + “I’ve set up no-answer forwarding.” That **does not** by itself prove forwarding; it advances you and starts listening for a test. |
| **Test & go live** | **Real call** to your business line → unanswered → Transovo ingress → missed call → consent (Press 1 if that mode) → **recovery SMS** → **you must reply** to that SMS. Only then does the backend mark the live test passed and call **`activateMctbTrial`**. |

So: **yes**, a new user can enter a number, get a forward target provisioned, configure the product, and—with a second phone and carrier forwarding actually working—complete go-live and land on Missed Calls.

---

## What does *not* work if you only click through

1. **Checkbox forwarding ≠ verified forwarding**  
   Trial activation requires **`forwardingConnectedAt`** (evidence from a forwarded call), not just acknowledging the instructions.

2. **Live test is strict**  
   Pass needs forwarding verified, missed call, consent satisfied, text sent, **and inbound reply** (`src/lib/mctb/onboarding/live-test.ts`). Skipping the reply leaves you on “Start test,” not truly live.

3. **Messaging compliance is a hard gate for trial activation**  
   `activateMctbTrial` requires trial number assigned, TFV/A2P rules satisfied, forwarding connected, and live test passed (`src/lib/mctb/onboarding/trial-gates.ts`). TFV can lag provisioning; the UI can show progress while activation still returns missing gates.

4. **While `billingPlan` is still `onboarding`, automatic recovery sends are off**  
   `getMctbEntitlement()` sets `canSendAutomaticRecovery = false` with reason `onboarding` unless an admin override flag is set. Trial activation moves the plan to **`trial`** and is when onboarding is meant to flip to “service can send” (subject to `config.enabled`, limits, compliance).

5. **Edge case:** Live test can mark **`currentStep: ready`** (onboarding “complete” in UI) even if **`activateMctbTrial`** fails (e.g. TFV not approved yet). You might see “Go to Missed Calls” while sends are still blocked until activation succeeds.

6. **Existing-consent mode**  
   Not available on a bare new trial without Recovery paid + messaging readiness—by design in API and wizard.

---

## After onboarding: changing settings

Post-wizard, configuration lives mainly under launch IA:

- **`/mctb/missed-call-recovery`** (tabs: general, consent, voicemail, etc.)
- **`/mctb/text-back`**, **`/mctb/phone`**, **`/mctb/notifications`**
- Legacy **`/mctb/setup/*`** routes still exist and redirect or mirror much of this

Recent wiring work targeted **save → API → DB → reload** for those surfaces. For **Press-1** and core recovery controls, you should be able to change settings after setup and see them stick—**provided** messaging is approved and the service isn’t paused/onboarding-blocked.

Still locked or partial without paid/add-on entitlements:

- **Existing permission** consent mode  
- Some **urgent / AI-style notification** rows in onboarding (shown as Recovery-locked)  
- **Booking links** and similar Recovery-tier capabilities where `recoveryPaid` gates the UI/API  

---

## Practical verdict (ignoring Stripe checkout UI)

| Question | Answer |
|----------|--------|
| Can a new user start from onboarding and configure phone, messages, consent, voicemail, notifications? | **Yes** (Press-1 path). |
| Will a number get provisioned automatically? | **Yes**, after business step (async; can fail if inventory/provider env is wrong). |
| Is MCTB “on” when they click Finish without a real test? | **No**—not for production recovery. |
| Can they turn on MCTB for real missed calls? | **Yes**, after forwarding proof + live test (including SMS reply) + trial activation gates (including TFV/A2P). |
| Can they change settings afterward and have it work? | **Mostly yes** for core MCTB settings on current `master`; compliance/plan gates still apply. |

---

## Bottom line

The repo supports a credible **new-user journey** from onboarding through go-live and into day-2 settings, but only if you treat **Test & go live** as a real PSTN/SMS certification step—not a wizard checkbox.

---

## Key code references (for engineers)

| Topic | Location |
|-------|----------|
| Wizard steps | `src/lib/mctb/onboarding/wizard-flow.ts` |
| Trial activation gates | `src/lib/mctb/onboarding/trial-gates.ts`, `trial.ts` |
| Live test + reply requirement | `src/lib/mctb/onboarding/live-test.ts` |
| Onboarding API | `src/app/api/mctb/onboarding/route.ts` |
| Trial number provision | `src/lib/mctb/onboarding/trial-number.ts` |
| Send entitlement during onboarding | `src/lib/mctb/entitlement.ts` |
| Existing consent gate | `src/app/api/mctb/setup/route.ts`, `capabilities.recoveryPaid` |
| First-run modal | `src/components/mctb/onboarding/mctb-first-run-wizard-host.tsx` |
| Canonical routes | `src/lib/mctb/routes.ts` |

---

*Generated for product/copy use. Based on codebase trace on `master` (post MCTB UI wiring merge).*
