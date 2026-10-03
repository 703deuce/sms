# Account, tenant, and login identity (Transovo)

This document explains how we know “this is your account,” how workspaces (tenants) relate to billing and missed calls, what broke with Google OAuth, what we fixed, and what to expect after deploy.

---

## How we know “this is your account”

**Account = one `User` row, keyed by email.**

- **Email/password signup:** if that email already exists → **409 “account already exists”** — no second user.
- **Google OAuth:** looks up **`User` by email first** — same row every time. Google does **not** create a new user on return visits.
- The database enforces **`User.email` UNIQUE** — two users with the same email cannot be inserted.

So “multiple accounts” from the same Google email was **not** multiple users. It was **multiple workspaces** under the **same** user because the app couldn’t see the link to the first workspace.

---

## What separates tenants (and billing / missed calls)

| Concept | Stored as | What it controls |
|--------|-----------|------------------|
| **You (login)** | `User` + session cookie (`userId`, email) | Who is authenticated |
| **Your business (tenant)** | `Workspace` | MCTB config, **free 10 / paid recovery limits**, numbers, missed-call events |
| **Permission** | `Membership` (`userId` + `workspaceId`, role OWNER) | Whether you may act as that workspace |

Recovery usage, payments, and missed-call history are tied to **`workspaceId`**, not “how many times you logged in.” If login silently created a **new** workspace, you’d see empty onboarding and a new number — but it was still **your** user id; you weren’t dropped into someone else’s data.

---

## Why this wasn’t “leaking into someone else’s account”

APIs resolve the active workspace from cookies, then **`resolveWorkspaceId()`** only allows a workspace if there is a **`Membership`** for **`session.userId`**. Guessing another workspace id does not grant access without that row.

The failure mode was **duplicate workspaces for the same user**, not cross-user access.

---

## What was broken (email + password included)

The shared DB layer (`prisma-compat`) **did not run** nested `memberships: { create: … }` on `workspace.create`. So signup and OAuth could create a workspace with **`ownerUserId` set** but **no `Membership` row**.

Then:

- **Password login:** `memberships.length === 0` → **403 “No workspace”** (annoying, but it did **not** create another workspace).
- **Google OAuth:** `memberships.length === 0` → treated like a **new customer** → **new workspace + new number** (the bug you hit).

So yes — the same class of bug could affect **email signup** (broken link), even though only Google kept **creating** tenants.

---

## What we fixed and tested

On PR **#584** (needs **merge + deploy**):

1. **Root fix:** nested membership creates run on workspace insert (automated test **PASS**).
2. **Google:** existing email → **never** creates another workspace.
3. **Single path for return login:** `resolveAuthenticatedWorkspace()` used by **password login and Google** so behavior matches.
4. **Signup:** explicit **`ensureOwnerMembership`** after workspace create.
5. **Contract test** `scripts/test-auth-account-identity-contract.ts` **PASS**:
   - one email → one `User`
   - repeat Google login → **same** workspace, **no** extra workspace
   - another user has **no** membership on your workspace

Production backfill scan: **0** owner workspaces still missing memberships (after cleanup for affected accounts).

---

## Example tenant after cleanup (affected Google OAuth customer)

Verified in production DB:

- **1 user**
- **1 workspace** (MCTB Business, **+1 888-665-0298**)
- **1 OWNER membership**

Duplicate workspace shells and numbers from repeat Google logins were removed.

---

## What to expect after deploy

- Same email (Google or password) → **same user** → **same workspace** → same missed calls, same recovery count, same place to pay/upgrade.
- Users **cannot** “farm” free 10s by logging in again — limits are on the **workspace**, not per login.
- To get back after a missed call: log in → land on **that** workspace → Missed Calls / Conversations on the **same** tenant.

**Next step:** merge and deploy **#584** so production auth matches the fixes and tests. After deploy, sign out, hard refresh, sign in once with Google and confirm landing on the Business workspace with the canonical number, not a fresh wizard.

---

## Why three things (User, Workspace, Membership)? Shouldn’t free plan always mean a membership?

