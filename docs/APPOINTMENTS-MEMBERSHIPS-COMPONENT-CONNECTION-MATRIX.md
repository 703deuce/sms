# Appointments Memberships — Component Connection Matrix

Route: `/appointments/memberships`  
Editor: `/appointments/memberships/[membershipId]`  
Create: `/appointments/memberships/new`

Canonical eligibility: `ServiceMembershipProduct.benefits.memberOnlyTypeIds` + `memberOnlyClassSeriesIds`.

## Summary counts

| Status | Count |
|--------|------:|
| CONNECTED_AND_WORKING | 42 |
| READ_ONLY_BY_DESIGN | 6 |
| INTENTIONALLY_DISABLED_WITH_REASON | 4 |
| EXTERNAL_PROVIDER_BLOCKED | 3 |
| BROKEN | 0 |
| NO_OP | 0 |
| PLACEHOLDER | 0 |

## Catalog (`memberships-catalog-connected.tsx`)

| Component | Control | User job | Status | Read | Write | API |
|-----------|---------|----------|--------|------|-------|-----|
| Search | text input | Find memberships | CONNECTED_AND_WORKING | product list | client filter | GET `/memberships` |
| Status filter | segmented buttons | Active/inactive | CONNECTED_AND_WORKING | product list | client filter | GET `/memberships` |
| Interval filter | select | Monthly/quarterly/annual | CONNECTED_AND_WORKING | `billingInterval` | client filter | GET `/memberships` |
| Sort | select | Name/price/members/newest | CONNECTED_AND_WORKING | product list | client filter | GET `/memberships` |
| Summary strip | inline metrics | Operational snapshot | CONNECTED_AND_WORKING | `getMembershipCatalogStats` | — | GET `?view=stats` |
| New membership | link | Start wizard | CONNECTED_AND_WORKING | — | navigate | `/memberships/new` |
| Table row | link | Open editor | CONNECTED_AND_WORKING | product | navigate | GET `?productId=` |
| Duplicate | menu action | Copy product config | CONNECTED_AND_WORKING | product | duplicate | POST `action=duplicate` |
| Deactivate | menu action | Stop new sales | CONNECTED_AND_WORKING | `active` | upsert | POST upsert |

## Editor shell

| Component | Control | User job | Status | Read | Write | API |
|-----------|---------|----------|--------|------|-------|-----|
| Header save | button | Persist changes | CONNECTED_AND_WORKING | form dirty | upsert | POST upsert |
| Duplicate / Deactivate / Delete | menu | Product lifecycle | CONNECTED_AND_WORKING | product | actions | POST actions |
| Summary strip | meta strip | At-a-glance ops | CONNECTED_AND_WORKING | form + subs | — | GET subs |
| Section tabs | horizontal nav | Switch section | CONNECTED_AND_WORKING | URL `?section=` | router | — |

## Overview

| Component | Control | User job | Status | Read | Write | Domain |
|-----------|---------|----------|--------|------|-------|--------|
| Name / description | inputs | Define product | CONNECTED_AND_WORKING | product | upsert | `ServiceMembershipProduct` |
| Customer preview | read panel | See purchase copy | READ_ONLY_BY_DESIGN | form | — | — |
| Access / member health / billing summaries | panels | Ops snapshot | CONNECTED_AND_WORKING | benefits + subs | — | subscriptions |
| Setup summary links | buttons | Jump to section | CONNECTED_AND_WORKING | form | navigate | — |

## Access

| Component | Control | User job | Status | Read | Write | Domain |
|-----------|---------|----------|--------|------|-------|--------|
| Benefit type card | choice | Included access model | CONNECTED_AND_WORKING | `benefitType` | form | `MembershipBenefits` |
| Member pricing card | — | Discounted member price | INTENTIONALLY_DISABLED_WITH_REASON | — | — | Not enforced at checkout |
| Included allowance card | — | Recurring credits | INTENTIONALLY_DISABLED_WITH_REASON | — | — | `includedCredits` type-only |
| Eligible offerings list | rows | See included bookings | CONNECTED_AND_WORKING | benefits | — | benefits JSON |
| Manage eligibility drawer | drawer + toggles | Add/remove offerings | CONNECTED_AND_WORKING | offerings APIs | benefits | POST upsert |
| Service/Class toggle (offering editor) | row button | Bidirectional sync | CONNECTED_AND_WORKING | benefits | `toggleMembershipForOffering` | same benefits JSON |

