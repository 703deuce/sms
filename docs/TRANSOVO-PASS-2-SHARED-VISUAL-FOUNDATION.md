# TRANSOVO PASS 2 — SHARED VISUAL FOUNDATION + REPRESENTATIVE PROOF

**Mode:** CONTROLLED IMPLEMENTATION  
**Authority (order):**

1. `docs/TRANSOVO-PASS-1-PRODUCT-REVIEW-AND-DESIGN-SYSTEM-LOCK.md`
2. `docs/TRANSOVO-PASS-1-VISUAL-AUDIT-AND-DESIGN-SYSTEM-REPORT.md`
3. `docs/KIRSTEN-TRANSOVO-MASTER-VISUAL-AUDIT-AND-DESIGN-SYSTEM-SPEC.md`

**Objective:** Implement and prove the shared Transovo visual system on five representative pages only. **Not** full-product migration.

**Stop gate:** After Phase 0–2 + evidence → **STOP** (no Phase 3).

**Success phrase:** `SHARED VISUAL FOUNDATION IMPLEMENTED — REPRESENTATIVE PROOF READY FOR PRODUCT REVIEW`

---

See product lock §17–18 and Pass 1 report for full constraints. This document is the executable Pass 2 scope (Phases 0–2 only).

## Scope summary

| Phase | Work |
|-------|------|
| **0** | Baseline: foundations, consumers, five proof routes, rollback commit |
| **1** | Converge tokens + primitives (extend existing; create only when necessary) |
| **2** | Migrate: Missed Calls, Consent, Voice Calls, Receptionist, Inbox shell |

## Representative proof set

| Family | Route | Primary surface |
|--------|-------|-----------------|
| MCTB operational | `/mctb/missed-calls` | `missed-calls-view` |
| MCTB Setup | `/mctb/setup/consent` | `setup-consent-view` |
| Voice operational | `/voice/calls` | Voice calls list |
| Voice configuration | `/voice/receptionist` | `voice-receptionist-editor` |
| Shared messaging | `/conversations` | Inbox connected shell |

## Handoff

Deliverable: `docs/TRANSOVO-PASS-2-IMPLEMENTATION-REPORT.md` (sections A–I per lock).

Evidence: `/opt/cursor/artifacts/screenshots/pass-2-visual-proof/` (before/after).
