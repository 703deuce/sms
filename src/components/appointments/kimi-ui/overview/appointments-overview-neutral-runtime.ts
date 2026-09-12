/**
 * Overview pilot overrides — must work when client CSS chunks are stale.
 * Uses :has(.appt-overview-pilot) so rules apply without waiting for useEffect on <html>.
 */
export const OVERVIEW_NEUTRAL_RUNTIME_STYLE_ID = "appt-overview-neutral-runtime";

export const OVERVIEW_SIDEBAR_WIDTH_PX = 204;

/** Matches overview content root in SSR + client. */
export const OVERVIEW_PILOT_SCOPE =
  "html:has(.appt-overview-pilot), html.appt-overview-slate-204";

const scope = OVERVIEW_PILOT_SCOPE;
const w = OVERVIEW_SIDEBAR_WIDTH_PX;

export const OVERVIEW_NEUTRAL_RUNTIME_CSS = `
${scope} .product-theme {
  --primary: #1b1e23 !important;
  --primary-foreground: #ffffff !important;
  --primary-hover: #262a31 !important;
  --ring: #747c86 !important;
  --sidebar-active: #1b1e23 !important;
  --background: #f6f7f8 !important;
  --sidebar-offset: ${w}px !important;
}
${scope} .product-theme .bg-mesh,
${scope} .bg-background {
  background-color: #f6f7f8 !important;
  background-image: none !important;
}
${scope} .text-primary,
${scope} nav .text-primary,
${scope} a.text-primary,
${scope} .text-indigo-600,
${scope} .text-indigo-700,
${scope} .hover\\:text-indigo-700:hover {
  color: #1b1e23 !important;
}
${scope} .bg-primary,
${scope} .transovo-badge,
${scope} .transovo-badge-dot {
  background-color: #454b53 !important;
  color: #ffffff !important;
}
${scope} .bg-primary\\/10,
${scope} [class*="bg-primary/10"] {
  background-color: #e2e6ea !important;
  color: #1b1e23 !important;
}
${scope} .transovo-sidebar,
${scope} aside.transovo-sidebar[style] {
  width: ${w}px !important;
  max-width: ${w}px !important;
  min-width: ${w}px !important;
  background: #eef0f2 !important;
  border-color: #dde1e5 !important;
}
${scope} .hidden.lg\\:fixed.lg\\:w-\\[224px\\],
${scope} .transovo-sidebar.w-\\[224px\\],
${scope} .transovo-sidebar.lg\\:w-\\[224px\\] {
  width: ${w}px !important;
}
${scope} .lg\\:pl-\\[224px\\] {
  padding-left: ${w}px !important;
}
${scope} .transovo-nav-item {
  min-height: 34px !important;
  height: 34px !important;
  margin: 2px 6px !important;
  padding: 0 8px !important;
  border-radius: 6px !important;
  font-size: 13px !important;
  line-height: 18px !important;
  font-weight: 500 !important;
  color: #666d76 !important;
  gap: 8px !important;
}
${scope} .transovo-nav-item svg {
  width: 16px !important;
  height: 16px !important;
  color: #7a818b !important;
}
${scope} .transovo-nav-item:hover {
  background-color: #e8ebee !important;
  color: #30343a !important;
}
${scope} .transovo-nav-item:hover svg {
  color: #4c525a !important;
}
${scope} .transovo-nav-item[data-active="true"] {
  background-color: #e2e6ea !important;
  color: #1b1e23 !important;
  font-weight: 500 !important;
}
${scope} .transovo-nav-item[data-active="true"]::before {
  display: none !important;
  width: 0 !important;
  content: none !important;
}
${scope} .transovo-nav-item[data-active="true"] svg {
  color: #2a2e34 !important;
}
${scope} header.sticky {
  background: #f6f7f8 !important;
  border-bottom: 1px solid #e4e7ea !important;
  box-shadow: none !important;
  min-height: 54px !important;
}
${scope} header.sticky .h-16 {
  height: 54px !important;
  min-height: 54px !important;
}
${scope} .bg-indigo-600,
${scope} .bg-indigo-100 {
  background-color: #e2e6ea !important;
}
${scope} .text-indigo-700 {
  color: #626872 !important;
}
${scope} .appt-overview-pilot .ref-deco-section-accent,
${scope} .appt-overview-pilot .ref-deco-section-accent--purple,
${scope} .appt-overview-pilot .ref-deco-section-accent--blue,
${scope} .appt-overview-pilot .ref-deco-section-accent--green,
${scope} .appt-overview-pilot .ref-deco-section-accent--amber {
  display: none !important;
}
${scope} .appt-overview-pilot .ref-deco-kpi::before,
${scope} .appt-overview-pilot .ref-deco-kpi--purple::before,
${scope} .appt-overview-pilot .ref-deco-kpi--blue::before,
${scope} .appt-overview-pilot .ref-deco-kpi--green::before,
${scope} .appt-overview-pilot .ref-deco-kpi--amber::before {
  background: #2c2c29 !important;
  opacity: 0.18 !important;
  height: 2px !important;
}
${scope} .appt-overview-pilot .ref-deco-icon-ring,
${scope} .appt-overview-pilot .ref-deco-icon-ring--purple,
${scope} .appt-overview-pilot .ref-deco-icon-ring--blue,
${scope} .appt-overview-pilot .ref-deco-icon-ring--green,
${scope} .appt-overview-pilot .ref-deco-icon-ring--amber {
  background: #f0f2f4 !important;
  color: #454b53 !important;
  box-shadow: inset 0 0 0 1px #e1e5e8 !important;
}
${scope} .appt-overview-pilot .appt-pilot-muted-link,
${scope} .appt-overview-pilot .appt-pilot-muted-link svg {
  color: #4b515a !important;
}
${scope} .appt-overview-pilot .appt-pilot-semantic-positive {
  color: #267a45 !important;
}
${scope} .appt-overview-pilot .appt-overview-chart-svg line {
  stroke: #e4e7ea !important;
}
${scope} .appt-overview-pilot .appt-overview-chart-svg polyline {
  stroke: #394049 !important;
}
${scope} .appt-overview-pilot .appt-overview-chart-svg polygon {
  fill: rgba(57, 64, 73, 0.06) !important;
}
${scope} nav.fixed.bottom-0 a.text-primary,
${scope} nav.fixed.bottom-0 a.text-primary svg {
  color: #1b1e23 !important;
}
${scope} nav.fixed.bottom-0 a.text-muted-foreground,
${scope} nav.fixed.bottom-0 button.text-muted-foreground,
${scope} nav.fixed.bottom-0 a.text-muted-foreground svg {
  color: #777e87 !important;
}
`;

export const OVERVIEW_PILOT_SSR_CSS = OVERVIEW_NEUTRAL_RUNTIME_CSS;

export const OVERVIEW_PRODUCT_THEME_INLINE_VARS: Record<string, string> = {
  "--primary": "#1b1e23",
  "--primary-foreground": "#ffffff",
  "--primary-hover": "#262a31",
  "--ring": "#747c86",
  "--sidebar-active": "#1b1e23",
  "--background": "#f6f7f8",
  "--sidebar-offset": `${w}px`,
};
