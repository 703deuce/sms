# Page Blueprint — Membership Editor

**Status:** FINAL — Batch 4  
**Route:** `/appointments/memberships/new`, `/appointments/memberships/[id]`

```
PAGE: Membership editor
ROUTE: /appointments/memberships/new | [id]
CLASSIFICATION: SPLIT — focused editor
PRIMARY USER: Business owner
PRIMARY USER JOB: Create a membership and define what members receive
SOURCE FEATURE ROWS: Membership benefits, billing, members
```

## PRIMARY ACTION

Save

## SECONDARY ACTIONS

Duplicate, Enable/Disable, Subscribe member (admin assign)

## PAGE SECTIONS IN ORDER

1. General — name, description, price, billing frequency, active
2. Benefits — included credits, discounts (readable cards)
3. Access — member-only booking types multi-select
4. Credits — refresh per cycle, rollover (metadata if supported)
5. Billing & lifecycle — pause/cancel copy; provider connect link
6. Members — subscription table with pause/resume/cancel

## MODALS

Subscribe member (contact search)  
Cancel confirmation (immediate vs period end)

## DEPENDENCIES

Memberships API, types API, membership-lifecycle helpers, payments status

## BACKEND PRESENT

`upsertMembershipProduct`, `MembershipBenefits`, pause/resume/cancel subscription

## BACKEND GAPS

Rollover cap UI if not in benefits JSON. Stripe sync PROVIDER_BLOCKED in dev.

## BROWSER UAT

M1–M11 membership matrix (provider portions BLOCKED when no Stripe)

## OLD ROUTES

Commerce memberships tab