**Short answer:** In product terms there is **one customer account** (one email). Under the hood we use **three linked rows** on purpose — not three “kinds of account.” They should **always** be created together. They were **not** supposed to diverge. When they did, it was a **bug**, not a free-plan vs trial product rule.

### What each row is for (not three signup products)

| Row | Job | Analogy |
|-----|-----|--------|
| **User** | Login identity (email, password/Google) | Your login |
| **Workspace** | Tenant: numbers, MCTB config, missed calls, **free 10 / paid recovery**, billing | Your business’s data bucket |
| **Membership** | “This user may access this workspace” (OWNER, etc.) | Key that ties login → bucket |

**Free plan** (10 recoveries/month) is **not** a fourth account type. It is **configuration on the workspace** (feature entitlements, usage counters, `billingPlan` / commercial state). You still need a **Membership** so login knows **which** workspace to open.

So: **free plan does not replace Membership.** Free plan answers “what limits does this workspace have?” Membership answers “which workspace does this email get after login?”

### What should happen on every signup (intended)

```
email signup or first Google login
  → 1 User
  → 1 Workspace (ownerUserId = that user)
  → 1 Membership (OWNER linking user ↔ workspace)
  → then MCTB/free/paid flags on that workspace
```

There is **no** valid steady state of “customer exists but has no membership” in the intended design.

### Why you saw workspace without membership (not legacy trial)

This was **not** because we intentionally support “workspace only” or because **free trial** is a separate legacy mode that skips membership.

What happened:

1. **Code always *tried* to create Membership** — signup and many workspace creates used Prisma nested `memberships: { create: … }`.
2. **Our Supabase/Prisma compat layer only inserted the Workspace row** and **dropped** the nested membership create (silent failure).
3. Login code mostly checks **Membership**, not `ownerUserId`. So the app behaved as if the customer had **no workspace**, even though a **Workspace** row existed with `ownerUserId` set.
4. **Google OAuth** then treated “no memberships” as **brand-new customer** and created **another** Workspace (+ number). Repeat login → repeat. Same **User**, multiple **Workspaces**, still broken **Membership** links until fixed.

**Legacy “trial” naming** (`billingPlan: trial`, old `trialActivatedAt`, etc.) is about **commercial state on the workspace** (card required, onboarding, transition to free/paid). It does **not** explain missing Membership rows. Those are orthogonal.

### Why three workspaces felt like three accounts

| What you saw | What it actually was |
|--------------|----------------------|
| Three toll-free numbers | Three **Workspace** rows (same **User**) |
| Onboarding again | New empty workspace, no link to finished MCTB workspace |
| “Three different things” | One **User**, three **Workspaces**, **zero Membership** until repair — not three emails |

After fix + cleanup: **one User, one Workspace, one Membership** for that email; free/paid limits stay on that workspace.

### Going forward (invariant)

**Rule:** If `workspace.ownerUserId` is set, there **must** be an OWNER **Membership** for that user.

Enforced by:

- Prisma-compat running nested membership creates
- Explicit `membership.create` / `ensureOwnerMembership` on signup and workspace helpers
- Returning login paths that **never** create a new workspace for an existing email
- Optional backfill: `scripts/backfill-owner-memberships.ts`

---

## Related code and scripts

| Item | Path |
|------|------|
| Session workspace resolution | `src/lib/auth/resolve-session-workspace.ts` |
| Google OAuth | `src/lib/auth/google-oauth.ts` |
| Password login | `src/app/api/auth/login/route.ts` |
| Owner membership invariant | `src/lib/workspace/owner-membership.ts` |
| Prisma-compat nested create | `src/lib/supabase/prisma-compat.ts` |
| Identity contract test | `scripts/test-auth-account-identity-contract.ts` |
| Nested create test | `scripts/test-prisma-compat-workspace-membership-create.ts` |
| Owner membership backfill | `scripts/backfill-owner-memberships.ts` |
| Duplicate workspace consolidation | `scripts/consolidate-duplicate-user-workspaces.ts` |
