# Transovo Advanced Scheduling — New UI2 Opus Premium UX Implementation Specification

**Status:** Approved layout + component binding for **Deliverable 2** (frontend implementation)  
**Date:** 2026-10-13  
**Wireframe reference (layout architecture):** `docs/audits/assets/advanced-scheduling-wireframes-reference.jpg`  
**Journey + screen inventory:** `docs/audits/advanced-scheduling-phase-2-3-ux-architecture.md`  
**Backend / behavior:** `docs/audits/advanced-scheduling-implementation-spec.md` · PR **#657** (do not merge/deploy without authorization)

---

## Objective

Rebuild the advanced scheduling **business and customer interfaces** to match the **approved wireframe layouts** while using the existing **New UI2 Opus** premium component system.

This is a **coordinated frontend implementation** across relevant existing pages — not a new standalone UI, not a design-system replacement, and not a backend rewrite.

| Authority | Owns |
|-----------|------|
| **Wireframes** | Page architecture, placement, proportions, interaction containers |
| **New UI2 Opus** | Visual appearance, tokens, premium controls, decoration |
| **Existing connected shells + APIs** | Behavior, persistence, entitlements, payments |

The **package creation wizard is the visual benchmark** and **priority redesign**. Preserve `package-form.ts`, `CreatePackageWizard` logic, `packageSavePayload`, credit models, and publish APIs — change **layout, chrome, and interaction** only unless a gap requires a thin adapter.

**Do not** ship generic HTML forms, bare Shadcn defaults, stripped tables, or unstyled cards. **Do** use `ArOpusPage`, `OpusSchedulingHero`, `OpusDataSurface`, `OpusIconBadge`, `Button` from newui-transplant, `Sheet` for pickers, and existing kit (`Stat`, `Pill`, `EmptyState`, `Callout`).

**Cardinal rule:** Change how people interact with existing functionality — **do not replace** the functionality.

---

## Layout rules (locked)

