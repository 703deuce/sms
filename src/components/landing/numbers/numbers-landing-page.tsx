"use client";

import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import {
  focusLandingSearch,
  NumbersLandingSearch,
} from "@/components/landing/numbers/numbers-landing-search";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import {
  ArrowRight,
  Check,
  Shield,
  ShoppingBag,
  PhoneForwarded,
  Globe,
  Sparkles,
} from "lucide-react";
import "./numbers-landing.css";

const NAV = [
  { href: "#search", label: "Find a Number" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#personal-business", label: "Business Numbers" },
  { href: "#porting", label: "Porting" },
  { href: "#pricing", label: "Pricing" },
];

const FAQS = [
  {
    q: "Can I use the number with my current cellphone?",
    a: "Yes, if your receiving carrier supports the number and rate center. Start a port through your receiving carrier when you're ready.",
  },
  {
    q: "Is this a new phone plan?",
    a: "No. You are primarily purchasing the number. You can transfer it to your existing carrier or keep it with Transovo.",
  },
  {
    q: "How long does a transfer take?",
    a: "Timing depends on your carrier and number type. Many mobile ports complete within a few business days, but we do not guarantee a fixed timeline.",
  },
  {
    q: "Can I keep it with Transovo?",
    a: "Yes. Your number can remain in the Number Vault. Forwarding and voicemail may also be available in your account.",
  },
  {
    q: "What if my carrier can't take the number?",
    a: "Start your transfer within 30 days. If your receiving carrier confirms it cannot accept the number because of a genuine portability or coverage limitation, the purchase is covered by the Transovo Portability Guarantee.",
  },
  {
    q: "Do I have to transfer it immediately?",
    a: "No. Your purchased number includes up to 30 days protected with Transovo while you prepare your transfer.",
  },
  {
    q: "Can I search for specific digits?",
    a: `Yes. Search by area code, digits, patterns, words, or ask ${BRAND_NAME} in plain English.`,
  },
  {
    q: "Are these numbers actually available?",
    a: "Yes. Results come from live carrier inventory, with final availability confirmed again before reservation or purchase.",
  },
];

function LogoMark() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#1e3a5f] text-white">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function NumbersLandingPage({
  initialTopPicks,
  defaultAreaCodes,
  shelfSearchLogId,
}: {
  initialTopPicks: PremiumNumberProductResult[];
  defaultAreaCodes: string[];
  shelfSearchLogId?: string;
}) {
  return (
    <div className="numbers-landing min-h-screen">
      <header className="nl-nav">
        <div className="nl-container flex h-16 items-center justify-between gap-4 px-5">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#111827]">
            <LogoMark />
            {BRAND_NAME}
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-[#374151] md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-[#6366f1]">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-[13px] font-semibold text-[#374151] sm:block">
              Sign In
            </Link>
            <button
              type="button"
              onClick={focusLandingSearch}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#152a45]"
            >
              Find My Number
            </button>
          </div>
        </div>
      </header>

      <section id="search" className="nl-section pb-8 pt-10 sm:pt-14">
        <div className="nl-container px-5">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="nl-hero-title text-[2rem] font-bold leading-tight tracking-tight text-[#111827] sm:text-[2.75rem]">
              Choose a phone number you&apos;ll actually remember.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280] sm:text-[17px]">
              Search millions of available personal and business phone numbers. Find one you like,
              buy it, and take it to your current carrier.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {["50% Launch Pricing", "30-Day Portability Guarantee", "Easy Port-Out"].map(
                (label) => (
                  <span key={label} className="nl-trust-pill">
                    <Check className="h-4 w-4" />
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="mt-8">
            <NumbersLandingSearch
              initialTopPicks={initialTopPicks}
              defaultAreaCodes={defaultAreaCodes}
              shelfSearchLogId={shelfSearchLogId}
            />
          </div>
        </div>
      </section>

      <section className="nl-section-alt nl-section py-10">
        <div className="nl-container px-5">
          <p className="text-center text-[13px] font-bold uppercase tracking-wide text-[#6366f1]">
            Your number. Your carrier. Your choice.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShoppingBag,
                title: "Buy It",
                body: "Choose an available number and make it yours.",
              },
              {
                icon: PhoneForwarded,
                title: "Take It With You",
                body: "Transfer it to Verizon, AT&T, T-Mobile or another compatible carrier.",
              },
              {
                icon: Shield,
                title: "Port With Confidence",
                body: "If you initiate a legitimate port within 30 days and the receiving carrier ultimately cannot accept the number because of a genuine portability or coverage limitation, the purchase is covered by the Transovo Portability Guarantee.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm"
              >
                <Icon className="h-6 w-6 text-[#6366f1]" />
                <h3 className="mt-3 text-[16px] font-bold">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="nl-section">
        <div className="nl-container px-5 text-center">
          <h2 className="text-[28px] font-bold">How it works</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              { step: "Find it", body: `Search by area code, digits, patterns, words, or ask ${BRAND_NAME}.` },
              { step: "Buy it", body: "Reserve the number and complete checkout." },
              { step: "Take it anywhere", body: "Port it to your current carrier or keep it with Transovo." },
            ].map(({ step, body }) => (
              <div key={step}>
                <div className="nl-step-icon mx-auto">
                  <Globe className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[18px] font-bold">{step}</h3>
                <p className="mt-2 text-[14px] text-[#6b7280]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nl-section-alt nl-section">
        <div className="nl-container grid gap-8 px-5 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-[26px] font-bold">Can&apos;t find the right number? Ask {BRAND_NAME}.</h2>
            <div className="mt-6 rounded-xl border border-[#e5e7eb] bg-white p-4 text-[13px]">
              <p className="font-semibold text-[#6366f1]">You:</p>
              <p className="mt-1 text-[#374151]">
                I want an easy 571 number with lots of 7s under $20.
              </p>
              <p className="mt-4 font-semibold text-[#6366f1]">{BRAND_NAME}:</p>
              <p className="mt-1 text-[#374151]">
                I found several available matches. Here are the strongest options.
              </p>
            </div>
            <p className="mt-4 text-[14px] text-[#6b7280]">
              Tell {BRAND_NAME} what you want in plain English. It searches real available inventory
              and helps narrow thousands of possibilities into numbers worth considering.
            </p>
            <button
              type="button"
              onClick={focusLandingSearch}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#5558e3]"
            >
              <Sparkles className="h-4 w-4" />
              Ask {BRAND_NAME}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {initialTopPicks.slice(0, 3).map((item) => (
              <div
                key={item.phoneNumber}
                className="rounded-xl border border-[#e5e7eb] bg-white p-4 text-center shadow-sm"
              >
                <p className="text-[16px] font-bold">{item.displayNumber}</p>
                <p className="mt-1 text-[12px] text-[#6b7280]">{item.memorabilityLabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="personal-business" className="nl-section">
        <div className="nl-container grid gap-6 px-5 md:grid-cols-2">
          {[
            {
              title: "Pick a number you actually like.",
              headline: "Personal Numbers",
              examples: ["571-404-2020", "703-515-5150"],
              body: "Find clean endings, repeating numbers, favorite digits, specific area codes and memorable patterns.",
              cta: "Find a Personal Number",
            },
            {
              title: "Give customers a number they remember.",
              headline: "Business Vanity",
              examples: ["540-999-WIRE", "703-XX-ROOF"],
              body: "Find numbers built around your company, industry or advertising message.",
              cta: "Find a Business Number",
            },
          ].map((card) => (
            <div
              key={card.headline}
              className="rounded-2xl border border-[#e5e7eb] bg-gradient-to-br from-[#f9fafb] to-white p-8 shadow-sm"
            >
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#6366f1]">
                {card.headline}
              </p>
              <h3 className="mt-2 text-[22px] font-bold">{card.title}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {card.examples.map((ex) => (
                  <span
                    key={ex}
                    className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold shadow-sm ring-1 ring-[#e5e7eb]"
                  >
                    {ex}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[14px] text-[#6b7280]">{card.body}</p>
              <button
                type="button"
                onClick={focusLandingSearch}
                className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-[#6366f1] hover:underline"
              >
                {card.cta}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="nl-section-alt nl-section">
        <div className="nl-container px-5 text-center">
          <h2 className="text-[28px] font-bold">Better numbers don&apos;t have to cost a fortune.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { tier: "Choice", price: "Starting at $4.99" },
              { tier: "Nice & Memorable", price: "Usually $9.99–$19.99" },
              { tier: "Premium", price: "Rare standout numbers from $29.99+" },
              { tier: "Business Vanity", price: "Priced by word, pattern & availability" },
            ].map(({ tier, price }) => (
              <div key={tier} className="rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
                <p className="text-[14px] font-bold text-[#6366f1]">{tier}</p>
                <p className="mt-2 text-[15px] font-semibold text-[#111827]">{price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nl-section">
        <div className="nl-container max-w-3xl px-5 text-center">
          <h2 className="text-[26px] font-bold">No rush to transfer it today.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280]">
            Your purchased number can remain protected with Transovo for up to 30 days while you
            prepare your transfer. Transfer it anytime during that period, or keep it in your
            Transovo Number Vault afterward.
          </p>
          <p className="mt-3 text-[13px] text-[#6b7280]">
            30 days included. Then $2.99/month if the number remains with Transovo. Cancel by
            completing your port-out.
          </p>
        </div>
      </section>

      <section id="porting" className="nl-section-alt nl-section">
        <div className="nl-container flex flex-col items-center px-5 text-center">
          <Shield className="h-12 w-12 text-[#6366f1]" />
          <h2 className="mt-4 text-[28px] font-bold">30-Day Portability Guarantee</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#6b7280]">
            Start your transfer within 30 days. If your receiving carrier ultimately confirms that it
            cannot accept the number because of a genuine portability or coverage limitation, you
            can return the number for a refund of the purchase price.
          </p>
          <p className="mt-2 text-[14px] text-[#6b7280]">
            No carrier lock-in. Easy port-out instructions.
          </p>
          <Link
            href="/personal/porting"
            className="mt-6 text-[14px] font-semibold text-[#6366f1] hover:underline"
          >
            Learn About Porting
          </Link>
        </div>
      </section>

      <section className="nl-section">
        <div className="nl-container px-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              "Real-time inventory",
              "Secure Stripe checkout",
              "Multiple carrier inventories searched",
            ].map((point) => (
              <div
                key={point}
                className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-6 text-center text-[14px] font-semibold"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nl-section-alt nl-section">
        <div className="nl-container max-w-3xl px-5">
          <h2 className="text-center text-[28px] font-bold">FAQ</h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"
              >
                <summary className="cursor-pointer text-[15px] font-semibold">{faq.q}</summary>
                <p className="mt-3 text-[14px] leading-relaxed text-[#6b7280]">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="nl-section bg-[#1e3a5f] text-white">
        <div className="nl-container px-5 text-center">
          <h2 className="text-[28px] font-bold">Your next phone number is waiting.</h2>
          <p className="mt-3 text-[15px] text-white/80">
            Don&apos;t settle for whatever number your carrier gives you.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={focusLandingSearch}
              className="rounded-lg bg-white px-6 py-3 text-[14px] font-semibold text-[#1e3a5f] hover:bg-[#f3f4f6]"
            >
              Find My Number
            </button>
            <button
              type="button"
              onClick={focusLandingSearch}
              className="rounded-lg border border-white/30 px-6 py-3 text-[14px] font-semibold text-white hover:bg-white/10"
            >
              Ask {BRAND_NAME}
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e5e7eb] bg-white py-12">
        <div className="nl-container grid gap-8 px-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-bold">
              <LogoMark />
              {BRAND_NAME}
            </div>
            <p className="mt-3 text-[13px] text-[#6b7280]">
              Choose a better phone number. Buy it. Take it with you.
            </p>
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#9ca3af]">Numbers</p>
            <ul className="mt-3 space-y-2 text-[13px]">
              <li>
                <a href="#search" className="hover:text-[#6366f1]">
                  Find a Number
                </a>
              </li>
              <li>
                <a href="#porting" className="hover:text-[#6366f1]">
                  Porting
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#9ca3af]">Product</p>
            <ul className="mt-3 space-y-2 text-[13px]">
              <li>
                <Link href="/sms-marketing" className="hover:text-[#6366f1]">
                  SMS Marketing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#6366f1]">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#9ca3af]">Legal</p>
            <ul className="mt-3 space-y-2 text-[13px]">
              <li>
                <Link href="/privacy" className="hover:text-[#6366f1]">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#6366f1]">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#6366f1]">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="nl-container mt-10 px-5 text-center text-[12px] text-[#9ca3af]">
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
