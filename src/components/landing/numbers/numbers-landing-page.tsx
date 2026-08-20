"use client";

import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { LandingAiPrompts } from "@/components/landing/numbers/landing-ai-prompts";
import { PersonalFindNumberClient } from "@/components/numbers/personal-find-number-ui";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  MessageSquare,
  PhoneForwarded,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Zap,
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
    a: "Timing depends on your carrier and number type. Many mobile ports complete within a few business days.",
  },
  {
    q: "Can I keep it with Transovo?",
    a: "Yes. Your number can remain in the Number Vault with forwarding and voicemail options.",
  },
];

function LogoMark() {
  return (
    <span className="nl-logo-mark" aria-hidden>
      T
    </span>
  );
}

export function focusLandingSearch() {
  document.getElementById("find-number-search")?.scrollIntoView({ behavior: "smooth" });
}

export function NumbersLandingPage() {
  return (
    <div className="numbers-landing min-h-screen">
      <header className="nl-nav">
        <div className="nl-container h-[72px] px-6">
          <Link href="/" className="nl-logo flex items-center gap-2.5 font-bold text-[#0f172a]">
            <LogoMark />
            {BRAND_NAME}
          </Link>
          <nav className="nl-nav-links hidden items-center gap-8 text-[14px] font-medium text-[#475569] lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-[#1e3a5f]">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="nl-nav-actions">
            <Link href="/login" className="hidden text-[14px] font-semibold text-[#334155] sm:block">
              Sign In
            </Link>
            <button type="button" onClick={focusLandingSearch} className="nl-btn-primary">
              Find My Number
            </button>
          </div>
        </div>
      </header>

      <section id="search" className="nl-hero">
        <div className="nl-container px-6">
          <div className="max-w-3xl">
            <h1 className="nl-hero-title text-[2.5rem] font-bold leading-[1.08] tracking-tight text-[#0f172a] sm:text-[3rem]">
              Choose a phone number you&apos;ll actually remember.
            </h1>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[#64748b]">
              Search millions of available personal and business phone numbers. Find one you like,
              buy it, and take it to your current carrier.
            </p>
            <div className="mt-6 flex flex-wrap gap-5">
              {[
                { icon: Zap, label: "50% Launch Pricing" },
                { icon: Shield, label: "30-Day Portability Guarantee" },
                { icon: BadgeCheck, label: "Easy Port-Out" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="nl-trust-pill">
                  <Icon className="h-4 w-4 text-[#2563eb]" strokeWidth={2.5} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]" id="find-number-search">
            <PersonalFindNumberClient
              workspaceId="public-landing"
              hidePageHeader
              hidePublicSidebar
              publicLanding={{}}
            />
            <LandingAiPrompts />
          </div>
        </div>
      </section>

      <section className="nl-trust-strip">
        <div className="nl-container grid gap-6 px-6 md:grid-cols-3">
          {[
            {
              icon: ShoppingBag,
              title: "Buy It",
              body: "Secure your number instantly with transparent pricing and no hidden fees.",
            },
            {
              icon: PhoneForwarded,
              title: "Take It With You",
              body: "Use it with your current carrier. Keep your service. Keep your plan.",
            },
            {
              icon: Shield,
              title: "Port With Confidence",
              body: "If you initiate a transfer within 30 days and your receiving carrier genuinely can't accept the number, your purchase is covered — we'll refund you in full.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="nl-trust-card">
              <div className="nl-trust-card-icon">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[17px] font-bold text-[#0f172a]">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#64748b]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="nl-section">
        <div className="nl-container px-6">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-[28px] font-bold text-[#0f172a]">How it works</h2>
              <div className="nl-steps-flow mt-8">
                {[
                  { n: 1, title: "Find it", body: "Search by area code, digits, or words." },
                  { n: 2, title: "Buy it", body: "Reserve your number with one-time pricing." },
                  { n: 3, title: "Take it anywhere", body: "Port to your carrier or keep with us." },
                ].map((step, i) => (
                  <div key={step.n} className="nl-step-flow-item">
                    <div className="nl-step-flow-num">{step.n}</div>
                    <div>
                      <p className="font-bold text-[#0f172a]">{step.title}</p>
                      <p className="mt-1 text-[13px] text-[#64748b]">{step.body}</p>
                    </div>
                    {i < 2 ? <div className="nl-step-flow-arrow" aria-hidden /> : null}
                  </div>
                ))}
              </div>
              <div id="personal-business" className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="nl-category-card">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#2563eb]">
                    Personal Numbers
                  </p>
                  <h3 className="mt-2 text-[20px] font-bold text-[#0f172a]">
                    Pick a number you actually like.
                  </h3>
                  <button type="button" onClick={focusLandingSearch} className="nl-btn-primary mt-5">
                    Find Your Personal Number
                  </button>
                </div>
                <div className="nl-category-card">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#2563eb]">
                    Business Vanity
                  </p>
                  <h3 className="mt-2 text-[20px] font-bold text-[#0f172a]">
                    Give customers a number they remember.
                  </h3>
                  <button
                    type="button"
                    onClick={focusLandingSearch}
                    className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-[#2563eb] hover:underline"
                  >
                    Explore Business Numbers
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="nl-ai-preview">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#94a3b8]">
                Can&apos;t find the right number?
              </p>
              <h3 className="mt-2 text-[22px] font-bold text-[#0f172a]">Ask {BRAND_NAME}</h3>
              <div className="mt-5 space-y-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-[13px]">
                <p>
                  <span className="font-semibold text-[#2563eb]">You:</span> I want an easy 571 number
                  with lots of 7s under $20.
                </p>
                <p>
                  <span className="font-semibold text-[#2563eb]">{BRAND_NAME}:</span> I found several
                  available matches. Here are the strongest options.
                </p>
              </div>
              <button type="button" onClick={focusLandingSearch} className="nl-btn-secondary mt-5">
                <Sparkles className="h-4 w-4" />
                Ask {BRAND_NAME}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="nl-section-alt nl-section">
        <div className="nl-container px-6 text-center">
          <h2 className="text-[32px] font-bold text-[#0f172a]">
            Better numbers don&apos;t have to cost a fortune.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { tier: "Choice", price: "Starting at $4.99" },
              { tier: "Nice & Memorable", price: "Usually $9.99–$19.99" },
              { tier: "Premium", price: "Rare standout numbers from $29.99+" },
              { tier: "Business Vanity", price: "Priced by word, pattern & availability" },
            ].map(({ tier, price }) => (
              <div key={tier} className="nl-price-card">
                <p className="text-[14px] font-bold text-[#2563eb]">{tier}</p>
                <p className="mt-3 text-[16px] font-semibold text-[#0f172a]">{price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="porting" className="nl-guarantee-banner">
        <div className="nl-container px-6 text-center">
          <h2 className="text-[28px] font-bold text-white">30-Day Portability Guarantee</h2>
          <p className="mx-auto mt-4 max-w-3xl text-[15px] leading-relaxed text-white/90">
            Start your transfer within 30 days. If your receiving carrier ultimately confirms that it
            cannot accept the number because of a genuine portability or coverage limitation, you can
            return the number for a refund of the purchase price.
          </p>
          <div className="nl-guarantee-points mx-auto max-w-4xl">
            {[
              "Buy with confidence — transparent one-time pricing.",
              "Port to your carrier or keep it with us.",
              "Full purchase refund if portability fails for covered reasons.",
            ].map((point) => (
              <div key={point} className="nl-guarantee-point">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" strokeWidth={2.5} />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nl-section">
        <div className="nl-container max-w-3xl px-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[28px] font-bold text-[#0f172a]">Common Questions</h2>
            <Link href="/contact" className="text-[14px] font-semibold text-[#2563eb] hover:underline">
              View all FAQs
            </Link>
          </div>
          <div className="mt-8 space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="nl-faq-item">
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="nl-final-cta">
        <div className="nl-container px-6 text-center">
          <h2 className="text-[32px] font-bold text-white">Your next phone number is waiting.</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button type="button" onClick={focusLandingSearch} className="nl-btn-white">
              Find My Number
            </button>
            <button type="button" onClick={focusLandingSearch} className="nl-btn-outline-white">
              <MessageSquare className="h-4 w-4" />
              Ask {BRAND_NAME}
            </button>
          </div>
        </div>
      </section>

      <footer className="nl-footer-dark">
        <div className="nl-container grid gap-10 px-6 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="flex items-center gap-2 font-bold text-white">
              <LogoMark />
              {BRAND_NAME}
            </div>
            <div className="nl-social-row mt-5">
              {["F", "X", "I", "L"].map((network) => (
                <span key={network} className="nl-social-icon-dark" aria-hidden>
                  {network}
                </span>
              ))}
            </div>
          </div>
          {[
            {
              label: "Products",
              links: [
                ["Find a Number", "#search"],
                ["Port a Number", "/personal/porting"],
                ["SMS Marketing", "/sms-marketing"],
              ],
            },
            {
              label: "Company",
              links: [
                ["About", "/contact"],
                ["Careers", "/contact"],
                ["Contact", "/contact"],
              ],
            },
            {
              label: "Support",
              links: [
                ["Help Center", "/contact"],
                ["Porting Help", "/personal/porting"],
                ["Contact Support", "/contact"],
              ],
            },
            {
              label: "Legal",
              links: [
                ["Privacy", "/privacy"],
                ["Terms", "/terms"],
                ["Support", "/contact"],
              ],
            },
          ].map((col) => (
            <div key={col.label}>
              <p className="nl-footer-label-dark">{col.label}</p>
              <ul className="nl-footer-links-dark">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("#") ? (
                      <a href={href}>{label}</a>
                    ) : (
                      <Link href={href}>{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="nl-container mt-10 flex flex-col items-center justify-between gap-3 px-6 pb-8 sm:flex-row">
          <p className="text-[13px] text-white/60">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
          <span className="nl-secure-badge-dark">30-Day Portability Guarantee</span>
        </div>
      </footer>
    </div>
  );
}
