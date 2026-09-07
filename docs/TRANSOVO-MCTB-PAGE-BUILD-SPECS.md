# Transovo MCTB Page-by-Page Build Specs

**Status:** Active — mandatory implementation specifications for MCTB frontend rebuild  
**Audience:** Cursor and frontend implementation agents  
**Role:** Screen-by-screen build authority — exact content, hierarchy, states, and behavior per page

**Cursor rule:** `.cursor/rules/transovo-mctb-page-build-specs.mdc` (`alwaysApply: true`)

---

## Authority order (when implementing any MCTB page)

1. `TRANSOVO-MCTB-PRODUCT-SCOPE-AND-DOMAIN-RULES.md`
2. `TRANSOVO-MCTB-INFORMATION-ARCHITECTURE-AND-NAVIGATION-MAP.md`
3. `TRANSOVO-MCTB-PAGE-INVENTORY-AND-ROUTE-MANIFEST.md`
4. `TRANSOVO-MCTB-CANONICAL-PRODUCT-MAP.md`
5. **This page build spec series** (per-route)
6. All Transovo `transovo-*.mdc` standards
7. Finished Appointment product screenshots (visual baseline only)

---

## Spec index

| # | Page | Route | Spec | Cursor rule |
|---|------|-------|------|-------------|
| 01 | Overview | `/mctb` | [TRANSOVO-MCTB-PAGE-BUILD-SPEC-01-OVERVIEW.md](./TRANSOVO-MCTB-PAGE-BUILD-SPEC-01-OVERVIEW.md) | `transovo-mctb-page-spec-01-overview.mdc` |
| 02 | Missed Calls List | `/mctb/missed-calls` | [TRANSOVO-MCTB-PAGE-BUILD-SPEC-02-MISSED-CALLS.md](./TRANSOVO-MCTB-PAGE-BUILD-SPEC-02-MISSED-CALLS.md) | `transovo-mctb-page-spec-02-missed-calls.mdc` |
| 03 | Missed Call Detail | `/mctb/missed-calls/:id` | [TRANSOVO-MCTB-PAGE-BUILD-SPEC-03-MISSED-CALL-DETAIL.md](./TRANSOVO-MCTB-PAGE-BUILD-SPEC-03-MISSED-CALL-DETAIL.md) | `transovo-mctb-page-spec-03-missed-call-detail.mdc` |
| 04 | Conversations | `/mctb/conversations` | [TRANSOVO-MCTB-PAGE-BUILD-SPEC-04-CONVERSATIONS.md](./TRANSOVO-MCTB-PAGE-BUILD-SPEC-04-CONVERSATIONS.md) | `transovo-mctb-page-spec-04-conversations.mdc` |
| 05 | Visual Voicemail | `/mctb/voicemail` + `/mctb/setup/voicemail` | [TRANSOVO-MCTB-PAGE-BUILD-SPEC-05-VISUAL-VOICEMAIL.md](./TRANSOVO-MCTB-PAGE-BUILD-SPEC-05-VISUAL-VOICEMAIL.md) | `transovo-mctb-page-spec-05-visual-voicemail.mdc` |
| 06 | Analytics | `/mctb/analytics` | [TRANSOVO-MCTB-PAGE-BUILD-SPEC-06-ANALYTICS.md](./TRANSOVO-MCTB-PAGE-BUILD-SPEC-06-ANALYTICS.md) | `transovo-mctb-page-spec-06-analytics.mdc` |
| 07 | Setup Overview | `/mctb/setup` | *(pending)* | — |
| 08+ | *Additional pages TBD* | | | |

When implementing a route, read the governing MCTB docs **and** the page-specific build spec for that route before writing code.

---

## Master rule for all page specs

- Appointment screenshots = **visual language** only (shell, density, tokens, components)
- MCTB governing docs = **architecture, terminology, behavior**
- Page manifest = **completeness** (nothing omitted)
- Page build spec = **exact screen implementation** for that route
- Every visible control must have real runtime behavior or be explicitly unavailable
- No mock analytics, no fake status, no provider jargon in UI
