# Advanced Scheduling — Coordinated Implementation Specification

**Status:** Approved direction for implementation (post-audit). **Do not treat as shipped.**  
**Prerequisite audit:** `docs/audits/advanced-scheduling-workflow-audit.md`  
**Date:** 2026-10-13  
**Principle:** Extend existing engines (`service-booking`, store checkout, package ledger, membership webhooks, `ClassSeries` enrollment). **No parallel payment or package systems.**

---

## 1. Product decisions (locked for this program)

| Decision | Choice |
|----------|--------|
| Package types | **Both** pooled credits and **itemized** bundles (distinct entitlements per offering/quantity) |
| Paid class registration | **Three modes per series:** free · pay at registration · redeem package/membership only |
| Multi-session course | **One purchase → one enrollment action → all scheduled sessions** (`enrollFullSeries`) |
| Memberships | **Consistent credit rules** for services **and** classes (same period counter / eligibility model) |
| Credit restoration | **Automatic restore** on timely cancel by default; **configurable** per product/policy (align with `PackageLifecyclePolicy` + class policies) |
| Credit rollover | **No rollover** across billing periods by default |
| Payments | **Stripe Connect** for store + class/course checkout; **retain** Square on existing appointment checkout paths |
| Customer identity | Benefits on **Contact** (phone/email); **no redemption codes** in primary UX |

---

## 2. Program goals

1. **Revenue protection** — never display a price on a path that enrolls without charging when mode requires payment.  
2. **Entitlement integrity** — durable idempotency, concurrency-safe seats and credits, correct itemized mint/redeem.  
3. **One product feel** — guided “what do you want to sell?” maps to existing objects; advanced editors remain for power users.  
4. **Certification** — every launch row has a named acceptance test with reload verification (fix audit gap: no DB in audit run).

---

## 3. Phasing overview

| Phase | Focus | Ship gate |
|-------|--------|-----------|
| **0** | Safety gates + cert harness | No paid public class until Phase 1b; misleading copy removed |
| **1a** | Package builder: pooled + itemized + honest UX | APT-PKG / APT-MEP scripts PASS on cert workspace |
| **1b** | Paid class/workshop registration + course checkout | New UA: `ADV-CLS-PAY-*`, `ADV-CRS-*` |
| **1c** | Store idempotency + concurrent enroll/redeem | Load/race tests PASS |
| **2** | Guided business setup shell | Task journeys without replacing editors |
| **3** | Portal + mobile + membership class parity | APT-PRT extended; APT-MOB targeted |

**Starting point (explicit):** **Package builder** (`CreatePackageWizard`, `package-form.ts`, `packages.ts`, public store, book redemption). Then **paid class/course** on the **same purchase surface** (`/book/[slug]/store` + registration checkout).

---

## 4. Phase 0 — Gating and honesty (before marketing)

### 4.1 Public paid-class guard

**Behavior:** If `ClassSeries` metadata says `priceCents > 0` and payment mode is `pay_at_registration` (new field), **block** enrollment-only POST unless `paymentIntentId` / `checkoutSessionId` / internal `paymentReference` proves paid amount ≥ price (or deposit policy).

**Until Phase 1b ships:** For any series with `priceCents > 0` and no explicit `paymentMode: "free"` or `package_only`, **public API returns 403** with message to contact business OR **hide occurrence** from public list (`loadPublicGroupOfferings`).

**Reuse:** `parseClassSeriesMetadata`, `classRegistrationClosedReason` pattern in `public-group-offering.ts`.

**Do not:** Add a second enrollment table.

### 4.2 Copy and admin honesty

- Package editor: label **pooled** vs **itemized** modes; disable “itemized course bundle” marketing preset until Phase 1a redeem complete.
- Commerce overview: link matrix status **CODE vs PASS** to internal readiness flags.

**Acceptance:** `ADV-GATE-001` — paid series cannot complete enroll via current free-only POST (staging).

---

## 5. Phase 1a — Package builder (foundation)

### 5.1 Package kinds (single product model)

Extend `PackageFormState` / `package-form.ts` with explicit:

```ts
packageKind: "pooled" | "itemized"
```

| Kind | `creditRules` shape | `remainingCredits` keys |
|------|---------------------|-------------------------|
| **pooled** | One rule `quantity: N` + eligibility rules `quantity: 0` | `default` or single bucket; redeem against eligible `bookingTypeId` / listed series |
| **itemized** | Multiple rules each `quantity > 0` with `bookingTypeId` **or** `classSeriesId` | Keys: `type:{id}` / `series:{id}` (canonical — migrate from bare ids in redeem path) |

**Mint:** Update `purchasePackageForContact` in `packages.ts`:

- For each rule with `quantity > 0`, increment `remainingCredits[key(rule)]`.
- **Never** drop `classSeriesId` rules.
- If itemized rules empty after validation, fail purchase.

**Redeem — services:** Keep `applyBookingEntitlement` / `resolvePackageCreditKey`; extend to prefer **itemized key** when `bookingTypeId` matches.

**Redeem — classes/workshops:** Update `group-registration-entitlements.ts`:

