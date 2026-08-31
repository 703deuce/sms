/**
 * Multi-state capture scenarios for Kimi POLISH mode.
 * Prefer direct URLs over fragile click chains; add actions only when needed.
 */

export type WalkthroughAction =
  | { type: "wait"; ms: number }
  | { type: "click"; selector: string }
  | { type: "scroll"; y: number };

export type WalkthroughStep = {
  id: string;
  label: string;
  path: string;
  actions?: WalkthroughAction[];
  fullPage?: boolean;
};

export type PolishTargetConfig = {
  route: string;
  /** Override auto-resolved reference video name from references.json */
  referenceVideoName?: string;
  steps: WalkthroughStep[];
};

export const POLISH_TARGETS: PolishTargetConfig[] = [
  {
    route: "/campaigns",
    referenceVideoName: "Sending Mass Texts in SlickText SlickText Tutorials - SlickText (360p)",
    steps: [
      { id: "01_list", label: "Campaigns list", path: "/campaigns", fullPage: true },
      { id: "02_create", label: "Create campaign composer", path: "/campaigns/new", fullPage: true },
      { id: "03_review", label: "Review before send", path: "/campaigns/new/review", fullPage: true },
    ],
  },
  {
    route: "/automations",
    steps: [
      { id: "01_list", label: "Workflows list", path: "/automations", fullPage: true },
      {
        id: "02_builder",
        label: "Workflow builder",
        path: "/automations",
        actions: [
          { type: "click", selector: 'button:has-text("Create Workflow"), button:has-text("Create workflow")' },
          { type: "wait", ms: 1200 },
        ],
        fullPage: true,
      },
    ],
  },
  {
    route: "/conversations",
    steps: [
      { id: "01_empty", label: "Inbox — no selection", path: "/conversations", fullPage: true },
    ],
  },
];

export function resolvePolishTarget(route: string): PolishTargetConfig | undefined {
  const clean = route.startsWith("/") ? route : `/${route}`;
  return POLISH_TARGETS.find((t) => t.route === clean || clean.startsWith(`${t.route}/`));
}
