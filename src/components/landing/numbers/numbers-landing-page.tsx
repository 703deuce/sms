"use client";

import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { PersonalFindNumberClient } from "@/components/numbers/personal-find-number-ui";
import {
  ArrowRight,
  Briefcase,
  Globe,
  PhoneForwarded,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import "./numbers-landing.css";

const NAV = [
  { href: "#search", label: "Find a Number" },
  { href: "/personal/porting", label: "Port a Number" },
  { href: "/contact", label: "Enterprise Solutions" },
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Support" },
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
        <div className="nl-container flex h-[72px] items-center justify-between gap-4 px-6">
          <Link href="/" className="nl-logo flex items-center gap-2.5 font-bold text-[#0f172a]">
            <LogoMark />
            {BRAND_NAME}
          </Link>
          <nav className="nl-nav-links hidden items-center gap-7 text-[14px] font-medium text-[#475569] lg:flex">
            {NAV.map((item) => (
              <Link key={item.label} href={item.href} className="hover:text-[#1e3a5f]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden text-[14px] font-semibold text-[#334155] sm:block">
              Sign in
            </Link>
            <button type="button" onClick={focusLandingSearch} className="nl-btn-primary">
              Get started
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
              Search millions of available phone numbers from every area code and prefix. Pick a
              number that stands out and fits your brand or personality.
            </p>
          </div>

          <div className="mt-8">
            <PersonalFindNumberClient
              workspaceId="public-landing"
              hidePageHeader
              publicLanding={{}}
            />
          </div>
        </div>
      </section>

      <section className="nl-steps-bar">
        <div className="nl-container grid gap-8 px-6 md:grid-cols-3">
          {[
            {
              icon: Search,
              title: "Search & find your perfect number",
              body: "Enter area code, digits, patterns, or ask AI in plain English.",
            },
            {
              icon: Shield,
              title: "Reserve with a low one-time fee",
              body: "Choose an available number and secure it instantly at checkout.",
            },
            {
              icon: PhoneForwarded,
              title: "Quick activation & porting support",
              body: "Transfer to your carrier or keep it protected in your Number Vault.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <div className="nl-step-circle">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-[#0f172a]">{title}</h3>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#64748b]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="nl-section">
        <div className="nl-container grid gap-10 px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="nl-category-card">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#6366f1]">
                Personal Numbers
              </p>
              <h3 className="mt-2 text-[22px] font-bold leading-snug text-[#0f172a]">
                Pick a number you actually like.
              </h3>
              <p className="mt-4 text-[14px] leading-relaxed text-[#64748b]">
                Find clean endings, repeating numbers, favorite digits, specific area codes and
                memorable patterns.
              </p>
              <button
                type="button"
                onClick={focusLandingSearch}
                className="nl-btn-primary mt-6 w-full sm:w-auto"
              >
                Find a Personal Number
              </button>
            </div>
            <div className="nl-category-card">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#6366f1]">
                Business Vanity
              </p>
              <h3 className="mt-2 text-[22px] font-bold leading-snug text-[#0f172a]">
                Give customers a number they remember.
              </h3>
              <p className="mt-4 text-[14px] leading-relaxed text-[#64748b]">
                Find numbers built around your company, industry or advertising message.
              </p>
              <button
                type="button"
                onClick={focusLandingSearch}
                className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-[#6366f1] hover:underline"
              >
                Browse by Word
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="nl-social-proof">
              <Users className="h-5 w-5 text-[#6366f1]" />
              <p className="text-[15px] font-semibold text-[#0f172a]">
                Over 500,000+ businesses and individuals trust {BRAND_NAME}.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: "Real Estate Agents", icon: Briefcase },
                { title: "Sales Professionals", icon: Globe },
                { title: "VIP / Unique", icon: Sparkles },
              ].map(({ title, icon: Icon }) => (
                <div key={title} className="nl-industry-chip">
                  <Icon className="h-4 w-4 text-[#6366f1]" />
                  <span>{title}</span>
                </div>
              ))}
            </div>
            <div id="pricing" className="nl-pricing-mini">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#94a3b8]">
                Pricing tiers
              </p>
              <ul className="mt-3 space-y-2 text-[14px] text-[#334155]">
                <li>
                  <strong>$14.99/mo</strong> Starter
                </li>
                <li>
                  <strong>$29.99/mo</strong> Business
                </li>
                <li>
                  <strong>$79.99/mo</strong> Pro
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="nl-section-alt nl-section">
        <div className="nl-container max-w-3xl px-6 text-center">
          <h2 className="text-[28px] font-bold text-[#0f172a]">No rush to transfer it today.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[#64748b]">
            Your purchased number can remain protected with Transovo for up to 30 days while you
            prepare your transfer. Transfer it anytime during that period, or keep it in your
            Number Vault afterward.
          </p>
        </div>
      </section>

      <section id="porting" className="nl-section">
        <div className="nl-container flex flex-col items-center px-6 text-center">
          <div className="nl-guarantee-icon">
            <Shield className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-[32px] font-bold text-[#0f172a]">30-Day Portability Guarantee</h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#64748b]">
            Start your transfer within 30 days. If your receiving carrier ultimately confirms that it
            cannot accept the number because of a genuine portability or coverage limitation, you
            can return the number for a refund of the purchase price.
          </p>
          <Link href="/personal/porting" className="mt-6 text-[15px] font-semibold text-[#6366f1] hover:underline">
            Learn About Porting
          </Link>
        </div>
      </section>

      <section className="nl-section-alt nl-section">
        <div className="nl-container max-w-3xl px-6">
          <h2 className="text-center text-[32px] font-bold text-[#0f172a]">FAQ</h2>
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
          <h2 className="text-[32px] font-bold text-white">
            Ready to get started? Your new phone number is waiting.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button type="button" onClick={focusLandingSearch} className="nl-btn-white">
              Get Started Now
            </button>
            <Link href="/contact" className="nl-btn-outline-white">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      <footer className="nl-footer">
        <div className="nl-container grid gap-10 px-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-bold text-[#0f172a]">
              <LogoMark />
              {BRAND_NAME}
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-[#64748b]">
              Choose a better phone number. Buy it. Take it with you.
            </p>
            <div className="nl-social-row mt-5">
              {["Facebook", "X", "Instagram", "LinkedIn"].map((network) => (
                <span key={network} className="nl-social-icon" aria-label={network}>
                  {network[0]}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="nl-footer-label">Products</p>
            <ul className="nl-footer-links">
              <li><a href="#search">Find a Number</a></li>
              <li><Link href="/personal/porting">Port a Number</Link></li>
              <li><Link href="/sms-marketing">SMS Marketing</Link></li>
            </ul>
          </div>
          <div>
            <p className="nl-footer-label">Company</p>
            <ul className="nl-footer-links">
              <li><Link href="/contact">About</Link></li>
              <li><Link href="/contact">Careers</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="nl-footer-label">Legal</p>
            <ul className="nl-footer-links">
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/contact">Support</Link></li>
            </ul>
          </div>
        </div>
        <div className="nl-container mt-10 flex flex-col items-center justify-between gap-3 px-6 pb-8 sm:flex-row">
          <p className="text-[13px] text-[#94a3b8]">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
          <span className="nl-secure-badge">Secure Checkout</span>
        </div>
      </footer>
    </div>
  );
}
