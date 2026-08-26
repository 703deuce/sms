"use client";

import { useState } from "react";
import {
  formatUsdFromCents,
  listMassTextPricingCards,
  MASS_TEXT_A2P_REGISTRATION_FEE_CENTS,
} from "@/lib/mass-texting/pricing";

const pricing = listMassTextPricingCards();

export function MassTextingPricingSection() {
  const [mode, setMode] = useState<"monthly" | "payg">("monthly");

  return (
    <section className="border-t border-slate-200 bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Pricing</h2>
          <div className="flex rounded-xl border border-slate-200 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("monthly")}
              className={`rounded-lg px-4 py-2 ${mode === "monthly" ? "bg-teal-700 text-white" : ""}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setMode("payg")}
              className={`rounded-lg px-4 py-2 ${mode === "payg" ? "bg-teal-700 text-white" : ""}`}
            >
              Pay As You Go
            </button>
          </div>
        </div>

        {mode === "monthly" ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pricing.monthly.map((plan) => (
              <div key={plan.tier} className="rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold">{plan.displayName}</h3>
                <p className="mt-2 text-3xl font-bold">
                  {formatUsdFromCents(plan.monthlyPriceCents)}
                  <span className="text-base font-normal text-slate-500">/mo</span>
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {plan.includedSegments.toLocaleString()} SMS segments
                </p>
                <p className="mt-1 text-sm text-slate-600">1 local number included</p>
                {!plan.includesA2pRegistration ? (
                  <p className="mt-2 text-sm text-amber-700">
                    +{formatUsdFromCents(MASS_TEXT_A2P_REGISTRATION_FEE_CENTS)} one-time A2P registration
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-teal-700">A2P registration included</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">{pricing.paygLine.displayName}</h3>
              <p className="mt-2 text-3xl font-bold">
                {formatUsdFromCents(pricing.paygLine.monthlyPriceCents)}
                <span className="text-base font-normal text-slate-500">/mo</span>
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Dedicated local number + ongoing A2P campaign maintenance. Message packs sold separately.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pricing.paygPacks.map((pack) => (
                <div key={pack.key} className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-semibold">{pack.displayName}</h3>
                  <p className="mt-2 text-2xl font-bold">{formatUsdFromCents(pack.priceCents)}</p>
                  {!pack.includesA2pRegistration ? (
                    <p className="mt-2 text-sm text-amber-700">
                      +{formatUsdFromCents(MASS_TEXT_A2P_REGISTRATION_FEE_CENTS)} one-time A2P on first activation
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-teal-700">A2P registration included</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <h3 className="font-semibold text-teal-900">14-Day Free Trial</h3>
          <p className="mt-1 text-sm text-teal-800">
            {pricing.trial.includedSegments} SMS segments · No credit card required. Your trial begins when
            your business messaging is approved and activated.
          </p>
        </div>
      </div>
    </section>
  );
}
