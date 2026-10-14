/** Review Requests / Reputation product routes (workspace-scoped; businessId === workspaceId). */
export const REVIEW_ROUTES = {
  home: "/reviews",
  requests: "/reviews/requests",
  campaigns: "/reviews/campaigns",
  templates: "/reviews/templates",
  qr: "/reviews/qr-campaigns",
  feed: "/reviews/feed",
  velocity: "/reviews/velocity",
  insights: "/reviews/insights",
  alerts: "/reviews/alerts",
  automations: "/reviews/automations",
  settings: "/reviews/settings",
  publicVelocity: "/tools/review-velocity",
} as const;
