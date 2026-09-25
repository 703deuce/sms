# TRANSOVO PASS 1 — PRODUCT REVIEW + DESIGN-SYSTEM LOCK

**Status:** Approved with corrections (supersedes Pass 1 §35 verdict as written)  
**Audit source:** `docs/TRANSOVO-PASS-1-VISUAL-AUDIT-AND-DESIGN-SYSTEM-REPORT.md`  
**Master brief:** `docs/KIRSTEN-TRANSOVO-MASTER-VISUAL-AUDIT-AND-DESIGN-SYSTEM-SPEC.md`  
**Date:** 2026-09-25

Pass 1 visual audit is **substantially approved**. Do **not** redo the full audit.

This document locks visual direction, corrects the readiness verdict, and governs the **next** step: controlled shared-foundation + representative-page implementation (not full-product migration).

---

## Approved diagnosis (unchanged)

- Transovo contains multiple visual families.
- Newer MCTB operational and Setup surfaces are the strongest internal foundation.
- Voice operational surfaces are generally too large/card-heavy relative to desired density.
- Inbox preserves specialized three-pane workflow while adopting shared Transovo visual language.
- Shared tokens and primitives must precede page-by-page polishing.
- Fonio = restraint and progressive disclosure reference — **not** layout or architecture template.
- Frozen MCTB and Voice product architectures remain authoritative.

---

## 1. CORRECT THE READINESS VERDICT

### Genuine engineering defects (must fix and verify)

1. **AI Recovery** — `b.filter is not a function`
2. **Voice Analytics** — undefined `count`
3. **Voice route** — full-page load failure

### They block

- Final visual completion of the **affected** page
- Accurate state testing of the **affected** page
- Production visual certification of the **affected** page

### They do **not** block

- Shared tokens, typography, layout primitives, page headers, buttons, form primitives, status primitives, tables/lists, navigation hierarchy, loading/error/empty-state primitives, responsive foundations, migration of **unaffected** pages

**Corrected verdict:**

## READY FOR SHARED VISUAL-SYSTEM IMPLEMENTATION

**Parallel engineering track:** `PARALLEL ENGINEERING BLOCKERS FOR AFFECTED-PAGE COMPLETION`

Do not hide, mock, or visually work around those defects.

---

## 2. LOCK THE VISUAL DIRECTION

**Mature, calm, restrained, medium-density operational SaaS.**

Strongest internal references: MCTB Setup, MCTB Missed Calls, MCTB Analytics — **references, not immutable templates.**

Simpler without empty, oversized, decorative, or consumer-oriented UI. Use **hierarchy and progressive disclosure**; not whitespace alone.

---

## 3. DO NOT TURN FONIO INTO A NEW ARCHITECTURE

Fonio approved for: progressive disclosure, restrained surfaces, compact controls, focused secondary configuration, master/detail operational presentation, reduced first-paint complexity.

**Not** automatic approval to restructure workflows.

The following must **not** be implemented automatically:

- capability-list-left / detail-right
- drawers / modals / accordions for configuration (by default)
- tables → card lists (by default)
- new master/detail relationships

Before any interaction change, verify:

1. current workflow  
2. business behavior the component owns  
3. workflow change vs presentation-only  
4. genuine complexity reduction  
5. keyboard / mobile / a11y correctness  

**Progressive disclosure is a tool, not a mandate.**

---

## 4. PAGE ARCHITECTURE REMAINS FROZEN

**MCTB:** Overview · Missed Calls · Inbox · AI Recovery · Voicemail · Analytics · Setup  

**Voice:** Overview · Calls · Receptionist · Business Knowledge · Call Handling · Analytics  

Visual system adapts to workflows. Workflows do not adapt for implementation convenience.

---

## 5. DO NOT CREATE A SECOND COMPONENT LIBRARY

Names like `TransovoPageHeader`, `TransovoStatusBadge`, etc. describe **canonical responsibilities**, not mandatory new components.

Before creating a primitive:

1. inspect existing shared primitive  
2. identify every consumer  
3. extend safely if possible  
4. consolidate MCTB/RefDeco into existing primitive when safe  
5. new primitive only when consolidation is unsafe or semantically wrong  

**Audit → Preserve → Extend → Consolidate.**

---

## 6. TOKEN CONSOLIDATION — NO PARALLEL TOKEN SYSTEMS

`transovo-visual-tokens.css` is a **conceptual target**, not permission for another independent layer.

Inspect first: global theme, Tailwind theme, `mctb-design-tokens.css`, MCTB brand tokens, Kimi styles, RefDeco, Voice primitives.

**Converge** — do not end with global + MCTB + Kimi + Voice + new Transovo tokens all controlling UI independently.

---

## 7. PRIMARY ACTION COLOR

Do not make every primary button purple.

Establish semantic hierarchy: primary · secondary · tertiary/contextual · destructive — then one canonical treatment per role.

