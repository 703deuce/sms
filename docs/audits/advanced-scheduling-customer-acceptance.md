# Advanced Scheduling — Customer & Business Acceptance Journeys

**Companion to:** `docs/audits/advanced-scheduling-implementation-spec.md`  
**Milestone 1:** Complete package purchase → book → account visibility (both sides).

These journeys are **user-acceptance** criteria — reload verification required, not API-only checks.

---

## ADV-CUST-IT-STARTER — IT Career Starter Package (customer)

**Persona:** New customer on mobile (390px) and desktop.

| Step | Customer sees / does | Pass when |
|------|----------------------|-----------|
| 1 | Store lists package with plain-language inclusions (each course + tutoring count) | Matches published `creditRules` |
| 2 | One Stripe checkout; success page | Single charge; server fulfillment idempotent |
| 3 | Book page recognizes phone/email — eligible offerings listed | No redemption codes |
| 4 | Books each included course on available dates | Package credit debits per `series:{id}` |
| 5 | Books tutoring sessions until session bucket empty | `type:{id}` or pooled bucket |
| 6 | Account / portal shows remaining entitlements + upcoming classes | Itemized breakdown, not one opaque number |
| 7 | Returns next week; continues unused benefits | Balances persist; no duplicate purchase required |

**Mobile:** Repeat steps 1–4 on 390px viewport (`ADV-MOB-PKG-001`).

---

## ADV-BIZ-PKG-001 — Business publishes package

| Step | Business user | Pass when |
|------|---------------|-----------|
| 1 | Chooses “Bundle classes & workshops” template | `packageKind: itemized` without seeing “pooled credits” jargon |
| 2 | Names package, selects offerings, sets per-line quantities | Wizard ≤ 4 steps; saves |
| 3 | Store URL live; package active | Customer journey above can start |
| 4 | Customer record shows purchase, payment, enrollments, remaining credits | One connected admin view |

---

## ADV-PAY-SEAT-001 — Last seat during checkout (Phase 1c)

| Step | System | Pass when |
|------|--------|-----------|
| 1 | Customer A holds seat reservation during Stripe Checkout | Reservation TTL documented |
| 2 | Customer B takes last seat before A pays | A fulfillment fails closed OR auto-refund |
| 3 | Payment verified server-side (Stripe session + internal row) | Browser-only reference rejected |

---

## Regression before switching redemption keys

Run `npx tsx scripts/cert-package-credit-keys-compat.ts` in CI or pre-deploy.  
With DB: extend `scripts/cert-service-booking-entitlements.ts` for legacy balance fixtures.
