"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { mctbSignupNextQuery } from "@/lib/mctb/onboarding/entry-path";
import {
  MCTB_MARKETING_FREE_PRICE_LABEL,
  MCTB_MARKETING_PLAN_COMPARE_ROWS,
  MCTB_MARKETING_PRO_PRICE_LABEL,
} from "@/lib/mctb/marketing-plan-comparison";
import { MctbLandingCheckoutButton } from "./mctb-landing-checkout-button";

const CHECKOUT_PRO = "/mctb/billing/checkout?product=mctb_pro";
const SIGNUP = mctbSignupNextQuery();

export function MctbPlanCompareSection() {
  return (
    <div className="mctb-plan-compare-wrap">
      <div className="mctb-plan-compare-table-scroll" tabIndex={0} role="region" aria-label="Free versus Pro plan comparison">
        <table className="mctb-plan-compare-table">
          <caption className="sr-only">
            Compare Transovo Missed Call Text Back Free and Pro plans
          </caption>
          <thead>
            <tr>
              <th scope="col">What you get</th>
              <th scope="col">
                <span className="mctb-plan-compare-plan-name">Free</span>
                <span className="mctb-plan-compare-plan-price">{MCTB_MARKETING_FREE_PRICE_LABEL}/mo</span>
              </th>
              <th scope="col">
                <span className="mctb-plan-compare-plan-name">Pro</span>
                <span className="mctb-plan-compare-plan-price">{MCTB_MARKETING_PRO_PRICE_LABEL}/mo</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {MCTB_MARKETING_PLAN_COMPARE_ROWS.map((row) => (
              <tr key={row.feature} className={row.highlight ? "mctb-plan-compare-row-highlight" : undefined}>
                <th scope="row">{row.feature}</th>
                <td>{row.free}</td>
                <td>{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mctb-plan-compare-cta-row">
        <div className="mctb-plan-compare-cta-card">
          <p className="mctb-plan-compare-cta-title">Start on Free</p>
          <p className="mctb-plan-compare-cta-copy">
            No credit card. Real recoveries on our platform toll-free sender.
          </p>
          <Link href={SIGNUP} className="lp-btn lp-btn-primary mctb-plan-compare-cta-btn">
            Start free
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mctb-plan-compare-cta-card mctb-plan-compare-cta-card-pro">
          <p className="mctb-plan-compare-cta-title">Upgrade to Pro</p>
          <p className="mctb-plan-compare-cta-copy">
            More recoveries, SMS team alerts, all strategies, booking links, and analytics.
          </p>
          <MctbLandingCheckoutButton
            productKey="mctb_pro"
            loginNextPath={CHECKOUT_PRO}
            className="lp-btn lp-btn-secondary mctb-plan-compare-cta-btn"
          >
            Get Pro — {MCTB_MARKETING_PRO_PRICE_LABEL}/mo
          </MctbLandingCheckoutButton>
          <p className="mctb-plan-compare-cta-foot">
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(CHECKOUT_PRO)}`}>Sign in to upgrade</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