Purple remains **restrained**. Healthy operational pages must not become purple-heavy.

---

## 8. SURFACE DISCIPLINE

Do not translate every container into `TransovoSection`.

Use surfaces for: independent object, grouped configuration, selectable option, contextual summary, elevated interaction, operational grouping.

Prefer **page → section → content** over nested card stacks without semantic need.

---

## 9. HEALTHY STATE DISCIPLINE

Active, Ready, Verified, Configured, Connected, Managed → **quiet** confirmation.

Strong emphasis only for: Needs attention, Failed, Blocked, Compliance problem, Destructive, User action required.

No green badge walls for every successful configuration.

---

## 10. ERROR STATE REQUIREMENT

Ship a real customer-facing error primitive while engineering fixes runtime errors.

Support: page / section / partial / retryable / non-retryable / loading / empty / success.

Never show raw JS/runtime messages to customers. Do not suppress engineering logs/telemetry.

---

## 11. RESPONSIVE TABLES — DO NOT DEFAULT TO CARDS

Mobile card-list is **not** globally locked.

Per table choose: prioritized columns, stacked metadata, bounded horizontal scroll, expandable row, list presentation, mobile detail navigation — as appropriate.

---

## 12. TYPOGRAPHY — STARTING TOKENS

Approved starting point: 24px page title · 14px body · 15–16px section · 13px dense · 12px meta · compact metrics.

Validate on real pages. Adjust tokens deliberately, not per-page hacks.

---

## 13. CUSTOMER LANGUAGE — APPROVED

Replace ordinary-customer exposure of: production ingress, workspace routing, authoritative request form, live system compiles, PLATFORM, WORKSPACE, Telnyx, Twilio (when product concept suffices). Preserve compliance copy unless separately approved.

---

## 14. NUMBER IDENTITIES — STRICT

1. Customer business DID  
2. Transovo MCTB voice-ingress DID  
3. Transovo platform SMS sender DID  

Label the **role** displayed. Binding mismatch = functional defect — trace first failing boundary before changing binding.

---

## 15. INBOX — THREE DIMENSIONS

Operational state · Automation ownership · Messaging capability — **separate** badges/labels. Human takeover ≠ free-form messaging.

---

## 16. FUNCTIONAL DEFECTS — PARALLEL TRACK (TRACE FIRST)

### AI Recovery

Trace `b.filter is not a function` to **first incorrect boundary**. Do not add `Array.isArray()` on the client unless the API contract proves the client is wrong. Check persistence, serialization, contract, normalization, parsing, component assumption.

### Voice Analytics

Trace missing/undefined count to **authoritative analytics contract**. Do not zero-fill if backend should supply the object. Defensive rendering only after contract is correct (including legitimate partial states).

### Voice route failure

Identify exact route and first failing data boundary. Generic error boundary is not the root cause.

These fixes **may proceed in parallel** with shared visual-system work. Affected pages are not visually certified until runtime is healthy.

---

## 17. IMPLEMENTATION ORDER

### Phase 0 — Baseline

Routes, screenshots, component consumers, token consumers, protected behavior in UI, rollback point.

### Phase 1 — Shared foundation

Consolidate: tokens, layout, typography, headers, buttons, forms, status, tables/lists, tabs/nav, states, modal/drawer patterns, responsive primitives. **Review primitives together before broad migration.**

### Phase 2 — Reference-family proof (required gate)

One page each: MCTB operational · MCTB Setup · Voice operational · Voice configuration · Inbox shell. Screenshots side-by-side. **Do not migrate entire app until proof approved.**

### Phase 3 — Product-family migration

MCTB operational → MCTB Setup → Inbox → Voice operational → Voice configuration.

### Phase 4 — Page-specific refinement

Progressive disclosure and special layouts **only** where genuinely beneficial, after shared migration.

### Phase 5 — Certification

Breakpoints, a11y, states, entitlements (free/paid, PLATFORM/A2P, disabled capabilities).

---

## 18. FIRST IMPLEMENTATION PASS — CONTROLLED

Create/consolidate foundation + prove on representative pages only.

**Return:**

1. files changed  
2. primitives created/extended/consolidated  
3. old primitives targeted for retirement  
4. token consolidation performed  
5. representative pages migrated  
6. before/after screenshots  
7. behavior preserved  
8. responsive checked  
9. accessibility checked  
10. remaining visual-system questions  
11. functional defects encountered  
12. pages intentionally not migrated  

Do not auto-proceed to full-product migration if proof exposes weakness.

---

## DESIGN-SYSTEM DECISION

**Pass 1 visual direction: APPROVED WITH THE CORRECTIONS ABOVE.**

**Readiness:** **READY FOR SHARED VISUAL-SYSTEM IMPLEMENTATION**  
**Parallel:** **PARALLEL ENGINEERING BLOCKERS FOR AFFECTED-PAGE COMPLETION**

**Next deliverable:** Pass 2 controlled implementation output per §18 — not another full design document.
