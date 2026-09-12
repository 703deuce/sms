# TRANSOVO — Neutral Visual Test (Revision 2)

**TEST ROUTE:** `/appointments/overview` (Appointments Home only — not applied globally)

**Approach:** Neutral system implemented in real pilot CSS (`html.appt-overview-pilot-active` + `.appt-overview-pilot`). No overlay theme injection.

## Revision 2 changes

1. **Teal / brand chrome removed** — sidebar selection `#E5E5E1` / `#181816`, KPI icon wells `#F1F1EE` / `#444440`, chart `#363633`, section accent bars off (`accent="none"`). Green/amber reserved for semantic states (e.g. Excellent, positive delta).
2. **Lighter large-surface borders** — `#E8E8E4`, reduced shadows on major sections.
3. **Flatter lower dashboard** — KPI row stays carded; lower three modules share one bordered surface on desktop (`appt-overview-module--flat`).
4. **Mobile recomposition** — primary + lower rows force single column; module headers min 48px with actions wrapping to second row; chart min height ~160px.
5. **Mobile typography** — page title 22/28/600, module titles 15/20/600, KPI number 24/28/600, KPI label 12/16/500.

## Primary files

- `src/components/appointments/kimi-ui/overview/appointments-overview-pilot.css`
- `src/components/appointments/kimi-ui/overview/page.tsx`
- `src/components/appointments/kimi-ui/overview/components/*`
- `src/app/(app)/appointments/overview/layout.tsx`

## Screenshots

```bash
UI_AGENT_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/capture-overview-home-screenshot.ts
```

Output directory: `/opt/cursor/artifacts/transovo-neutral-2027-test/`

| File | Description |
|------|-------------|
| `R2_DESKTOP_FULL.png` | Full page |
| `R2_DESKTOP_VIEWPORT.png` | Above-the-fold |
| `R2_DESKTOP_SIDEBAR.png` | Sidebar + selection |
| `R2_DESKTOP_KPI.png` | KPI row |
| `R2_DESKTOP_LOWER.png` | Lower modules |
| `R2_MOBILE_TOP.png` | Page top |
| `R2_MOBILE_KPI.png` | KPI row |
| `R2_MOBILE_SCHEDULE.png` | Today's schedule |
| `R2_MOBILE_CHART.png` | Bookings this week |
| `R2_MOBILE_LOWER.png` | Lower modules |
| `R2_MOBILE_BOTTOM_NAV.png` | Bottom navigation |
| `R2_MOBILE_FULL.png` | Full mobile scroll |

**TRANSOVO_NEUTRAL_2027_VISUAL_TEST:** COMPLETE (overview route only; other routes unchanged)
