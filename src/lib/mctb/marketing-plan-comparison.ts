/**
 * Customer-facing Free vs Pro copy for marketing — keep aligned with
 * recovery-usage-constants, capabilities, and first-text entitlements.
 */
import {
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
} from "@/lib/mctb/recovery-usage-constants";
import { MCTB_PRO_MONTHLY_CENTS } from "@/lib/mctb/commercial-pricing";

export const MCTB_MARKETING_FREE_PRICE_LABEL = "$0";
export const MCTB_MARKETING_PRO_PRICE_LABEL = `$${(MCTB_PRO_MONTHLY_CENTS / 100).toFixed(2)}`;

export type MctbMarketingPlanCompareRow = {
  feature: string;
  free: string;
  pro: string;
  /** Emphasize meaningful plan differences in the table */
  highlight?: boolean;
};

export const MCTB_MARKETING_PLAN_COMPARE_ROWS: MctbMarketingPlanCompareRow[] = [
  {
    feature: "Monthly missed-call text-backs",
    free: `${MCTB_FREE_MONTHLY_RECOVERY_LIMIT}`,
    pro: `${MCTB_PRO_MONTHLY_RECOVERY_LIMIT}`,
    highlight: true,
  },
  {
    feature: "Platform toll-free text-back sender (no customer A2P to start)",
    free: "Included",
    pro: "Included",
  },
  {
    feature: "Keep your existing business line for calls",
    free: "Yes",
    pro: "Yes",
  },
  {
    feature: "Press-1 or existing permission consent",
    free: "Yes",
    pro: "Yes",
  },
  {
    feature: "Recovery message strategies",
    free: "2 essential templates",
    pro: "All 5 templates + after-hours wording",
    highlight: true,
  },
  {
    feature: "Team email alerts (missed call, reply, voicemail)",
    free: "Yes",
    pro: "Yes",
  },
  {
    feature: "Team SMS alerts",
    free: "—",
    pro: "Yes",
    highlight: true,
  },
  {
    feature: "Booking links in recovery",
    free: "—",
    pro: "Yes",
    highlight: true,
  },
  {
    feature: "Analytics",
    free: "Core usage summary",
    pro: "Full funnel, trends & drilldowns",
    highlight: true,
  },
  {
    feature: "Credit card to start",
    free: "Not required",
    pro: "Billed monthly when you upgrade",
  },
  {
    feature: "Customer-owned local number (optional A2P add-on)",
    free: "Add anytime (+$10/mo + one-time carrier fees)",
    pro: "Add anytime (+$10/mo + one-time carrier fees)",
  },
];
