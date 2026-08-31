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
    referenceVideoName: "Creating Automated Workflows in SlickText SlickText Tutorials - SlickText (360p)",
    steps: [
      { id: "01_list", label: "Workflows list (Flows tab)", path: "/automations", fullPage: true },
      { id: "02_templates", label: "Templates tab", path: "/automations/templates", fullPage: true },
      { id: "03_logs", label: "Logs tab", path: "/automations/logs", fullPage: true },
      {
        id: "04_builder",
        label: "Workflow builder canvas",
        path: "/automations",
        actions: [
          { type: "click", selector: "table tbody tr.cursor-pointer" },
          { type: "wait", ms: 2500 },
        ],
        fullPage: true,
      },
      {
        id: "05_builder_empty",
        label: "Workflow builder — create new (fallback)",
        path: "/automations",
        actions: [
          { type: "click", selector: 'button:has-text("Create Workflow")' },
          { type: "wait", ms: 4000 },
        ],
        fullPage: true,
      },
      {
        id: "06_node_config",
        label: "Builder node config modal",
        path: "/automations",
        actions: [
          { type: "click", selector: "table tbody tr.cursor-pointer, button:has-text(\"Create Workflow\")" },
          { type: "wait", ms: 2500 },
          { type: "click", selector: ".node-card" },
          { type: "wait", ms: 800 },
        ],
        fullPage: true,
      },
    ],
  },
  {
    route: "/conversations",
    referenceVideoName: "Navigating the SlickText Inbox SlickText Tutorials - SlickText (360p)",
    steps: [
      { id: "01_empty", label: "Inbox — no conversation selected", path: "/conversations", fullPage: true },
      {
        id: "02_thread",
        label: "Inbox — thread open",
        path: "/conversations",
        actions: [
          { type: "click", selector: 'text=Patrick Dukes' },
          { type: "wait", ms: 800 },
        ],
        fullPage: true,
      },
      {
        id: "03_compose",
        label: "Compose new message modal",
        path: "/conversations",
        actions: [
          { type: "click", selector: 'button:has-text("New Message")' },
          { type: "wait", ms: 600 },
        ],
        fullPage: true,
      },
    ],
  },
];

export function resolvePolishTarget(route: string): PolishTargetConfig | undefined {
  const clean = route.startsWith("/") ? route : `/${route}`;
  return POLISH_TARGETS.find((t) => t.route === clean || clean.startsWith(`${t.route}/`));
}
