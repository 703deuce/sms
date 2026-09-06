# Transovo Full UI Rebuild — Kimi Mode 4 Orchestration

**Status:** Active — master implementation instruction for Cursor  
**Audience:** Cursor (orchestrator), Kimi (UI implementer)  
**Allowlist:** `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`  
**Governance:** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`

---

## Mission

Transovo's existing customer-facing application UI is being **fully rebuilt from scratch** using Kimi Mode 4.

This is **not** an incremental cleanup of the current UI.  
This is **not** a general repo-wide redesign.  
This is a **controlled replacement** of the exact approved Transovo customer-facing pages, subpages, screens, tabs, drawers, wizards, configuration flows, and reachable product surfaces in the **approved page inventory**.

The rebuilt Kimi pages become the **actual production application UI**.

The existing application remains authoritative for:

- functionality, routes, backend contracts, data, feature inventory, states
- API wiring, domain behavior, permissions, runtime requirements

Its **current visual design is not authoritative**.

---

## 1. Cursor's role

Cursor is the **orchestrator and backend/integration authority**.  
Cursor is **NOT** the UI designer for this operation.

**Cursor must:**

- locate and load the complete approved Transovo UX/design standards
- locate the approved page inventory (`TRANSOVO-MODE-4-REBUILD-MANIFEST.md`)
- locate existing implementation for each approved page
- identify functionality that must survive
- prepare context Kimi needs (Page Contract + standards pack)
- invoke Kimi Mode 4 (`npm run ui:kimi-mode4`)
- dispatch pages in concurrent batches (max 10, 5s stagger)
- preserve route/backend/domain contracts
- statically review Kimi output structurally
- ensure required features were not omitted / no out-of-scope features added
- ensure resulting pages are actually used by the application
- wire/fix backend behavior where needed **after** UI rebuild

**Cursor must not manually redesign these pages itself.**

---

## 2. Hard Cursor execution restriction

**Cursor must NEVER run:**

- production builds, dev servers, local servers, browsers, screenshots
- Playwright, Puppeteer, Cypress, Docker builds
- memory-heavy tests, visual verification, production compilation

**Cursor may only:**

- code/file inspection, static reasoning, lightweight type checks when safe
- wiring/route/dependency/diff inspection

Cursor must **not** launch the app merely to see whether Kimi's UI looks right. **Kimi performs UI generation.** Cursor coordinates it.

---

## 3. Kimi must receive ALL Transovo rules

Kimi Mode 4 must receive the **complete governing Transovo system** — not summaries.

**Preflight (mandatory):** `npm run ui:kimi-mode4-preflight -- --write-report`  
Must return **OVERALL: PASS** before any Kimi generation. Verifies:
- full document bytes (no truncation)
- manifest + feature coverage
- **scope consistency** (no stale MCTB/mass-SMS instructions in active payload)

**Minimum bundle** (see `scripts/ui-agent/mode4-standards-pack.ts` — 23 document slots, ~712K chars full content):

| Layer | Document |
|-------|----------|
| Layer | Document |
|-------|----------|
| **Mode 4 active scope** | `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md` |
| Product scope / domain | `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` (appointments sections; ignore OUT OF MODE 4) · `docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md` |
| Page inventory | `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md` |
| Governance | `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` |
| IA & terminology | `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` |
| HCD | `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` |
| Page architecture | `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md` |
| Visual system | `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md` |
| Product experience | `docs/TRANSOVO-UI-DESIGN-GUIDE.md` |
| Standards #1–#11 | All `docs/TRANSOVO-*-STANDARDS.md` formal guides |

Do not summarize these away before giving them to Kimi.

---

## 4. Standards are the Bible

**Kimi authority order:**

1. Approved Transovo product scope and domain architecture  
2. Approved feature/page inventory  
3. Transovo Product Design & UX Governance  
4. Canonical IA and terminology  
5. Human-Centered Design principles  
6. Page Architecture  
7. Visual Design System  
8. Shared Component System  
9. All applicable formal standards guides  
10. Existing Transovo runtime/functionality requirements  
11. Campaign and Inbox visual-reference videos  
12. Existing page appearance  

Lower authority **never** overrides higher authority.

---

## 5. Campaign and Inbox videos — visual art direction

Reference videos in `.ui-agent/references.json`:

| Video | Route key | Use |
|-------|-----------|-----|
| `Sending Mass Texts in SlickText...` | `/campaigns` | Default polish / density / hierarchy |
| `Navigating the SlickText Inbox...` | `/conversations` | Messages polish |

They establish: polish, rhythm, typography, spacing, density, navigation refinement, surfaces, borders, component finish, table/list treatment, premium SaaS feel.

**Art direction only** — never copy unrelated features, competitor terminology/navigation, or conflicting architecture.

> Achieve this visual quality while designing Transovo according to Transovo's own product architecture and standards.

---

## 6. Mode 4 derives from Mode 1

Mode 4 = Mode 1's full-page recreation (`npm run ui:kimi` / `runKimiCommand`) **plus** complete standards + art direction + strict product constraints.

Preserve Mode 1 strengths: page ingestion, code awareness, reconstruction, file editing, asset handling, route awareness, completion passes.

Implementation: `scripts/ui-agent/kimi-mode4-batch.ts` calls `runKimiCommand` with `KIMI_MODE4_SYSTEM_PREFIX` + Page Contract + standards pack.

---

## 7. Kimi Mode 4 permanent instruction

```
MODE 4 — TRANSOVO PREMIUM PRODUCTION REBUILD