## Pricing & billing

| Component | Control | User job | Status | Read | Write | Billing |
|-----------|---------|----------|--------|------|-------|---------|
| Recurring price | money input | Set subscription price | CONNECTED_AND_WORKING | `priceCents` | upsert | Stripe on checkout |
| Billing interval | choice cards | Month/quarter/year | CONNECTED_AND_WORKING | `billingInterval` | upsert | Stripe price |
| Purchase availability | choice cards | Public/hidden/booking | CONNECTED_AND_WORKING | metadata | upsert | store listing |
| Cancellation policy | choice cards | Period end / immediate | CONNECTED_AND_WORKING | metadata | upsert | lifecycle lib |
| Active toggle | switch | Allow new purchase | CONNECTED_AND_WORKING | `active` | upsert | — |
| Trial / setup fee | — | Trial period | INTENTIONALLY_DISABLED_WITH_REASON | — | — | Not in billing runtime |
| Price change warning | note | Existing subscriber impact | READ_ONLY_BY_DESIGN | — | — | Stripe grandfathering |

## Members

| Component | Control | User job | Status | Read | Write | API |
|-----------|---------|----------|--------|------|-------|-----|
| Member summary strip | metrics | Lifecycle counts | CONNECTED_AND_WORKING | subscriptions | — | GET `view=subscriptions` |
| Members table | table | Operate subscribers | CONNECTED_AND_WORKING | subscriptions | — | GET subs |
| Member detail drawer | drawer | Inspect member | CONNECTED_AND_WORKING | subscription | — | — |
| Cancel at period end | action | Stop renewal | CONNECTED_AND_WORKING | subscription | cancel | POST `cancel_subscription` |
| Mark recovered | action | past_due → active | CONNECTED_AND_WORKING | subscription | restore | POST `restore_subscription` |
| View contact | link | Open CRM record | CONNECTED_AND_WORKING | `contactId` | navigate | `/contacts/[id]` |
| Pause / retry payment | — | Provider actions | EXTERNAL_PROVIDER_BLOCKED | — | — | Needs Stripe webhooks |

## Lifecycle

| Component | Control | User job | Status | Read | Write | Enforcement |
|-----------|---------|----------|--------|------|-------|-------------|
| Renewal module | read | Explain auto-renew | READ_ONLY_BY_DESIGN | interval | — | billing provider |
| Cancellation module | choices | Configure policy | CONNECTED_AND_WORKING | metadata | upsert | `cancelMembershipProductSubscription` |
| Payment recovery module | read | past_due behavior | CONNECTED_AND_WORKING | status | — | `subscriptionGrantsAccess` denies booking |
| Access during past_due | note | Booking impact | READ_ONLY_BY_DESIGN | lifecycle | — | server enforced |

## Activity

| Component | Control | User job | Status | Read | Write | Source |
|-----------|---------|----------|--------|------|-------|--------|
| Activity filters | search + select | Filter events | CONNECTED_AND_WORKING | activity list | client | derived from subs + metadata.activity |
| Activity table | table | Audit lifecycle | CONNECTED_AND_WORKING | subscriptions | — | `listMembershipActivityForProduct` |

## Create wizard

| Step | Controls | Status | Result |
|------|----------|--------|--------|
| Basics | name, description | CONNECTED_AND_WORKING | form state |
| Access | eligibility drawer | CONNECTED_AND_WORKING | benefits |
| Price & billing | price, interval | CONNECTED_AND_WORKING | product fields |
| Review | summary | READ_ONLY_BY_DESIGN | POST create → editor |

## Booking integration (server)

| Path | Status | Enforcement |
|------|--------|-------------|
| Service/meeting book | CONNECTED_AND_WORKING | `assertMemberAccessForBookingType` |
| Class/workshop enroll | CONNECTED_AND_WORKING | `assertMemberAccessForClassSeries` in `enrollInClass` |
| past_due member book | CONNECTED_AND_WORKING | `subscriptionGrantsAccess` returns false for past_due |
| Member pricing at checkout | INTENTIONALLY_DISABLED_WITH_REASON | Types exist; not applied |
| Stripe webhook lifecycle sync | EXTERNAL_PROVIDER_BLOCKED | Manual admin actions work; webhooks incomplete |
