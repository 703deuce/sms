# Review Requests / Reputation product — audit (Transovo `sms` repo)

**Purpose:** Clarify the **standalone Reputation / Review Requests** product (hub with Send, Bulk, QR, campaigns, etc. under `/businesses/{id}/reputation/...`). This is **not** Campaigns “review” step, **not** broadcast launch review, and **not** the general Business Messaging audit.

**Repo:** `703deuce/sms` (Transovo production app).

**Date:** 2026-10-14

---

## Short answer

- The **eight-page reputation inventory** (`/businesses/{id}/reputation/...`) is **not implemented in this repository** as those routes or that hub.
- **Review Requests does not work as a single end-to-end product UI** on Transovo `master` today.
- **SMS can still send** “please leave a review” messages only via **scattered backends** (automations, appointment workflows, generic campaigns/templates) if you configure them and pass sender/A2P/worker gates.

---

## The inventory you referenced (older Cursor / another shell)

These routes are **relative to** `/businesses/{id}/reputation`:

| # | Page | Route | Intended functionality |
|---|------|--------|-------------------------|
| 1 | Review Requests | `/requests` | Main hub: Send, Bulk Send, QR, Link tabs |
| 2 | Send Request | `/requests` (Send tab) | Individual review requests by SMS or email |
| 3 | Request History | `/requests?tab=bulk` | Bulk batches, recipient statuses, history |
| 4 | QR Code & Review Link | `/qr-campaigns` | Google review links, QR posters, scan tracking |
| 5 | Campaigns | `/campaigns` | Review request campaigns (sequences) |
| 6 | Templates | `/templates` | Review message templates |
| 7 | Automations | `/automations` | Automated review workflows |
| 8 | Contacts / Customers | `/contacts` | Customers for review requests |

**Adjacent reputation pages** (overview, Google Reviews feed, velocity, insights, audit, alerts, settings) were also listed in that inventory.

**Finding in this repo:** Searched for `/businesses/`, `reputation`, reputation `/requests`, `qr-campaigns` as a review product, bulk review batches, review velocity, etc. **No matching route tree exists here.**

That inventory is either:

- from **another app/repo** (multi-tenant “businesses” shell), or  
- a **planned** product map never built under those URLs in `sms`.

---

## What exists in *this* repo (mapped to your eight surfaces)

| Your surface | In this repo? | What you get instead |
|--------------|---------------|----------------------|
| **1–2. Review Requests hub / Send (SMS/email, templates)** | **No dedicated hub** | Automation block **`send_review_request`** → **`sendQuickSms`** (`src/lib/automations/actions.ts`). Workspace **`reviewLinkUrl`** + **`{{review_link}}`** (`src/lib/messaging/review-link.ts`, settings/branding/messaging). **Not** a reputation Send tab UI. |
| **3. Request history / bulk batches** | **No review-specific bulk product** | Mass **broadcast** uses `/api/mass-texting/campaigns` (different product). Playbook category **`review`** uses **`POST /api/campaigns`** (sequence engine). No “review batch history” UI like the inventory. |
| **4. QR & review link / scan tracking** | **No** `qr-campaigns` reputation route | Review URL from workspace settings + template merge. **No** QR poster + scan analytics product in this tree. |
| **5. Campaigns (review sequences)** | **Partial** | Playbook **`review`** in `src/lib/campaigns/catalog.ts`; `/campaigns/new/[category]` or broadcast compose — **marketing/automation**, not `/reputation/campaigns`. |
| **6. Templates** | **Yes (generic)** | `/templates` — shared SMS templates, not reputation-only. |
| **7. Automations** | **Yes (generic)** | `/automations` + **`send_review_request`** — **main real SMS path** for review asks if you build a flow. Events: `review_request.created`, `review_request.sent`, `review_request.clicked` (`src/lib/automations/events.ts`, `catalog.ts`). |
| **8. Contacts** | **Yes (generic)** | `/contacts`; **`POST /api/contacts/[id]/review`** records review on contact (`src/lib/automations/reviews.ts`). |

**Reputation analytics pages** (Google feed, velocity, audit, alerts): **not present** as routes in this repo.

**Appointment-related review ask:**

- Prebuilt workflow template **`review_request`**, action **`send_review_link`** → **`sendAppointmentSms`** (`src/lib/appointment-workflows/engine.ts`, template in `templates.ts`).
- Trigger: **`appointment_completed`** when that workflow is active.
- Parity: **`docs/GENERAL-APPOINTMENT-PARITY-AUDIT.md`** — Review requests **PARTIAL**; not appointment-native trigger certified.

**Data model note:** `review_request_suppression` table exists in Prisma/schema (suppression store); not a full reputation UI.

---

## Does it actually text if you add numbers and copy?

**Not through the eight-page reputation UI** — that UI is not in this repo.

**It can text** only via wired backends:

1. **Automation** with **`send_review_request`** (or **`send_sms`** with **`{{review_link}}`**) → **`sendQuickSms`**  
   - Needs: subscribed contact, sender/A2P, `from` / `phoneNumberId` on the flow, SMS worker running.

