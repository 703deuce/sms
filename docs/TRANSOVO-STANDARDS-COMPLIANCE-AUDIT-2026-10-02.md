# Transovo Standards Compliance Audit — Guides #1–#11

**Date:** 2026-10-02  
**Scope:** How the current application compares to Transovo formal standards Guides #1–#11 (not governance, UI design guide, page architecture, or visual design as separate layers).  
**Method:** Automated proofs where available (`test-transovo-multi-tenant-isolation-fixture.ts`, MCTB commercial guards, stage-2 presentation, consolidated matrix 61/61 on recent master), plus targeted code review (MCTB production UI under `src/components/mctb/**`, APIs, nav config).

**Overall:** **MCTB backend + tenancy + consent/runtime** align well with Guides **#5, #8, #9**. **Customer MCTB UI (Opus)** is in reasonable shape on **#7** (semantic tables) and presentation boundaries. **Weakest areas app-wide:** **#1 / #4** (no CI accessibility gate; focus/outline debt in shared UI primitives and Kimi CSS), **#11** (no i18n layer on MCTB), **#3** (launch nav vs canonical MCTB IA map), and **#2 / #6** (mostly judgment + spot checks, not automated).

---

## Guide #1 — Accessibility (WCAG 2.2 AA)

| Verdict | **Partial** |

**Aligned**

- MCTB operational surfaces use semantic structure in places that matter (e.g. missed calls list uses `<table>`, filter regions use `role="search"` / `role="dialog"` with `aria-label` in `missed-calls-view.tsx`).
- Setup views use labels / `htmlFor` in many fields (consent, recovery, exclusions, phone).

**Gaps**

- **No `eslint-plugin-jsx-a11y` or axe in `package.json`** — accessibility is not enforced on every PR.
- **`outline-none` / `outline: none`** appears widely in design-system primitives (`newui2/components/ui/*`, Kimi CSS under `src/styles/kimi/*`, some transplant components). Guide #4 requires a visible replacement; blanket `outline-none` on primitives is a **systemic risk**.
- **`prefers-reduced-motion`** exists mainly on Kimi/reference CSS, not consistently on core MCTB Opus CSS.
- Production browser cert still records issues like **React #418** on analytics and notifications UI/harness rows — worth retesting on current deploy, not proof of full AA.

**Comparison:** Intent and some surfaces match the guide; **product-wide AA conformance is not certified**.

---

## Guide #2 — Human-centered design

| Verdict | **Partial (MCTB strong; legacy/mixed elsewhere)** |

**Aligned**

- MCTB rebuild follows task flow (missed call → text → conversation → setup), with real states (empty, error, suppressed vs failed) backed by APIs and tests.
- Onboarding wizard separates Press-1 vs existing consent; no “skip consent” labeling in canonical copy.

**Gaps**