Rebuild an actual production Transovo SaaS screen — not a mockup or polish pass.
Result replaces the current customer-facing screen as canonical UI.

Preserve: functionality, backend contracts, domain behavior, data, permissions, states, actions, feature coverage.
Standards library is mandatory. Existing visuals are not authoritative.
Campaign/Inbox videos = art direction only.

Professional, calm, precise, modern, premium, medium-density operational SaaS.
Do not simplify to sparse cards or landing-page layouts.
Design at macro, component, and micro levels.
```

Full text: `KIMI_MODE4_SYSTEM_PREFIX` in `scripts/ui-agent/config.ts`.

---

## 8. Kimi works on actual production pages

Mode 4 output is **not** left in `/concepts`, `/mockups`, or disconnected prototypes.

Flow:

1. Kimi generates in `.ui-agent/generated/<session>/` (Mode 1 pipeline)  
2. Cursor integrates into **actual route components** (`src/app/`, `src/components/`)  
3. Kimi version becomes **canonical** — no unused pretty copy  

---

## 9. Only approved inventory may be rebuilt

**Hard rule:** If a page is not in `TRANSOVO-MODE-4-REBUILD-MANIFEST.md`, Mode 4 must not redesign it because code exists.

---

## 10. Inventory must be exhaustive

Include every customer-facing reachable surface: tabs, detail views, create/edit, drawers, wizards, setup flows, empty states, public booking, meaningful dialogs.

---

## 11. Approved global IA

Home · Appointments · Booking · Contacts · Messages · Automations · Meetings · Payments · Analytics · Integrations · Settings

(`src/lib/products/appointments-nav.ts`)

---

## 12. Page Contract (required before each Kimi job)

Cursor derives a **Page Contract** from existing code + feature inventory:

```bash
npm run ui:kimi-mode4-contract -- --id appointments-calendar
```

Output: `.ui-agent/mode4/contracts/<id>.md`

Includes: primary job, required features, states, backend contracts, actions, terminology, standards, file ownership.

---

## 13–15. Feature preservation rules

- **Preserve** approved functionality — compare feature inventory vs Mode 4 output  
- **Reposition** features per governance when old placement was wrong  
- **Do not preserve** obsolete UI not in approved inventory  

---

## 16. Feature-to-page matrix

See `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md` § Feature matrix.

Build this **before** dispatching Kimi.

---

## 17. Rebuild manifest

Machine-readable: `.ui-agent/mode4/rebuild-manifest.json`  
Human-readable: `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`

Do **not** use route discovery alone as the manifest.

---

## 18–21. Foundations & golden screens

**Stage D — Foundations (serial):** tokens, shell, sidebar, header, shared components.  
Run `npm run ui:kimi-sidebar` before bulk jobs. **No concurrent writes** to shared files.

**Stage E — Golden screens:**

1. Home  
2. Appointments → Calendar  
3. Appointments → List  
4. Appointment Detail  
5. Booking Type editor  
6. Workflow Builder  

Golden screens establish Transovo visual language for subsequent jobs. **Standards remain higher authority** than golden screens.

---

## 22–26. Concurrency

```
MAX_CONCURRENT_KIMI_MODE4_JOBS = 10
KIMI_MODE4_STAGGER_MS = 5000
```

- Queue with replenishment as slots free  
- Do not terminate jobs for exceeding ~2 minutes  
- **Never** run concurrent jobs that modify the same shared file  

```bash
npm run ui:kimi-mode4 -- --stage bulk --concurrency 10 --stagger-ms 5000
```

---

## 27–29. File ownership & shared components

Each job lists: primary files, shared consume, shared forbidden.

If shared components need improvement → controlled foundation task → then page jobs consume updates.

**Reuse** canonical components — no private imitations.

---

## 30–32. Backend integration

Preserve: API hooks, route params, mutations, subscriptions, handlers, permissions, domain IDs, loading/error sources.

Kimi may refactor front-end structure but must maintain behavior mapping. **No fake functionality.**

---

## 33–36. States & premium definition

Implement: normal, loading, empty, no-results, error, degraded, success, permission/read-only.

Premium ≠ empty. Premium ≠ decorative gradients/glass/clutter.

---

## 37–42. One visual system

No unrelated product aesthetics per page. Shared shell on all authenticated pages. Shared state appearance (badges, empty tables, errors).

---

## 43–46. Permissions, compliance, datetime, accessibility

Use real authorization and SMS eligibility states. Use canonical temporal utilities. Accessibility is non-negotiable.

---

## 47–49. Acceptance & retries

After each batch, Cursor **statically** verifies: correct route changed, features preserved, no out-of-scope additions, hooks preserved, no placeholders.

Per-page completion record in `.ui-agent/mode4/batch-state.json`.

Failed jobs: retry individually with original contract + failure reason.

---

## 50–52. Refinement passes

**Three distinct Kimi modes — do not mix them:**

| Mode | Command | Purpose |
|------|---------|---------|
| **Mode 4 Generate** | `npm run ui:kimi-mode4` | First-pass screen from reference video + full standards |
| **Mode 4 Completion & Polish** | `npm run ui:kimi-mode4-completion` | **Gap-fill repass** on existing draft — adds missing subflows/states/modals; no full regen |
| **Mode 3 Polish** | `npm run ui:kimi-batch-polish` | Production in-place polish (post-integration only) |

**Mode 4 Completion & Polish** is a separate dedicated mode. It must NOT create the first-pass screen and must NOT wire backend.

**Surface-agnostic:** each run requires `--only <manifestId>`. Run one surface at a time. Golden batch ordering is orchestration config only: `.ui-agent/mode4/golden-completion-order.json`.

**Inputs per job (standard):**
- Existing draft code (`src/kimi-drafts/<route>/<sessionId>/`)
- **Latest rendered screenshot** (`CURRENT_RENDERED_DRAFT`) — auto-captured before each pass unless capture fails or `--skip-screenshot`
- Full Page Contract + standards pack + atomic features (same authority as first-pass)
- Audit gap hints (`mode4-golden-gaps.ts` or `--gaps-file`) — **non-exhaustive**
- Fresh requirement comparison mandated on every pass

**Work hierarchy:** Preserve → Complete → Correct → Polish (never redesign for taste).

**Stopping condition:** Stop when all required UI is represented, no dead ends, required states exist, responsive behavior defined, and further work would be subjective redesign.

**Completion does not self-audit.** Blueprint Audit runs independently afterward.

Mode 3 (generic production polish) remains optional. **Mode 4 Generate + Completion** is the default for this rebuild.

---

## 53. Rebuild order

| Stage | Action |
|-------|--------|
| A | Load approved page inventory |
| B | Load all governing docs |
| C | Map features → canonical pages |
| D | Foundations (serial) |
| E | Golden screens (first-pass Mode 4 generate) |
| F | **Blueprint completeness audit** (UI subflows/states — not backend) |
| G | **Golden gap-fill** (`ui:kimi-mode4-completion` on 6 authority screens) |
| H | Re-audit golden screens — lock as visual authority |
| I | Bulk Mode 4 generate (≤10 concurrent) |
| J | Static completeness review per page |
| K | Targeted completion passes on bulk surfaces as needed |
| L | Cursor backend integration review |

---

## 54–58. Implementation principles

- Feature mapping **before** Kimi touches pages  
- Do not progressively polish old UI — rebuild directly  
- Preserve backend/domain engines — no parallel frontend recreation  
- Same features, better architecture  

---

## 59–62. Final audits

- **Route coverage:** manifest vs completed pages  
- **Feature coverage:** inventory vs canonical pages  
- **Duplicate-pattern audit:** consolidate duplicate Sidebars, Buttons, modals  
- **Legacy routing check:** nav must point to new Mode 4 UI  

---

## 63. Final outcome

One canonical shell, visual language, page architecture, component system, terminology, IA, domain engines — every approved page rebuilt, every approved feature represented, every real action connected.

---

## Tooling reference

| Command | Purpose |
|---------|---------|
| **`npm run ui:kimi-mode4-preflight`** | **Mandatory preflight audit — must PASS before Stage D/E/G** |
| `npm run ui:kimi-mode4-sync-manifest` | Sync JSON manifest |
| `npm run ui:kimi-mode4-contract -- --id <id>` | Generate Page Contract |
| `npm run ui:kimi-mode4-standards` | Print standards pack |
| `npm run ui:kimi-mode4 -- --stage golden` | Golden screen batch (first-pass generate) |
| `npm run ui:kimi-mode4-completion` | **Gap-fill repass** — requires `--only <manifestId>` |
| `npm run ui:kimi-mode4-completion -- --only <id>` | Single-surface completion pass (one at a time) |
| `npm run ui:kimi-mode4-completion -- --print-instruction --only <id>` | Preview completion prompt |
| `npm run ui:kimi-mode4-completion -- --skip-screenshot --only <id>` | Only if screenshot capture fails |
| `npm run ui:kimi-mode4 -- --stage bulk` | Bulk concurrent rebuild |
| `npm run ui:kimi-mode4 -- --status` | Completion records |
| `npm run ui:kimi -- --target <route> --video <name>` | Single Mode 1/4 page (manual) |
| `npm run ui:approve` / `ui:integrate` | Promote sandbox → production |

Art direction video names: `scripts/ui-agent/mode4-standards-pack.ts` → `MODE4_ART_DIRECTION_VIDEOS`.

---

## MASTER EXECUTION COMMAND (give Cursor this)

> Implement this orchestration now. Do not redesign any Transovo production UI yourself. First locate and load the complete approved Transovo standards/design-document set and the exact approved customer-facing page inventory (`docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`). Create Kimi Mode 4 by extending the existing Mode 1 full-page recreation workflow (`runKimiCommand`) with the standards hierarchy and rules in this document. Ensure every Mode 4 job receives the complete relevant standards, its Page Contract, the approved feature requirements, and access to the Campaign and Inbox reference videos as visual art direction. Build a complete allowlisted rebuild manifest covering every approved page, subpage, detail view, local view, wizard, setup flow, and meaningful customer-facing screen—but do not include legacy/out-of-scope repo routes merely because they exist. Map every approved feature to its canonical page before generation. Establish shared design foundations and the six representative golden screens first. Then dispatch the remaining eligible page rebuilds through Kimi Mode 4 with up to 10 concurrent jobs, staggering starts by approximately five seconds, while preventing concurrent writes to the same shared files. The Kimi-generated implementation must replace/become the actual canonical UI for each approved route. Preserve existing backend/domain/API behavior and integration contracts. Kimi owns the UI implementation; Cursor owns orchestration, static verification, integration mapping, and later backend wiring. Cursor must not run a build, dev server, browser, screenshots, Playwright, Puppeteer, Cypress, Docker build, memory-heavy tests, or visual verification. Use only safe inspection/static checks. Track completion and required feature coverage for every page. Retry or Mode-4-refine only the pages that fail the Page Contract or established Transovo visual language. At the end, verify full approved-page coverage, full approved-feature coverage, canonical routing to the new UI, and absence of accidental legacy/out-of-scope features. Summarize what was configured, the manifest, Kimi execution results, any failed/retried jobs, and any backend wiring Cursor still needs to complete.