2. **Appointment workflow** step **`send_review_link`** → **`sendAppointmentSms`**  
   - Needs: workflow active, appointment completed, customer phone, SMS consent flags, AR/appointment SMS path.

3. **Campaign / playbook `review`** → **`POST /api/campaigns`** or mass-texting broadcast  
   - Different gates: `mass_texting`, credits, A2P, enrollment triggers for sequences.

There is **no** single product surface “Review Requests → Send → live” that proves all of that without building automations/workflows yourself.

---

## “Get More Reviews” outcomes (`/outcomes/review-requests/*`)

Defined in **`src/lib/outcomes/registry.ts`** (slug **`review-requests`**, title **Get More Reviews**).

Rendered by **`src/components/outcomes/outcome-page.tsx`** (`OutcomePageView`):

- **Overview** + shortcuts (profiles → `/settings/business`, messages → `/templates`, trigger/reminders → `/automations`, etc.).
- **Set Up** redirects to **`/automations/new`** (`launchHref`).
- Subpages (profiles, trigger, eligibility, messages, reminders, negative, notifications, test, results) are **quick-settings shells** with bullets + **“Open tools”** links — **not** the eight reputation screens.

**Marketing / discovery (still routable):**

- **`/solutions/customer-growth/automated-review-requests`** — catalog page; CTA **Open automations** (`src/lib/solutions-catalog.ts`).

**Middleware blocks outcomes URLs:**

All **`/outcomes/*`** requests redirect to **`/dashboard`**:

```text
src/middleware.ts (approx. lines 204–209)
  if (pathname === "/outcomes" || pathname.startsWith("/outcomes/")) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
```

So **`/outcomes/review-requests/...` is not reachable** on a normal browser hit today, even though page definitions exist in code.

---

## Agent type (related, not the reputation hub)

**Review Request Agent** — `agentType` **`review_request`**, outcome slug **`review-requests`** (`src/lib/agents/types.ts`). Setup is via **automations/agents**, not MCTB.

Voice capability hook **`reviews`** (`src/lib/solutions/hooks/reviews.ts`) — post-call / messaging config with **`reviewLink`**; not the reputation Send UI.

---

## MCTB product boundary

MCTB scope explicitly **excludes** review requests as a product feature inside MCTB (`docs/TRANSOVO-MCTB-PRODUCT-SCOPE-AND-DOMAIN-RULES.md`, `.cursor/rules/transovo-mctb-product-scope.mdc`).

---

## Distinction from October 14 “functional audit” confusion

| Topic | What it was |
|-------|-------------|
| Campaign **`/campaigns/new/review`** | Broadcast **pre-send launch review** (credits, audience, `canSend`) — **different feature**. |
| **Review Requests / Reputation** | Customer **reputation** SMS/email product — **this document**. |

The earlier broad audit covered **Mass Texting broadcast**, MCTB, AR, etc. It did **not** certify the **eight-page reputation module** — and that module **does not exist in this repo** under those paths.

---

## Bottom line (copy-paste summary)

| Question | Answer |
|----------|--------|
| Are `/businesses/{id}/reputation/*` pages in this repo? | **No.** |
| Is the eight-surface Review Requests hub “done”? | **No** — not as that product in `sms`. |
| Can customers get review-request SMS from Transovo at all? | **Only** if you use **automations** (`send_review_request`), **appointment workflows** (`send_review_link`), or **campaigns/playbooks** with **`{{review_link}}`**, and runtime gates pass. |
| Is that proven live end-to-end? | **Unverified** as a product; plumbing exists, dedicated reputation UI does not. |
| Can I open `/outcomes/review-requests`? | **No** — redirected to **`/dashboard`** by middleware. |
| Where to start configuring today? | **`/automations`**, **`/settings`** (review link URL), **`/templates`**, optional **`/solutions/customer-growth/automated-review-requests`**. |

---

## Key file references

| Area | Path |
|------|------|
| Send review request (automation) | `src/lib/automations/actions.ts` (`send_review_request`) |
| Review link resolution | `src/lib/messaging/review-link.ts` |
| Record review on contact | `src/lib/automations/reviews.ts`, `src/app/api/contacts/[id]/review/route.ts` |
| Appointment review workflow | `src/lib/appointment-workflows/templates.ts`, `engine.ts` |
| Playbook “review” category | `src/lib/campaigns/catalog.ts` |
| Outcomes registry | `src/lib/outcomes/registry.ts` (slug `review-requests`) |
| Outcomes redirect | `src/middleware.ts` |
| Solutions catalog | `src/lib/solutions-catalog.ts` (`automated-review-requests`) |
| Menu/copy inventory doc | `docs/THREE-PRODUCT-MENU-AND-PAGES-COPY.md` (section 6) |
| Parity status | `docs/GENERAL-APPOINTMENT-PARITY-AUDIT.md` (review requests PARTIAL) |

---

*End of document.*
