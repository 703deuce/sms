# AI Lead Recovery — final completion boundary

**Status:** Active — defines what work is allowed before ship  
**Architecture:** **LOCKED** — experience finish + live validation only

---

## Do not reopen

- Intent architecture
- Policy architecture
- Action registry architecture
- Booking orchestration
- Provider adapters
- Stripe payment architecture
- Microsoft / Calendly rulebooks

## Allowed backend work (only if required for approved product UI / guardrails)

These items are **in service of the approved page and guardrails**, not an invitation to redesign the model:

| # | Area | Purpose | Code status (app) |
|---|------|---------|-------------------|
| 1 | Simulation API | Test AI drawer + draft policy | **Done** — `POST /api/mctb/lead-recovery/simulate` |
| 2 | John policy hard guard | Legacy fallback cannot bypass LR policy | **Done** — `john-policy-guard.ts` (not LR runtime) |
| 3 | Canonical config / schema | Same schema for UI + runtime | **Done** — `customFieldsConfig.mctb.leadRecovery` |
| 4 | Provider readiness reads | Readiness rail + provider rows | **Done** — config GET + capability-gated UI |
| 5 | Validation for UI | Policy health from backend | **Done** — `computeLeadRecoveryPolicyHealth` |
| 6 | Domain events / activity | Human-readable simulation activity | **Done** — simulation + domain-events |

**No new abstraction layer** unless a **failing test** proves one is necessary.

---

## Locked product ownership

| Surface | Owns |
|---------|------|
| **Integrations** | Connect / disconnect / manage provider accounts (OAuth) |
| **AI Lead Recovery** | Enabled intents/scenarios, collect fields, allowed actions, provider **targets** (not OAuth), fallback, business policy |

**Do not recreate:**

- Booking Setup product page
- Calendar Setup
- Appointment Settings
- Provider OAuth inside AI Lead Recovery

**Integrations = connect accounts.**  
**AI Lead Recovery = policy, targets, and when connections are used.**

Capability model: `docs/runtime-rules/AI-LEAD-RECOVERY-CAPABILITY-MODEL.md`

---

## Remaining work (completion checklist)

### A. AI Lead Recovery UI

| Requirement | Status |
|-------------|--------|
| `/mctb/ai-lead-recovery` | **Done** |
| Progressive scenario controls | **Done** |
| Full policy panels (enabled scenarios only) | **Done** |
| Structured Test AI drawer | **Done** |
| Draft simulation | **Done** |
| Readiness / policy health rail | **Done** |
| Provider readiness rows (capability-gated) | **Done** |
| Overview summary card | **Done** |
| Mobile / tablet / desktop polish | **Verify in screenshot QA** |

### B. John hard guard

| Requirement | Status |
|-------------|--------|
| John = fallback only (after LR in `customer-sms.ts`) | **Done** |
| Actions via Policy → Registry → Runtime | **Done** (LR path) |
| Guard blocks book / pay / price / availability / opt-out bypass | **Done** — `test-mctb-lead-recovery-legacy-john-fallback-guard.ts` |

### C. Simulation

| Requirement | Status |
|-------------|--------|
| Primary + secondary intents, urgency, collect, policy, plan, blocked, providers, customer response | **Done** — structured UI |
| No live mutation (SMS, email, book, Stripe, callbacks) | **Done** |

### D. Payments polish (user-facing only)

| Requirement | Status |
|-------------|--------|
| Refund from payment detail where supported | **Open** |
| Accurate invoice status wording | **Open** |
| Missing confirmation / error states | **Open** |

Do **not** redesign payment architecture.

### E. Live validation (environment-dependent)

After migrations and real connections:

- Microsoft scheduling integration (not Calendar product UI)
- Calendly scheduling integration
- Stripe Connect + webhooks
- MCTB SMS runtime

Separate **environment failures** from **code defects** in reports.

### F. Screenshot QA (deployed authenticated MCTB shell)

Capture:

- Overview (+ AI Lead Recovery card)
- AI Lead Recovery default
- AI Lead Recovery with ≥3 policies enabled
- Provider blocked state
- Test AI drawer
- Payments request + invoice mode
- Mobile width

Verify:

- Universal MCTB sidebar + header + padding
- MCTB blue identity (no old purple scheduler shell)
- No SMS platform shell
- No hidden Booking Setup path

---

## Final stop conditions

| Condition | Target |
|-----------|--------|
| `ARCHITECTURE_REOPENED` | **NO** |
| `HIDDEN_BOOKING_SETUP_PATH` | **NO** |
| `INTEGRATIONS_OWNS_CONNECTIONS` | **YES** |
| `AI_LEAD_RECOVERY_OWNS_POLICY` | **YES** |
| `JOHN_POLICY_BYPASS` | **0** (guarded fallback) |
| `SIMULATION_HAS_SIDE_EFFECTS` | **0** |
| `UI_PLACEHOLDERS` | **0** |
| `BROKEN` | **0** |
| `NO_OP` | **0** |

**STOP** after: UI verification + guards + **live validation** + **screenshot QA**.

---

## Canonical cross-links

- Product status: `docs/MCTB-PRODUCT-IMPLEMENTATION-STATUS.md`
- Implementation detail (AI Booking runtime): `docs/MCTB-AI-BOOKING-IMPLEMENTATION-STATUS.md`
