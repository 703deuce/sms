import { REVIEW_ROUTES } from "@/lib/reviews/routes";

const BASE = REVIEW_ROUTES.qr;

/** Canonical Transovo URLs for QR campaigns (poster + pay & review). Workspace id is cookie-scoped — not in the path. */
export const reviewQrRoutes = {
  list: BASE,
  new: `${BASE}/new`,
  newReview: `${BASE}/new/review`,
  newPayment: `${BASE}/new/payment`,
  plans: `${BASE}/plans`,
  /** Legacy single-page poster editor (`/reviews/qr`). */
  posterEditor: "/reviews/qr",
  detail: (campaignId: string) => `${BASE}/${campaignId}`,
  analytics: (campaignId: string) => `${BASE}/${campaignId}/analytics`,
} as const;
