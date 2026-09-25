# Voice V3 — End-to-end product completion pass (operator brief)

**Purpose:** Give this to Cursor **before** any navigation / dedicated Transfers page work.

**Order of operations:**

1. **Pass 1 — Product completeness** (this document): audit every orange/partial item; make capabilities end-to-end (config → persistence → API → runtime → result UI). Items awaiting PSTN only → **CERTIFICATION ONLY**. Do **not** reorganize nav.
2. **Pass 2 — Product surface architecture:** After everything exists, decide what leaves the wizard (e.g. Transfers / on-call).
3. **Pass 3 — Certification:** PSTN matrix on the **finished** product.

---

## Objective

Before reorganizing Voice V3 UI or creating dedicated pages, complete the AI After-Hours Receptionist **end-to-end**.

- NOT an architecture rewrite.
- NOT permission to replace working Voice V3 runtime.
- NOT navigation redesign yet.

**Done means:** configuration → persistence → API → runtime → resulting state → customer-visible management/result UI.

**CERTIFICATION ONLY:** fully implemented; only live PSTN/provider proof missing.

---

## 0. Protected architecture

Preserve: Telnyx PSTN → LiveKit SIP → Python worker → AgentSession → GPT-Live → delegated Responses → FunctionTools → V3 tool client → backend.

Do NOT: second websocket engine, subagents, new booking/transfer/post-call architecture, MCTB PlatformSenderAssignment in Voice routing.

Preserve Microsoft FIND/BOOK known-good baseline.

---

## 1. Source of truth

Reconcile code against post-reconciliation docs, transfer cert, call-history cert, wizard, APIs, runtime, customer pages. Verify audit hypotheses from source.

---

## 2. Define “done”

Trace 13 layers per capability. Classify: COMPLETE | CERTIFICATION ONLY | PARTIAL (backend/runtime | UI | both) | INTENTIONALLY OUT OF SCOPE.

---

## 3. Complete partial surfaces

A. Knowledge gaps — owner workflow (see report).  
B. Voice analytics — real Voice UI, not MCTB redirect; no fake after-hours stub.  
C. Call reasons — derive from existing post-call/outcomes.  
D. Needs attention — unified owner view.  
E. Recording path — fix breaks only; else CERTIFICATION ONLY.  
F. Post-call summary/email — config UI matches runtime.  
G. Digest — product truth (generic infra vs Voice feature).  
H. Transfer/on-call — complete chain; **document** future dedicated page controls; **do not** build that page in Pass 1.

---

## 4–13. Scheduling, spam, knowledge setup, notifications, call history, self-serve, tenant isolation, cert vs implementation, out of scope — see full operator message in repo history / Pass 1 report.

---

## 14–17. Required outputs

- Feature completion matrix (every launch capability).  
- UI surface inventory + “too buried for final product” list (no moves yet).  
- Remaining certification matrix.  
- Final verdict block.

---

## UI rule for transfers

Do **not** create the final **Call Handling / Transfers** page in Pass 1. Document controls the later page will need. Wizard may remain the configuration entry point during Pass 1.
