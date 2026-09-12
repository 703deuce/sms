# TRANSOVO Soft Cool Slate — Overview visual test (204px sidebar)

**Scope:** `/appointments/overview` only (`html.appt-overview-pilot-active`). Not global.

## Sidebar width

- **Target:** 204px desktop (range 200–208px)
- **Constant:** `OVERVIEW_SIDEBAR_WIDTH_PX` in `appointments-overview-neutral-runtime.ts`

## Token / theme files

| File | Role |
|------|------|
| `src/components/appointments/kimi-ui/overview/appointments-overview-soft-cool-slate.css` | Soft Cool Slate tokens, 204px sidebar, density |
| `src/components/appointments/kimi-ui/overview/appointments-overview-neutral-runtime.ts` | Injected runtime overrides (stale bundle + layout vars) |
| `src/components/appointments/kimi-ui/overview/appointments-overview-pilot.css` | Base pilot shell (updated pl/width fallbacks) |
| `src/components/appointments/kimi-ui/overview/appointments-overview-neutral-r2.css` | Prior neutralization pass (semantic green, modules) |

**DOM marker:** `data-overview-revision="soft-cool-slate-204"`

## Screenshots

Capture:

```bash
DEV_AUTH_BYPASS=1 npm run dev
npx tsx scripts/capture-overview-soft-cool-slate-screenshot.ts
```

**Output directory:** `/opt/cursor/artifacts/transovo-soft-cool-slate-204-test/`

- `01-desktop-full.png` … `05-desktop-chart-lower.png`
- `06-mobile-top.png` … `09-mobile-bottom-nav.png`

## Files changed (this pass)

- `appointments-overview-soft-cool-slate.css` (new)
- `appointments-overview-neutral-runtime.ts`
- `appointments-overview-pilot-chrome.tsx`
- `appointments-overview-pilot.css`
- `appointments-overview-neutral-r2.css` (unchanged; still imported)
- `page.tsx`, `overview-connected.tsx`, `layout.tsx`
- `BookingsChart.tsx`
- `scripts/capture-overview-soft-cool-slate-screenshot.ts` (new)