- Resolve key by `series:{classSeriesId}` (and legacy `default` for pooled).
- **Do not** require pooled bucket for itemized packages.

**Reuse:** `PackageCreditRule` in `types.ts`, `packageGrantsOffering`, `togglePackageForOffering`, `CreatePackageWizard`, `use-package-editor.ts`.

### 5.2 Wizard UX (business intention)

Extend `CreatePackageWizard` steps (Opus chrome when routed via unified gates):

1. **What are you selling?** → sets `packageKind` + template (sessions / class bundle / mixed).
2. **What’s included?** → pick services, classes, workshops (existing eligibility section).
3. **How many of each?** → shown only for **itemized** (per-line quantity steppers).
4. **Price & validity** → existing.
5. **Preview** → shows customer view: store price, what they can book, expiration.
6. **Publish** → `active`, `directPurchase`, copy **store URL** + optional deep link.

**Advanced path:** “Open full package editor” → existing `package-editor-connected.tsx`.

### 5.3 Store + book (unchanged surface, stricter rules)

- **Store:** `processStoreCheckout` / `fulfillStorePurchase` — no change to Stripe flow except mint logic.
- **Book:** `lookupBookingEntitlements` — return per-key remaining for itemized (display breakdown in UI).

**Acceptance tests:**

| ID | Scenario |
|----|----------|
| `ADV-PKG-001` | Pooled 5× tutoring: buy store → book 5 times → 6th blocked |
| `ADV-PKG-002` | Itemized: 1× Service A + 1× Class B + 3× Service C — redeem each; wrong offering blocked |
| `ADV-PKG-003` | Cancel appointment within policy → credit restored (`restorePackageCreditsForAppointment`) |
| `ADV-PKG-004` | Two packages on one contact — picker on book + class register |

**Scripts:** Extend `scripts/cert-service-booking-entitlements.ts` + new `scripts/cert-itemized-package.ts` (prisma, cert workspace).

---

## 6. Phase 1b — Paid class, workshop, and course purchase

### 6.1 Series payment modes (metadata)

Add to class series metadata (parsed in `class-series-offering.ts`):

```ts
paymentMode: "free" | "pay_at_registration" | "package_or_membership_only"
priceCents: number
courseProductId?: string  // optional link to PackageProduct for full-series SKU
```

**Rules:**

| Mode | Public behavior |
|------|-----------------|
| `free` | Current enroll POST |
| `package_or_membership_only` | Enroll only with valid `packageBalanceId` or membership entitlement |
| `pay_at_registration` | Enroll only after payment record ≥ price (or deposit) |

### 6.2 Checkout flow (reuse store patterns)

**Option A (preferred for consistency):** For drop-in occurrence, create **Stripe Checkout** (one-time) via shared helper extracted from `createStoreCheckoutSession` with metadata:

- `transaction_type: "service_booking_class_registration"`
- `occurrenceId`, `contactId`, `workspaceId`, `amountCents`

On fulfill → call `enrollInClass` then attach payment to enrollment metadata.

**Option B:** Full **course** as **itemized package** product (1× `series:{id}`) sold on store → customer buys → enroll with `enrollFullSeries` + redeem itemized credit.

**UI:** `public-group-enrollment-client.tsx`:

- If paid mode → redirect to checkout or embedded pay step before POST enroll.
- If `requireFullSeries` → show single “Enroll in full course” with price from series or linked package.

**API:** `classes/route.ts` / `workshops/route.ts` — validate payment fulfillment id or package/membership before `enrollInClass`.

**Reuse:** `store-checkout.ts` fulfillment pattern, `membership-booking.ts` for membership-covered classes (extend to class series ids).

### 6.3 Course = one purchase, all sessions

**Business setup:** Wizard path “Sell a course” → creates/updates `ClassSeries` with `requireFullSeries: true`, recurrence generated, links **itemized package** (1× series) OR sets `pay_at_registration` on series.

**Customer:** Buy package OR pay checkout → single action → `enrollFullSeries: true` (existing `enrollInClass`).

**Acceptance:**

| ID | Scenario |
|----|----------|
| `ADV-CLS-PAY-001` | $75 class — pay → enrolled; no pay → 403 |
| `ADV-CRS-001` | 8-week course — one payment → 16 enrollment rows |
| `ADV-CRS-002` | Full series capacity check before any seat taken (existing loop — keep) |

---

## 7. Phase 1c — Correctness hardening

### 7.1 Durable store idempotency

**Replace** `fulfilledSessions` Set in `store-checkout.ts` with DB row e.g. `StoreFulfillment` (`stripeSessionId` unique, `fulfilledAt`, `resultJson`).

- `handleStoreCheckoutCompleted` and `fulfillStoreCheckoutBySessionId` check insert-first / unique constraint.
- Webhook retries safe.

**Acceptance:** `ADV-PAY-001` — replay same Stripe session id → single `PackageBalance`.

### 7.2 Concurrency

**Class capacity:** Wrap `assertOccurrenceCapacity` + `create enrollment` in transaction with `SELECT … FOR UPDATE` on occurrence row or use serializable isolation + recheck count.

