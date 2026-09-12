import {
  OVERVIEW_NEUTRAL_RUNTIME_STYLE_ID,
  OVERVIEW_PILOT_SSR_CSS,
} from "./appointments-overview-neutral-runtime";

/** Server-rendered — overview route always ships kill-teal + 204px rules in HTML. */
export function OverviewPilotSsrStyles() {
  return (
    <style
      id={`${OVERVIEW_NEUTRAL_RUNTIME_STYLE_ID}-ssr`}
      data-overview-theme="soft-cool-slate-204"
      dangerouslySetInnerHTML={{ __html: OVERVIEW_PILOT_SSR_CSS }}
    />
  );
}
