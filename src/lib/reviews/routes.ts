/** Review Requests / Reputation product routes (workspace-scoped; businessId === workspaceId). */
export const REVIEW_ROUTES = {
  home: "/reviews",
  overview: "/reviews/overview",
  requests: "/reviews/requests",
  campaigns: "/reviews/campaigns",
  templates: "/reviews/templates",
  qr: "/reviews/qr-campaigns",
  /** Google review inbox — canonical path (legacy alias `/reviews/feed` redirects here). */
  feed: "/reviews/reviews",
  /** Review velocity analytics (legacy alias `/reviews/velocity` redirects here). */
  velocity: "/reviews/analytics",
  insights: "/reviews/insights",
  alerts: "/reviews/alerts",
  automations: "/reviews/automations",
  settings: "/reviews/settings",
  publicVelocity: "/tools/review-velocity",
} as const;