### Business workspace — desktop

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ Sidebar  │ Page title + description              [Primary action]     │
│ ~240px   ├──────────────────────────────┬─────────────────────────────┤
│          │ Main working area · 65–70%   │ Context / live preview ·    │
│          │                              │ 30–35% (creation/edit only) │
└──────────┴──────────────────────────────┴─────────────────────────────┘
```

- **70/30 (or 68/32)** applies to **creation and editing** with live preview (package wizard, membership wizard, service/class create when preview adds value).
- **Lists and operational tables** use **full content width** — no permanent right column on packages list, enrollment roster, or scheduled list.
- **Never** three equal-width content columns for core scheduling workflows.

### Global desktop geometry (1440px reference)

| Token / region | Target | Reconcile with |
|----------------|--------|----------------|
| Viewport reference | 1440px | — |
| Sidebar expanded | 240–256px | Existing product shell |
| Content padding | 32px LG / 24px MD | `ArOpusPage`, `Page` |
| Content max-width | ~1320px (`max-w-[1440px]` on page) | `AR_OPUS_PAGE_CLASS` |
| Page title | 26–30px semibold | `OpusSchedulingHero` (`text-2xl` → tune to spec) |
| Description | 13–14px | `text-sm` muted |
| Header → content | 24px | `mb-6` on hero |
| Section gap | 24–32px | Opus spacing |
| Control gap | 12–16px | — |
| Table row min height | 52–60px (64–72px packages list) | `OpusTd` padding |
| Input / primary button height | 40–44px | Opus `Button`, inputs |
| Icon button | 32–36px | — |
| Surface radius | 10–14px major surfaces | `OPUS_CARD` |

**Global page structure (every business page):**

1. Existing sidebar  
2. Existing top application header  
3. Page header: title, description, primary action right  
4. Contextual tabs/filters only when needed  
5. One dominant main working region  
6. Context preview panel only when it adds immediate value  

---

## 1. Mandatory route / component / API map

Inspect before coding. **Do not invent routes** or duplicate components without documenting why reuse failed.

| Surface | Route | Opus / primary component | Legacy fallback | API / lib |
|---------|-------|--------------------------|-----------------|-----------|
| **Scheduling overview** | `/appointments/overview` (redirects in unified mode) · product home often `AR_ROUTES.home` calendar | *Gap:* no dedicated Opus “Scheduling overview” — extend calendar home or add overview Opus page | `AppointmentsOverviewClient` | Aggregates from appointments + service-booking APIs |
| **Create menu (“What to sell”)** | *Proposed* `/appointments/sell` | *New* `SellOrchestratorOpus` (thin) | — | Readiness from merchant + catalog counts |
| **Services list** | `/appointments/services` | `ArServicesWorkspaceOpus` | `ServicesWorkspaceConnected` | Service-booking types API |
| **Service create** | `/appointments/services/new` | *Reuse package grammar* · today `CreateServiceWizard` | Same | Service CRUD |
| **Service edit** | `/appointments/services/[id]` | `ArServicesWorkspaceOpus` | Connected | Sections via `?section=` |
| **Meetings** | `/appointments/meetings` | `ArMeetingsWorkspaceOpus` | `MeetingsWorkspaceConnected` | Meeting types |
| **Classes list/edit** | `/appointments/classes`, `/[id]` | `ClassesWorkspaceOpus` | `ClassesWorkspaceConnected` | `classes.ts`, sections |
| **Class create** | `/appointments/classes/new` | Class create wizard in workspace | Same | `ClassSeries` |
| **Workshops** | `/appointments/workshops` | `WorkshopsWorkspaceOpus` | `WorkshopsWorkspaceConnected` | `metadata.kind` workshop |
| **Courses (full series)** | Same class routes · `requireFullSeries` | Class editor sections | Same | `enrollFullSeries` |
| **Packages list** | `/appointments/packages` | `PackagesCatalogOpus` | `PackagesCatalogConnected` | `usePackagesCatalog`, `GET …/packages` |
| **Package wizard** | `/appointments/packages/new` | **Refactor** `CreatePackageWizard` inside `ArOpusPage` shell | *Today:* pilot CSS `appt-overview-pilot`, `max-w-[1100px]`, no preview column | `package-form.ts`, `POST …/packages` |
| **Package editor** | `/appointments/packages/[id]` | `PackageEditorConnected` + Opus catalog link | Full editor | `use-package-editor` |
| **Memberships list** | `/appointments/memberships` | `MembershipsCatalogOpus` | `MembershipsCatalogConnected` | Memberships API |
| **Membership create** | `/appointments/memberships/new` | `CreateMembershipWizard` → 68/32 layout | Same | `memberships.ts` |
| **Commerce / storefront admin** | `/appointments/commerce`, `/appointments/booking` | `CommerceHubOpus`, `BookingSettingsOpus`, `BookingShareOpus` | Admin clients | Store URLs, theme |
| **Public storefront** | `/book/[slug]/store` | `public-store-checkout-client` | — | `store-checkout.ts` |
| **Public book hub** | `/book/[slug]` | `PublicBookingConnected` / `public-booking-opus-view` | — | Public book API |
| **Service book flow** | `/book/[slug]/[serviceId]` | `PublicBookingServiceConnected` | — | Slots + entitlements |
| **Classes public** | `/book/[slug]/classes` | `public-group-enrollment-client` | — | Classes route + checkout |
| **Workshops public** | `/book/[slug]/workshops` | Same client (wrapper) | — | Workshops route |
| **Checkout return** | `/book/payment/success` | Success handler | — | Fulfillment by session id |
| **Portal login** | `/client/[slug]` | `ClientPortalLogin` | — | `/api/client/portal/auth/login/[slug]` |
| **Portal app** | `/client` | `ClientPortalApp` | — | `/api/client/portal/*`, `buildClientPortalWorkspace` |
| **Token portal (legacy)** | `/portal/[token]` | `ClientPortalPublicClient` | — | `resolveClientPortalSession` |
| **Client detail (business)** | `/appointments/clients/[id]` | `ClientDetailOpus` | — | Contact + entitlements |
| **Enrollment / attendance** | Classes workspace sections | `ClassesWorkspaceOpus` + connected roster | Recovery: `ClassRegistrationRecoveryPanel` | `registration-recovery` API |
| **Payment/enrollment recovery** | Classes workspace | `class-registration-recovery-panel.tsx` | — | `GET/POST …/registration-recovery` |

**Gates:** `scheduling-unified-gates.tsx` · `SchedulingPageGate` in `scheduling-page-gate.tsx`.

---

## 2. Reused New UI2 Opus components (mandatory set)

| Component | Path | Use on |
|-----------|------|--------|
| `ArOpusPage` | `newui-transplant/components/appointment-reminders/ar-opus-layout.tsx` | All business pages |
| `OpusSchedulingHero` | `opus-scheduling-chrome.tsx` | Page headers |
| `OpusMetricBand`, `ArStatGrid`, `Stat` | chrome + `kit` | Overview metrics, catalog stats |
| `OpusDataSurface`, `OpusListControls` | chrome + layout | Tables + toolbars |
| `OpusSearchField` | ar-opus-layout | Search ~280–320px |
| `OpusTh`, `OpusTd`, `OPUS_TABLE_HEAD` | opus-scheduling-chrome / opus-tables | Lists |
| `Button`, `DropdownMenu` | newui-transplant/ui | Actions |
| `Pill`, `EmptyState`, `Callout` | kit | Status, empty |
| `OpusIconBadge` | kit | Product type icons |
| `Sheet`, `SheetContent` | newui-transplant/ui | Offering picker 420–480px (package wizard) |
| `Tabs` | ui | Portal, overview lists |
| `Field`, `TextInput`, `NumberField`, `Panel` | `components/appointments/workspace-ui` | Wizard fields (restyle inside Opus shell) |
| `PackageEligibilitySection` | packages | Step 2 data — **replace layout**, keep toggle logic |

**New shared primitives to extract (Deliverable 2):**

| Primitive | Responsibility |
|-----------|----------------|
| `SchedulingWizardShell` | Step indicator 56–64px, 68/32 grid, sticky preview, footer nav |
| `PackageLivePreview` | Right column summary all steps |
| `OfferingPickerSheet` | Search, tabs Services/Classes/Courses, inline create |
| `SellTemplateCards` | Step 1 two-up tiles 180–210px height |
| `IncludedItemRow` | 72–84px rows, qty stepper, remove |

---

## 3. Scheduling overview

**Map to:** Existing overview or unified **Calendar** home + commerce signals — implement wireframe **without duplicating metrics** on decorative cards.

**Layout:**

- **Row 1 — Header:** “Scheduling” + description; right: **Create** (opens sell menu or dropdown: package / service / class / membership) + secondary booking-page link.
- **Row 2 — Metrics:** 4-column grid, 104–120px height, 16px gap — sales, new customers, bookings, class enrollments (wireframe labels; wire to real analytics when available, skeleton otherwise).
- **Row 3 — 8/4 grid:** Left tabbed upcoming appointments + classes; right setup/publishing status (Stripe, store URL, incomplete offerings).
- **Row 4 — Full width:** Recently created services, classes, packages, memberships — columns: name, type, price, visibility, activity, actions.

---

## 4. Packages list

**Map to:** `PackagesCatalogOpus` — align to spec (today: hero + stats band + table; **remove** extra metric duplication if overview owns KPIs).

**Header:** “Packages” + description; **Create package** primary.

**Toolbar (~48px):** Search 280–320px, status filter, type filter (pooled vs itemized **admin-only** label), sort.

**Table:** Full width, rows 64–72px, icon/thumbnail, name + description, inclusion summary, price, purchases, status pill, updated, row menu. Row click → `/appointments/packages/[id]`.

**Empty state:** Opus `EmptyState` + examples (prepaid sessions, mixed bundle).

**No** permanent right sidebar.

---

## 5. Create Package Wizard — priority redesign

**Map to:** `src/components/appointments/packages/create-package-wizard.tsx` + `src/app/(app)/appointments/packages/new/page.tsx`.

### Current deficiencies (must fix)

| Issue | Current | Target |
|-------|---------|--------|
| Shell | `appt-overview-pilot`, not `ArOpusPage` | Full app shell + Opus surfaces |
| Max width | `max-w-[1100px]` centered | `ArOpusPage` ~1320–1440 content |
| Step 1 layout | **3-column** template grid | **2-column** selectable tiles 180–210px |
| Step 2 | `PackageEligibilitySection` checklist | Included-item **rows** + **OfferingPickerSheet** |
| Preview | None | **32% sticky** `PackageLivePreview` |
| Labels | Exposes `packageKind` concepts in copy | **Prepaid sessions** vs **Bundle of services and classes** only |
| Draft | Publish-only flow | **Save draft** without publish |
| Success | Redirect to editor only | Publish success panel: storefront, copy link, create another |

### Overall structure

**Page header:** Back to Packages · “Create a package” · description · **Save draft** right.

**Step indicator (horizontal, 56–64px):**

1. Package type  
2. What’s included  
3. Pricing and rules  
4. Review and publish  

**Content:** 68% editor | 32% live preview | 24px gap | sticky preview below app header.

**Footer:** Back left · Continue right · disabled states with reason.

### Step 1 — Package type

**Left:** “What kind of package are you creating?” — two large selectable Opus tiles:

- **Prepaid sessions** (e.g. five tutoring appointments) → `prepaid_sessions` / pooled  
- **Bundle of services and classes** (e.g. cyber class + Python course + 3 tutoring) → `mixed_bundle` / itemized  

Name + optional description below.

**Right:** Live preview — title, type plain-language, draft badge.

### Step 2 — What’s included

**Left:** “Add what customers receive” · **Add service or class** → `OfferingPickerSheet` 420–480px:

- Tabs: Services · Classes · Courses (`requireFullSeries`)  
- Search · scrollable results · Add / multi-select  
- **Create new service/class** inline → existing wizards in sheet or nested flow → return with new id · **preserve draft** in `sessionStorage` or server draft field if added  

**Rows:** 72–84px, icon, name, type badge, qty −/+, remove.

**Right:** Itemized list, totals, missing requirements.

### Step 3 — Pricing and rules

**Left sections (headings, not card wall):**

- A. Package price (180–240px currency), compare-at optional, Stripe status chip  
- B. Validity — never / days after purchase / fixed date (conditional fields)  
- C. Redemption rules from step 2 + cancel credit restore if supported  
- D. Visibility — public / unlisted (existing flags)

**Right:** Price + validity customer summary.

### Step 4 — Review and publish

**Left:** Compact review blocks with **Edit** jump to step.

**Right:** Storefront preview card — Buy CTA (non-functional preview).

**Bottom:** Save draft · **Publish package** (validation errors explicit).

**After publish:** Success actions — View storefront · Copy purchase link · Create another · Manage package.

**Persistence:** Keep `packageSavePayload(form)`, `validatePackageForm`, `buildCreditRules`, `applyPackageSellTemplate`.

---

## 6. Service and class creation

**Map to:** `CreateServiceWizard`, class/workshop wizards, `ArServicesWorkspaceOpus`, `ClassesWorkspaceOpus`.

Same visual grammar as package wizard (wizard shell + preview where useful).

**Course:** full-width session schedule **rows**, not many small cards.

**Invoked from package picker:** modal/sheet flow with `returnTo=/appointments/packages/new&draft=…`.

---

## 7. Membership creation

**Map to:** `CreateMembershipWizard`, `MembershipsCatalogOpus`.

Four stages: details · benefits · price/renewal · review. **68/32** layout. Benefits rows for service + class credits per cycle. Do not claim class credits complete until `ADV-MEM-CLS-001` passes.

---

## 8. Storefront and publishing

**Business:** `CommerceHubOpus`, `BookingShareOpus` — status, public URL, copy link, visibility list.

**Public:** `/book/[slug]/store` — category nav Services / Classes / Packages / Memberships; responsive grid 3/2/1 columns; no admin controls.

---

## 9. Customer package detail and purchase

**Map to:** Store product detail within `public-store-checkout-client` (extend layout).

Desktop max ~1120px, **60/40** — inclusions left, purchase summary right. Mobile: inclusions then sticky-safe purchase CTA.

---

## 10. Checkout and purchase confirmation

Stripe Checkout hosted — no custom card form.

Success: verified fulfillment state; benefits list; **Book your first session** primary; **View my bookings and packages** secondary.

Full-course: show enrolled schedule — do not ask to book already-enrolled sessions.

---

## 11. Customer booking with benefits

**Map to:** `public-booking-*`, `public-group-enrollment-client`.

Sequential: choose → slot/occurrence → eligibility → confirm.

Verified session/contact: auto-detect benefits, show remaining, default when unambiguous, picker when multiple (#657). No coupon codes. No email-only trust.

---

## 12. Customer portal

**Map to:** `ClientPortalApp`, `buildClientPortalWorkspace`.

Max ~1160–1240px. Tabs: Overview · Bookings · My packages · Memberships.

**My packages:** per-line remaining + Book CTA (itemized). **Phase 3:** class enrollments on Overview/Bookings.

Passwordless: `ClientPortalLogin` OTP — extend UI to match Opus public surfaces where appropriate.

---

## 13. Business enrollment and attendance

**Map to:** `ClassesWorkspaceOpus` / connected — full width, roster table, attendance, benefit/payment column, waitlist tab, recovery panel collapsed by default.

---

## 14. Responsive rules

Test: **1440, 1280, 1024, 768, 390, 375**.

| Breakpoint | Behavior |
|------------|----------|
| ≥1280 | Sidebar + editor/preview split |
| 768–1279 | Stack preview; padding 20–24px |
| &lt;768 | Single column; “Step 2 of 4”; full-height picker sheet; preview via toggle |

---

## 15. Premium visual execution

Use Opus icons, gradients on hero (`OpusSchedulingHero`), `Pill` statuses, skeletons (`OpusTableSkeleton`), focus/hover from tokens. **Do not flatten.** **Do not** add decorative cards to fill space.

---

## 16. Implementation discipline

Before each page:

1. Identify connected component + API  
2. Map every existing field/action to new layout  
3. No duplicate entitlement/payment/calendar logic  
4. Preserve Stripe/Square/Microsoft integrations  
5. Shared `SchedulingWizardShell` for wizard-family pages  

**Do not merge or deploy** without authorization.

---

## 17. Acceptance requirements

Verify:

- [ ] Prepaid sessions package E2E  
- [ ] Mixed services/classes/course package (IT Career Starter)  
- [ ] Inline create service/class + return without losing wizard draft  
- [ ] Save draft + publish  
- [ ] Storefront listing correct  
- [ ] Customer purchase + **verified** Stripe fulfillment  
- [ ] Secure benefit access (no email-only)  
- [ ] Correct redemption per itemized key  
- [ ] Full-course auto-enroll  
- [ ] Portal balances + bookings  
- [ ] Membership service/class benefits  
- [ ] Operator recovery retry  
- [ ] Responsive matrix  
- [ ] Legacy functionality preserved  

Scripts/journeys: `ADV-CUST-IT-STARTER`, `ADV-BIZ-PKG-001`, `ADV-MOB-PKG-001`, cert scripts on isolated DB.

---

## 18. Final deliverable (implementation complete when)

1. Updated route-to-component map (as-built) in this doc  
2. List of reused Opus components  
3. Screenshots: every major page @ desktop + mobile → `/opt/cursor/artifacts/`  
4. Functional acceptance results  
5. Remaining gaps  

**Rendering alone is not complete** — full business create → publish → purchase → redeem → portal must work and match this layout spec.

---

## 19. Wireframe screen index (reference image)

| # | Wireframe | Maps to |
|---|-----------|---------|
| 1 | Business dashboard | §3 Scheduling overview |
| 2 | Create menu | `/appointments/sell` |
| 3–6 | Package wizard steps | §5 |
| 7 | Package detail (business) | Package editor post-publish |
| 8 | Customer store PDP | §9 |
| 9 | Checkout | Stripe + customer info gate |
| 10 | Purchase success | §10 |
| 11 | Customer portal packages tab | §12 |

---

*End of implementation specification. Wireframes = layout; New UI2 Opus = visual system; existing APIs = behavior.*
