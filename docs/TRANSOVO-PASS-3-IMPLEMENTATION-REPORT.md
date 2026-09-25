# TRANSOVO PASS 3 — Product-wide surface-first visual migration

**Branch:** `cursor/pass-3-visual-migration-2304`  
**Authorization:** Full Voice + MCTB presentation migration; functionality frozen.

## Composition model

**OPEN SURFACE BY DEFAULT.** Contained surfaces require `.transovo-surface--contained` or `Card contained`.

Numeric system: `src/styles/transovo-pass3-surface-first.css` (gutters 24–32px desktop / 16px mobile, control height ~38px, table row ~48–56px, radius 6–8px, hairline `#eceef1`, canvas `#fafafa`).

## Shared primitives changed

| Primitive | Change |
|-----------|--------|
| `transovo-pass3-surface-first.css` | **New** — tokens + scoped demotion of decorative cards |
| `TransovoProductPage` | Wraps `transovo-product-canvas` + surface-first |
| `MctbPageContainer` | Adds `transovo-product-surface-first` on canvas |
| `voice/layout.tsx` | Surface-first on all `/voice/*` |
| `Card` | Default open block; `contained` for exceptions |
| `TransovoSection` / `TransovoHairline` | **New** — section hierarchy without cards |
| `transovo-visual-foundation.css` | Canvas `#fafafa`; imports Pass 3 |
| `mctb-home.css` | Open modules; canvas aligned |
| `mctb-missed-calls.css` | Open KPI row + table (no outer table card) |
| `transovo-voice-calls-workspace.css` | Removed list “panel” card wrapper |

## Route inventory (repository)

Generated via `node scripts/pass3-route-inventory.mjs`:

- **Voice / AI Receptionist:** 40 routes (see JSON in CI artifact `/tmp/pass3-inventory.json` or re-run script)
- **MCTB:** 34 routes (includes `/f/mctb/[token]`, legacy setup redirects)

All listed routes inherit surface-first when rendered under `voice-theme` or MCTB canvas wrappers. Pages using only legacy `/voice/*` redirects still resolve to `/mctb/*` at runtime (unchanged).

## Migrated surfaces (this pass)

### System / layout (all child pages)

- Entire `/voice/*` tree via layout
- MCTB `MctbPageContainer`, overview (`mctb-home`), missed calls list
- App shell imports Pass 3 CSS globally for token availability

### Page-specific recompositions

| Surface | Presentation change |
|---------|---------------------|
| Voice Overview | Cards → `TransovoSection` + hairlines; open KPI strip; structural skeleton |
| Voice Calls | Open table on page surface; operating region without panel card |
| MCTB Overview | Open KPI strip + modules via Pass 3 CSS |
| MCTB Missed Calls | Open metrics + table wrap |

### Inherited via CSS (no route logic change)

Receptionist, Business Knowledge, Call Handling, Analytics, Needs Attention, MCTB setup hub/sections, conversations, voicemail, compliance, AI Recovery shells — decorative `Card` / `.voice-card` / `.mctb-home-surface` demoted inside `.transovo-product-surface-first` unless `contained`.

## Untouched / partial (reason)

| Item | Reason |
|------|--------|
| `/voice/agents/*`, campaigns, billing, legacy voice tools | Out of V1 primary nav but inherit voice layout CSS; deeper JSX card removal deferred to follow-up only where CSS insufficient |
| Kimi-connected inbox (`/conversations`) | Mass Texting shell — out of Pass 3 Voice/MCTB scope |
| Chart-heavy analytics innards | Charts may keep `contained` visualization surfaces per spec §18 |
| Public `/f/mctb/[token]` | Minimal chrome; tokens apply when wrapped |

## Known pre-existing defects (unchanged)

1. AI Recovery — `b.filter is not a function`
2. Voice Analytics — undefined count display
3. Unidentified Voice route failure (environment-specific)

Not hidden; not used as excuse to remove UI.

## Verification

- **Desktop + 390px:** `npx tsx scripts/capture-pass-3-visual-proof.ts --phase after`  
  Output: `/opt/cursor/artifacts/screenshots/pass-3-visual-proof/after/{Voice,MCTB}/`
- **Controls:** Pass 2A Calls semantics preserved (tabs, chips, KPI loading, pagination URLs)
- **Loading:** Overview skeleton structural; Calls KPI does not fabricate zeros while loading

## Files changed (summary)

- `src/styles/transovo-pass3-surface-first.css` (new)
- `src/styles/transovo-visual-foundation.css`
- `src/styles/transovo-voice-calls-workspace.css`
- `src/components/transovo/product-page.tsx`, `section.tsx`
- `src/components/ui/card.tsx`, `page-header.tsx`
- `src/components/layout/app-shell.tsx`
- `src/app/(app)/voice/layout.tsx`, `calls/page.tsx`
- `src/app/(app)/mctb/layout.tsx`
- `src/components/mctb/shell/*`, `home/mctb-home.css`, `missed-calls/*.css`, `overview-view.tsx`, `missed-calls-view.tsx`
- `src/components/voice/voice-overview-dashboard.tsx`
- `scripts/pass3-route-inventory.mjs`, `scripts/capture-pass-3-visual-proof.ts`

## Residual inconsistencies

- Some Voice configuration JSX still uses `Card` without `contained` — visually open via CSS but markup cleanup recommended next pass
- MCTB setup section editors may still emit card class names on inner widgets; verify per-section if any boxed regions remain functionally required (warnings/modals)
- StatCard / legacy `transovo-kpi-card` grid on non-migrated pages outside voice/mctb scope unchanged

## Screenshot index

```
/opt/cursor/artifacts/screenshots/pass-3-visual-proof/after/Voice/*.png
/opt/cursor/artifacts/screenshots/pass-3-visual-proof/after/MCTB/*.png
```
