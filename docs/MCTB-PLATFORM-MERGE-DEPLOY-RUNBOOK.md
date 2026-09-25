# MCTB Platform Sender — Merge, Deploy & Handset Runbook

**Status:** Engineering certification **complete** (combined stack). **Do not** add pre-launch architecture changes for assignment/routing unless a production defect is found.

**Evidence:** `docs/MCTB-PLATFORM-COMBINED-STACK-CERTIFICATION.md`  
**Combined test branch (pre-merge):** `cursor/mctb-combined-stack-cert-2304`  
**PRs:** Tenant remediation first (e.g. #503), then Active Conversation Ownership **#504**.

---

## What is proven (combined candidate)

```
Consumer + 888
      ↓
ACTIVE assignment
      ↓
Correct customer workspace
      ↓
Existing tenant boundary
      ↓
Correct Lead Recovery / Brain / booking
```

Also certified together:

- At most one ACTIVE owner per pair (DB partial unique + `P2002` → COLLISION/REUSED)
- Business B blocked **before** provider send when A owns the pair
- Pre-assignment history via legacy 14-day resolver; ambiguous → fail closed
- Release / reclaim / inbound race (48 interleavings) — no wrong-tenant delivery
- WORKSPACE sender outside assignment
- Voice webhook auth on combined code

**Certified combined SHA (tests run):** `77c710516ca4a71102a2c7f9fa78d0b0abf1692d`  
**Production deploy SHA:** must be the **final `master` commit after both merges** — re-verify health + migration on that SHA only.

| Gate | Status |
|------|--------|
| READY TO MERGE | **DONE** (`master` includes tenant + ownership; target **`6228d16b`**) |
| READY TO DEPLOY | **DONE** (ops confirmed production deploy + migrations complete — 2026-09-25) |
| HANDSET CERTIFICATION | **PENDING** — only remaining launch proof for platform routing |

---

## Operational sequence

### Completed (engineering / deploy)

1. ~~Merge tenant remediation + #504 to `master`~~ — **done** (`6228d16b`).
2. ~~Coolify production deploy + `prisma migrate deploy`~~ — **confirmed complete** (2026-09-25).
3. **Spot-check when convenient:** `/api/health` `commitSha` ≥ `6228d16b`; production DB has `mctb_platform_sender_assignments` + `mctb_platform_sender_assignments_active_pair_key`.
4. **Telnyx shared Voice tools** — confirm `Authorization` republish if not already done with this deploy (required for voice tool auth in prod).

### Next (only remaining gate for platform routing)

5. **MCTB handset certification** (below) — proves `ACTIVE_ASSIGNMENT` on real 888 + iPhone, not just engineering tests.

If final `master` differs only by expected merge commits and **no conflict-resolution edits** touch assignment, tenant isolation, or Voice tool auth paths, **no re-certification dev pass is required** — combined certification remains pre-production evidence.

---

## Handset certification (order locked)

Reference: `docs/MCTB-PLATFORM-COMBINED-STACK-CERTIFICATION.md` §6.

### Before first iPhone reply (after press-1 + recovery SMS)

Establish **all three** on production DB/logs:

| Fact | Expected |
|------|----------|
| Provider actual From | `+18885046264` |
| `Message.from` | `+18885046264` |
| ACTIVE assignment | `consumerE164` + canonical 888 `platformPhoneNumberId` → **expected customer** `workspaceId` |

Then send the **first consumer reply**. This is the first production proof that **ACTIVE_ASSIGNMENT** — not the 14-day fallback — routes the thread.

**Require:** `resolutionSource = ACTIVE_ASSIGNMENT`

### Conversation continuity

- One **normal** conversational reply from consumer
- **Second AI turn** (Lead Recovery) on same workspace Brain/booking
- Do **not** release until second turn succeeds

### Later steps (same session / order)

1. Explicit **release** / reclaim (pair can be claimed again for another workspace sequentially)
2. **HELP** (platform-safe; no tenant leak)
3. **STOP last** — suppression + assignment release; blocks further PLATFORM sends from that handset on 888

**STOP must be last.** Do not STOP before other cases — it poisons subsequent handset tests on the shared 888.

---

## Launch-complete definition (routing)

When handset steps pass on **final production SHA**, platform sender routing is **complete for current launch scope**:

- One Transovo platform TFN serves customer workspaces **sequentially**
- Deterministic **active ownership** of `(consumer, 888)`
- Tenant identity is **not** platform-number owner, AI, or recent-message heuristics

**Post-launch:** `COLLISION` and `PLATFORM_SENDER_PAIR_COLLISION` counts are **operational metrics** — not a pre-launch architecture project. A second shared TFN is justified only by sustained collision data, not speculation.

---

## Quick test commands (post-deploy staging / CI)

```bash
npx tsx scripts/test-mctb-platform-sender-assignment.ts
npx tsx scripts/test-mctb-platform-sender-combined-cert.ts
npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
npx tsx scripts/test-telnyx-voice-tool-webhook-auth.ts
```

Run against an environment at the **same SHA** as production when validating a deploy.
