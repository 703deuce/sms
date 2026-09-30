# MCTB new-user onboarding — product model & what works today

**Audience:** Product, support, engineering (copy-friendly).

---

## Commercial model (authoritative intent)

| Concept | What it means |
|--------|----------------|
| **No “trial” product** | MCTB is **free to start**, not a time-boxed trial SKU. Code may still use legacy names like `activateMctbTrial` for the first-activation path. |
| **Free plan** | **Platform sender** model: Transovo’s pre-verified numbers send recovery SMS. Includes **10 missed-call recoveries per month** (logical recoveries, not raw SMS segments). |
| **Consent on free** | **Both** modes are available: **Press 1** and **existing permission** (business **attestation** required for existing permission — never pre-checked). |
| **Paid tiers** | **More** capacity and features (urgent alerts, booking links, higher monthly recovery limits, etc.). Paid tiers do **not** remove Press 1 or existing permission from free. |
| **Platform sender** | Customer does **not** complete A2P/TFV on their workspace. Transovo platform numbers are already verified. |
| **Own number (workspace sender)** | Customer buys/uses **their** number → **they** complete carrier messaging verification (A2P/TFV) before live SMS on that sender. |

---

## Where onboarding lives

With Stage 2 UI, `/onboarding/mctb` redirects to **`/mctb`**. First-time setup is the **modal wizard** (`MctbFirstRunWizardHost`).

**Steps:** Business → Consent → Text Back → Voicemail → Notifications → Connect phone → Test & go live.

---

## Happy path (free + platform sender)

1. Enter **business line** and business details.
2. Choose **Press 1** or **existing permission** (attest if existing).
3. Configure recovery text (platform sender uses approved templates where applicable).
4. Voicemail + notifications.
5. Set **no-answer forwarding** to the Transovo ingress shown in the wizard.
6. **Test & go live:** real call from another phone → missed call → consent path → recovery text → **reply to the text** (live test gate).

After go-live, change settings under **`/mctb/missed-call-recovery`**, **`/mctb/text-back`**, **`/mctb/phone`**, **`/mctb/notifications`** (and legacy `/mctb/setup/*` where linked).

---

## What still requires real-world steps

- **Forwarding** must be proven (not checkbox-only): evidence from a forwarded call (`forwardingConnectedAt`).
- **Live test** requires SMS **reply**, not just delivery.
- **Own-number sender:** workspace messaging compliance before sends on that number.
- **Platform sender:** no customer TFV/A2P; activation gates skip workspace verification when `senderMode === PLATFORM`.

---

## What paid unlocks (examples)

- Higher monthly recovery limits (starter/growth/pro tiers).
- Urgent classification / urgent email or SMS alerts.
- Booking / request links (Recovery-tier capabilities in code).
- **Existing consent certification** (paid attestation product) is separate from **selecting** existing-permission mode on free.

---

## Practical Q&A

| Question | Answer |
|----------|--------|
| Free user — Press 1? | Yes. |
| Free user — existing permission with attestation? | Yes (MCTB entitled). |
| Free user — how many recoveries? | **10 / month** on free (`MCTB_FREE_MONTHLY_RECOVERY_LIMIT`). |
| Platform sender — customer TFV? | **No.** |
| Own number — customer TFV/A2P? | **Yes**, before messaging on that number. |
| Click through wizard without real test? | Not production-live for recovery. |
| Change settings after setup? | Yes — same setup APIs; saves should persist (IA wiring). |

---

## Engineering references

| Topic | Location |
|-------|----------|
| Free monthly limit (10) | `src/lib/mctb/recovery-usage-constants.ts` |
| Existing consent eligibility | `src/lib/mctb/setup-consent-eligibility.ts` |
| Platform sender skips TFV activation gates | `src/lib/mctb/onboarding/trial-gates.ts` (`usesPlatformSender`) |
| Setup API consent | `src/app/api/mctb/setup/route.ts` |
| Onboarding API | `src/app/api/mctb/onboarding/route.ts` |
| Capabilities / limits | `src/lib/mctb/capabilities.ts`, `commercial-entitlements.ts` |

---

*Updated to match product intent: free plan, both consent modes, platform sender without customer verification, paid = more features.*