**Package redeem:** Transaction: read balance → verify → write ledger → update balance (same pattern for `redeemPackageCredit`).

**Acceptance:** `ADV-RACE-001` — parallel enroll to last seat → exactly one success.

### 7.3 Membership class credits

Extend `membership-booking.ts` / class POST:

- `includedCredits` rules may use `classSeriesId`.
- Usage counters keyed by `series:{id}` in subscription `metadata.usage` (same period reset as `handleMembershipInvoicePaid`).

**Acceptance:** `ADV-MEM-CLS-001` — 4 class credits/month, 5th blocked until renewal.

---

## 8. Phase 2 — Guided business setup (one product)

### 8.1 Entry route

**New:** `/appointments/sell` or `/appointments/setup/sell` (Opus shell) — **not** replacing commerce hub.

**First question:** What do you want to sell?

| Choice | Orchestrates |
|--------|----------------|
| Sessions (package) | → `CreatePackageWizard` (pooled template) |
| Bundle (itemized) | → `CreatePackageWizard` (itemized template) |
| Membership | → `CreateMembershipWizard` |
| Single class / workshop | → `CreateClassWizard` / `CreateWorkshopWizard` + payment mode step |
| Full course | → Class wizard + recurrence + link package or pay-at-registration |

**Prerequisites inline:** If no services/classes, embedded “Create service” mini-step or deep link with return URL.

**Stripe:** Step “Connect payments” using existing merchant connection UI; block publish until connected **if** price > 0.

**Reuse:** All existing `create-*-wizard.tsx` components; new thin **orchestrator** only.

### 8.2 Publish step

Unified preview card:

- Customer purchase URL (store or class page)
- Sample redemption (book one session)
- Share link copy

---

## 9. Phase 3 — Customer self-service and mobile

### 9.1 Client portal

Extend `buildClientPortalWorkspace`:

- Query `ClassEnrollment` for contact → upcoming/past sessions grouped by series.
- Show per-package **itemized** remaining when applicable (not only `totalRemaining`).
- Link to book/enroll with `bookUrlWithContact`.

**Reuse:** `client-portal-app.tsx` “My access” section.

### 9.2 Mobile

Target public routes: `/book/[slug]`, `/book/[slug]/store`, `/book/[slug]/classes`, `/book/[slug]/workshops`, portal.

**Acceptance:** `ADV-MOB-001` — complete ADV-PKG-001 on 390px viewport.

---

## 10. Component reuse map (no rebuild list)

| Concern | Keep / extend |
|---------|----------------|
| Package CRUD | `packages.ts`, `/api/appointments/service-booking/packages` |
| Package UI | `create-package-wizard.tsx`, `package-editor-connected.tsx`, `packages-catalog-opus.tsx` |
| Ledger | `entitlements.ts`, `package-lifecycle.ts`, `booking-entitlements.ts` |
| Store | `store-checkout.ts`, `public-store-checkout-client` |
| Classes | `classes.ts`, `public-group-enrollment-client.tsx`, class/workshop API routes |
| Memberships | `memberships.ts`, `membership-stripe-webhook.ts`, `membership-booking.ts` |
| Portal | `client-portal/workspace.ts` |
| Admin chrome | `scheduling-unified-gates.tsx`, Opus scheduling components |

**New code (minimal):** orchestrator route, payment mode metadata, fulfillment table, transactional wrappers, cert scripts.

---

## 11. Non-goals (this program)

- Replacing `ClassSeries` with a second course engine  
- Square store subscriptions (defer)  
- New redemption-code system  
- Merging service/class editors into one form  
- AI rescheduler for class enrollments (defer; gate existing AR to appointments only)

---

## 12. Certification and launch checklist

Before marketing “packages, memberships, paid classes, courses”:

1. Run cert workspace bootstrap + all `ADV-*` and existing `APT-PKG`, `APT-MEM`, `APT-CLS` with **reload verification**.  
2. Phase 0 gates enabled in production config.  
3. Internal readiness dashboard: pooled packages · itemized · memberships · paid class · course · portal classes.  
4. Document known Square limitations (appointment checkout only).

---

## 13. Suggested implementation order (single coordinated PR train)

1. **Phase 0** gates + metadata `paymentMode` (safe defaults).  
2. **Phase 1a** itemized mint/redeem + wizard kind selector + tests.  
3. **Phase 1c** idempotency + transactions (can parallel 1a after design freeze).  
4. **Phase 1b** paid class + course checkout (depends on 1a for bundle courses).  
5. **Phase 2** sell orchestrator.  
6. **Phase 3** portal + mobile UA.

**First PR:** Phase 0 + Phase 1a (package builder) — matches “package builder as starting point.”

---

## 14. Open engineering notes (non-product)

- Canonical credit keys: introduce `type:` / `series:` prefixes with migration shim for existing balances.  
- Enrollment payment proof: store `paymentId` on `ClassEnrollment.metadata`.  
- Align `docs/ACUITY-PARITY-MATRIX.md` row status with `CODE` until `ADV-*` PASS recorded.

---

*This spec is the handoff for implementation. No code changes are implied until an explicit “implement Phase X” instruction.*
