# Missed Call Text Back — commercial packages (customer + engineering)

**Status:** Launch package structure (authoritative product intent).  
**Pricing in Stripe/catalog** should mirror these numbers; **limits and capability gates** in code should mirror the tables below.

---

## Package comparison

| | **Free** | **Text Back** | **AI Recovery** |
|---|:---:|:---:|:---:|
| **Price** | $0/mo | $9.99/mo | $19.99/mo |
| **Missed-call recoveries** | 10/mo | 50/mo | 100/mo |
| Automatic text back | ✓ | ✓ | ✓ |
| Transovo platform number | ✓ | ✓ | ✓ |
| Press-1 consent | ✓ | ✓ | ✓ |
| Existing-consent (attestation) | ✓ | ✓ | ✓ |
| Missed-call history | ✓ | ✓ | ✓ |
| Business notifications | ✓ | ✓ | ✓ |
| Booking link | — | ✓ | ✓ |
| AI responds to customer | — | — | ✓ |
| Custom AI intake | — | — | ✓ |
| Collect lead information | — | — | ✓ |
| Urgency detection | — | — | ✓ |
| Lead summary | — | — | ✓ |

---

## Free — $0/month

- **10** missed-call recoveries every calendar month (logical recoveries, not SMS segments).
- Full automatic text-back for those qualifying missed calls — **not** a crippled demo.
- **No credit card** required to start.
- **No customer A2P/TFV** when using the **Transovo platform sender** (pre-verified).
- **No** waiting on provisioning their own local/toll-free number for the default path.
- **Both** consent modes: Press-1 and existing permission (business attestation).

---

## Text Back — $9.99/month

- **50** missed-call recoveries/month.
- Natural upgrade when free usage exceeds 10 recoveries.
- Unlocks **booking links** in controlled MCTB flows.
- Does **not** include AI reply/intake, urgency AI, or lead-summary AI.

**Stripe / entitlement mapping (engineering):** `platform_product_subscriptions.product_family = mctb` (paid). Code flag: `recoveryPaid`.

---

## AI Recovery — $19.99/month

- **100** missed-call recoveries/month.
- Transovo **handles inbound SMS replies** after the initial MCTB (lead recovery / intake — **not** a full AI receptionist).
- Business configures **what to collect** (e.g. service → urgency → name → address for a plumber).
- Includes **booking links** and AI-side **urgency detection**, **lead summary**, and related AI recovery capabilities.

**Stripe / entitlement mapping:** `product_family = mctb_ai_recovery` (and MCTB base product active). Code flag: `aiRecoveryEntitled`.

**Scope guard:** Focused **lead recovery/intake** on recovered conversations — not a second generic voice/SMS receptionist product.

---

## Own Local Number — optional add-on (outside the three packages)

| | |
|---|---|
| **Recurring** | +$10/month |
| **One-time** | +$19.50 A2P registration |

- Customer’s **own registered local business texting number** (workspace sender), not the shared Transovo platform toll-free sender.
- Unlocks **human-controlled texting** appropriate to their registered A2P use case once carrier approval completes.
- Checkout copy should state that **carrier/message usage charges may apply** if billed pass-through.

**Stripe / entitlement mapping:** `product_family = mctb_own_sender`. Code flag: `ownSenderAddOnEntitled`. Customer completes **their** A2P — platform sender path does not.

---

## Voice (separate ladder)

**Voice** starts at **$29.99/month** — AI answers the phone first. Not an MCTB package tier.

Commercial ladder:

```
$0      → Try MCTB for real (10 recoveries)
$9.99   → Recover more missed calls (50) + booking links
$19.99  → AI handles the recovered conversation (100)
$29.99+ → AI answers the phone (Voice product)
```

Do **not** add another MCTB tier unless post-launch usage proves it necessary.

---

## Engineering constants (code)

| Constant | Value | Tier |
|----------|------:|------|
| `MCTB_FREE_MONTHLY_RECOVERY_LIMIT` | 10 | Free |
| `MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT` | 50 | Text Back (`recoveryPaid`) |
| `MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT` | 100 | AI Recovery (`aiRecoveryEntitled`) |

**Capability gates** (`resolveMctbCapabilities`):

| Capability | Free | Text Back | AI Recovery |
|------------|:----:|:---------:|:-----------:|
| `pressOneConsent` / existing consent (eligible) | mctb active | ✓ | ✓ |
| `bookingLinks` | — | `recoveryPaid` | `recoveryPaid` or `aiRecoveryEntitled` |
| `urgentClassification` / urgent notify | — | — | `aiRecoveryEntitled` |
| `aiRecoveryEntitled` features | — | — | `aiRecoveryEntitled` |
| `platformSenderActive` | default path | ✓ | ✓ |
| Own number + A2P | add-on only | add-on | add-on |

**Related docs:** `docs/MCTB-NEW-USER-ONBOARDING-REALITY-CHECK.md` (onboarding + platform sender).

**Legacy naming:** Code may still say “trial”, `starter`/`growth`/`pro` Stripe tiers, or `activateMctbTrial` — treat as **free activation** or **Text Back** mapping until catalog/UI copy is fully renamed.