- **Dual UI families** still documented (`TRANSOVO-PASS-1-*`, `newui/` sandboxes, Kimi mass-texting shells) — cognitive load and workflow consistency vary by product.
- Launch nav exposes many configure items as top-level peers (“Missed-Call Recovery”, “Text Back”, “AI Recovery”, …) instead of one grouped **Setup** mental model from the MCTB IA map (see #3).
- Pass 1 still lists **engineering blockers** on non-MCTB pages (AI Recovery filter bug, voice analytics, etc.) — those violate “visible UI reflects runtime” on affected routes.

---

## Guide #3 — IA & navigation

| Verdict | **Partial** |

**Aligned**

- Canonical **routes** exist under `/mctb/*` (`src/lib/mctb/routes.ts`).
- Product shell uses **`buildMctbV1Nav`** with Overview, Missed Calls, Conversations, Voicemail, Analytics.
- Legacy `/voice/*` still has redirect/migration story; MCTB page specs are the target IA.

**Gaps**

- **`buildMctbV1Nav`** adds **Getting Started**, splits setup across **Missed-Call Recovery / Text Back / AI Recovery / Notifications / Phone** instead of the locked spec nav: *Home | Missed Calls | Conversations | Voicemail | Analytics* + *Configure: Setup | Numbers | Settings*.
- **`buildVoiceNav` / `buildMctbShellNav`** still center **legacy** `/voice/missed-calls`, Consent Log, Schedule, etc. when not on V1-focused nav — duplicate homes until migration finishes.
- **`test-transovo-platform.ts` fails** because it expects deprecated `buildVoiceNav` to include **Conversations → `/conversations`**; current `buildMctbShellNav` doesn’t match that contract (stale test, but signals **nav source-of-truth drift**).

---

## Guide #4 — Interaction, keyboard & focus

| Verdict | **Partial** |

**Aligned**

- MCTB filters/menus use dialog/menu patterns with some ARIA naming.
- Modal/drawer patterns exist in shared UI (transplant `dialog.tsx`, etc.).

**Gaps**

- Shared **button/input/tabs** primitives often use **`outline-none`** without documenting focus-visible substitutes in every variant.
- No repo-wide keyboard walkthrough or automated tab-order tests.
- Browser cert **exercise matrix** had many **link click timeouts** (harness + dense nav) — keyboard users may hit similar overflow/hidden-link issues on smaller viewports.

---

## Guide #5 — Forms, input & validation

| Verdict | **Strong on MCTB APIs; Partial on UI breadth** |

**Aligned**

- MCTB **POST bodies validated server-side** (setup, consent attestation, handoff recipients, exclusions) with dedicated scripts in commercial guards — **PASS**.
- Consent attestation not prechecked in setup consent UI (grep found no problematic `defaultChecked` on consent paths).

**Gaps**

- Many **Kimi-connected** mass-texting/campaign shells need separate glue audits (`MASS_TEXTING_GLUE_FLOWS.md`) — not re-run in this pass.
- Placeholders are common on MCTB inputs (search, links, notifications); guide wants **visible labels**, not placeholder-only — needs field-by-field review (setup sections are better than search bars).

---

## Guide #6 — Responsive, reflow & zoom

| Verdict | **Partial** |

**Aligned**

- MCTB missed calls implements **mobile sheet / toolbar** patterns alongside desktop table.
- MCTB mobile scroll work exists in product history (separate PR thread).

**Gaps**

- No automated viewport/zoom suite in CI for Guide #6.
- Kimi and legacy CSS may still assume fixed widths in places (`src/styles/kimi/*`).

---

## Guide #7 — Table & grid semantics

| Verdict | **Good on canonical MCTB; mixed in Kimi/legacy** |

**Aligned**

- **No `role="grid"` / `aria-grid`** in MCTB components (grep clean).
- Missed calls, analytics, exclusions, consent history use **`<table>`** in production MCTB paths.

**Gaps**

- Inbox/campaigns Kimi UIs may use custom list/grid layouts — not audited line-by-line in this pass.
- `TRANSOVO-GLOBAL-DATA-TABLE-STANDARD.md` is separate; not all lists use one shared table primitive yet.

---

## Guide #8 — Privacy, consent & compliance

| Verdict | **Strong for MCTB** |

**Aligned**

- **`press_1` vs `existing_consent`** preserved; attestation and platform template enforcement tested.
- Consent log, STOP/suppression, eligibility — covered by MCTB engine/guard scripts.
- UI separates sender registration vs recipient consent in setup copy (per specs).

**Gaps**

- Full **consent log UI** and cross-product SMS marketing boundaries rely on not mixing MCTB with mass-texting pipelines (boundary test exists: `test-mass-texting-boundary.ts` — not re-run in this pass).

---

## Guide #9 — Security & authentication

| Verdict | **Strong (application tenancy); ops hardening separate** |

**Aligned**

- **`test-transovo-multi-tenant-isolation-fixture.ts` — PASS** (A/B read/write, phone isolation, conversations, voice tool binding, `ws_1` fallback, etc.).
- **MCTB APIs** use session + `getActiveWorkspaceId()` / `requireSession()`; no trusting raw `body.workspaceId` for tenant on MCTB routes.
- **`resolveWorkspaceId(session, body.workspaceId)`** on some shared APIs (SMS, integrations) is **by design** with membership check — Guide #9 allows workspace switching for members, not anonymous override.

**Gaps**

- A few **voice/dev** routes accept `body.workspaceId` with env fallbacks (e.g. qualification test) — should stay non-production only.
- Production **rate limits / worker SHA parity** are ops concerns, not Guide #9 doc violations per se.

---

## Guide #10 — Date, time, timezone & locale

| Verdict | **Strong in MCTB domain logic; Partial in UI** |

**Aligned**

- MCTB lib uses **IANA workspace timezone** helpers (`workspace-timezone.ts`, AI booking timezone modules).
- Analytics range tests exist (`test-mctb-analytics-range.ts`).

**Gaps**

- Customer UI still often shows **US-style relative times** without a single documented formatter everywhere.
- Appointments/scheduling has its own datetime stack — not fully cross-checked against Guide #10 in this pass.

---

## Guide #11 — Internationalization & localization

| Verdict | **Weak (expected for current V1)** |

**Aligned**

- Guide defines architecture; product is **English-first** by explicit V1 scope.

**Gaps**

- **No `useTranslations` / next-intl** under `src/components/mctb/**` — essentially all user-facing strings are hardcoded English.
- Layout may not be stress-tested for **German-length labels** on every surface.

This is the largest **documented standard vs app** gap if you treat Guide #11 as mandatory for launch rather than “architecture ready.”

---

## Summary scorecard

| Guide | Topic | vs app today |
|------|--------|----------------|
| **1** | Accessibility | **Partial** — good pockets; no CI gate; focus/outline debt |
| **2** | Human-centered design | **Partial** — MCTB coherent; multi-shell product |
| **3** | IA & navigation | **Partial** — `/mctb` routes good; launch nav ≠ spec map |
| **4** | Keyboard & focus | **Partial** — primitives + manual gaps |
| **5** | Forms & validation | **Strong (MCTB backend)** / **Partial (all UI)** |
| **6** | Responsive & zoom | **Partial** — patterns exist; limited proof |
| **7** | Tables & grids | **Strong (MCTB)** / **Mixed (Kimi)** |
| **8** | Privacy & consent | **Strong (MCTB)** |
| **9** | Security & auth | **Strong (tenancy + MCTB APIs)** |
| **10** | Date/time/timezone | **Strong (MCTB lib)** / **Partial (all UI)** |
| **11** | i18n | **Weak** — English hardcoded |

---

## Suggested follow-ups (optional)

1. **Add automated a11y** — eslint-jsx-a11y + Playwright axe on a fixed route list (MCTB setup + missed calls + conversations).
2. **IA alignment pass** — reshape `buildMctbV1Nav` toward spec **Setup | Numbers** grouping; finish legacy `/voice/*` redirects and retire duplicate nav builders.
3. **Focus tokens** — audit `outline-none` in `src/newui-transplant/components/ui` and Kimi primitives; enforce `:focus-visible` ring from visual design tokens.
4. **i18n** — either document **“English-only V1 exception”** in governance or start `next-intl` on MCTB shell strings first.
5. **Fix stale `test-transovo-platform.ts`** so nav contracts match `buildMctbV1Nav` / product shell.

---

## Commands used (reference)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
npm run verify:mctb-stage2-presentation
bash scripts/run-mctb-commercial-launch-guards.sh
bash scripts/run-mctb-consolidated-nonhuman-matrix.sh
```

---

## Source guides (Guides #1–#11)

1. `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
2. `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
3. `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
4. `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
5. `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
6. `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
7. `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
8. `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
9. `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
10. `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
11. `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

Governance (read first for authority order): `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
