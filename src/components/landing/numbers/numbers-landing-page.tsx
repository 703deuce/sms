"use client";

import { LandingHeroSearch } from "@/components/landing/numbers/landing-hero-search";
import { LandingSearchResults } from "@/components/landing/numbers/landing-search-results";
import { LandingTopPicksNearYou } from "@/components/landing/numbers/landing-top-picks-near-you";
import { useLandingReserve } from "@/components/landing/numbers/use-landing-reserve";
import { BRAND_NAME } from "@/lib/brand";
import type { PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";
import Link from "next/link";
import {
  Briefcase,
  Check,
  Globe,
  Phone,
  Plus,
  Shield,
  Smartphone,
  Star,
  Zap,
} from "lucide-react";
import { useState } from "react";
import "./numbers-landing.css";

const NAV = [
  { href: "#search", label: "Buy a Number" },
  { href: "/personal/porting", label: "Port a Number" },
  { href: "#business", label: "Business Solutions" },
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Resources" },
  { href: "/contact", label: "Help" },
];

const FAQS = [
  {
    q: "How does the process work?",
    a: "Search for your desired number, complete the purchase securely online, and we'll immediately provide you with the account details and PIN needed to port it to any carrier of your choice.",
  },
  {
    q: "Can I use my number with any provider?",
    a: "Yes! Numbers purchased from us can be ported to all major US mobile carriers, VoIP services, landline providers, or used directly on our platform.",
  },
  {
    q: "Are there any hidden fees?",
    a: "No. The price you see is the one-time purchase price. There are no ongoing subscription fees or hidden transfer charges unless you choose optional call forwarding or parking plans.",
  },
  {
    q: "How long does porting take?",
    a: "Most mobile carrier ports complete within 1 to 3 business days. Landline and VoIP transfers may take 3 to 7 business days depending on the losing and gaining carrier.",
  },
  {
    q: "What if I can't port my number?",
    a: "We offer a 100% money-back guarantee. If you are unable to port your number within 30 days due to technical or carrier limitations, we will issue a full refund.",
  },
  {
    q: "Can I reserve a number without transferring it right away?",
    a: "Yes. You can keep your number parked safely in your account for as long as you need until you're ready to port or activate it.",
  },
];

const TESTIMONIALS = [
  {
    name: "Sarah Jenkins",
    role: "Real Estate Agent",
    quote: "Found the perfect local number for my real estate business in under 5 minutes. The porting process was seamless, and my clients remember my number immediately.",
  },
  {
    name: "Michael Chang",
    role: "Startup Founder",
    quote: "Securing a vanity toll-free number gave our business instant credibility. The setup was effortless and the support team walked us through every step.",
  },
  {
    name: "David Ross",
    role: "Contractor",
    quote: "Having an easy-to-remember repeating digit number has significantly increased the call volume on our local marketing campaigns. Highly recommended!",
  },
];

function LogoMark() {
  return (
    <span className="fn-logo-circle" aria-hidden>
      <Phone className="h-3.5 w-3.5 text-white" />
    </span>
  );
}

export function focusLandingSearch() {
  document.getElementById("search")?.scrollIntoView({ behavior: "smooth" });
}

export function NumbersLandingPage() {
  const { reserving, reserveError, reserveNumber } = useLandingReserve();
  const [shelfSearchLogId, setShelfSearchLogId] = useState<string | undefined>();
  const [searchResponse, setSearchResponse] = useState<PremiumSearchProductResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  function handleGetNumber(item: Parameters<typeof reserveNumber>[0]) {
    void reserveNumber(item, searchResponse?.searchLogId ?? shelfSearchLogId);
  }

  return (
    <div className="numbers-landing">
      <header className="fn-nav">
        <div className="fn-container fn-nav-row">
          <Link href="/" className="fn-logo">
            <LogoMark />
            <span>FindNumber.ai</span>
          </Link>
          <nav className="fn-nav-links">
            {NAV.map((item) =>
              item.href.startsWith("#") ? (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} href={item.href}>
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="fn-nav-actions">
            <Link href="/login" className="fn-login-link">
              Sign In
            </Link>
            <Link href="/login" className="fn-btn-primary fn-btn-cta-nav">
              GET STARTED
            </Link>
          </div>
        </div>
      </header>

      <section id="search" className="fn-hero">
        <div className="fn-container fn-hero-grid">
          <div className="fn-hero-left">
            <h1 className="fn-hero-title">Choose a phone number you&apos;ll actually remember.</h1>
            <p className="fn-hero-text">
              Reflect your identity or business with a memorable number from the largest marketplace.
              Search, claim, and take it to any carrier you choose.
            </p>
            <ul className="fn-checklist">
              {[
                "Pick your own digits",
                "Works on any device or provider",
                "No contracts or hidden fees",
              ].map((item) => (
                <li key={item}>
                  <Check className="h-4 w-4" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="fn-hero-btns">
              <button type="button" className="fn-btn-primary" onClick={focusLandingSearch}>
                Get Started
              </button>
              <a href="#how-it-works" className="fn-btn-outline">
                How it Works
              </a>
            </div>
            <div className="fn-reviews">
              <div className="fn-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                ))}
              </div>
              <span>Rated 4.8/5 by 20,000+ happy customers</span>
            </div>
          </div>
          <div className="fn-hero-right">
            <LandingHeroSearch onResults={setSearchResponse} onSearching={setSearchLoading} />
            {searchLoading ? <p className="fn-muted fn-hero-loading">Searching…</p> : null}
          </div>
        </div>
      </section>

      <LandingTopPicksNearYou
        onShelfSearchLogId={setShelfSearchLogId}
        onGetNumber={handleGetNumber}
        reserving={reserving}
      />

      <LandingSearchResults
        response={searchResponse}
        reserving={reserving}
        onGetNumber={handleGetNumber}
      />

      {reserveError ? (
        <div className="fn-container">
          <p className="fn-error">{reserveError}</p>
        </div>
      ) : null}

      <section id="how-it-works" className="fn-section fn-how-section">
        <div className="fn-container fn-how-center">
          <h2 className="fn-h2">How it works</h2>
          <p className="fn-subhead">Simple steps to claim your perfect number in minutes.</p>
          <div className="fn-how-steps">
            {[
              {
                n: 1,
                title: "Search",
                body: "Filter by area code, digits, keywords, or memorable patterns.",
              },
              {
                n: 2,
                title: "Claim",
                body: "Reserve your number with transparent, one-time pricing.",
              },
              {
                n: 3,
                title: "Transfer & Use",
                body: "Port to any carrier of your choice or park it securely with us.",
              },
            ].map((step, i) => (
              <div key={step.n} className="fn-how-step">
                <div className="fn-how-circle">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {i < 2 ? <div className="fn-how-dots" aria-hidden /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fn-section fn-features-section">
        <div className="fn-container fn-features-grid">
          <div className="fn-features-four">
            {[
              {
                icon: Globe,
                title: "Extensive Inventory",
                body: "Access millions of memorable numbers across the US.",
              },
              {
                icon: Zap,
                title: "Fast Transfer",
                body: "Quickly port your number to any major carrier.",
              },
              {
                icon: Smartphone,
                title: "Instant Activation",
                body: "Get up and running with your new number in minutes.",
              },
              {
                icon: Shield,
                title: "Secure Process",
                body: "Guaranteed safe ownership transfer with 100% money-back guarantee.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="fn-feature-item">
                <Icon className="h-6 w-6 text-[#2563eb]" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <div className="fn-guarantee-box">
            <Shield className="fn-guarantee-shield" />
            <h3>The FindNumber.ai Guarantee</h3>
            <p className="fn-guarantee-desc">
              We stand behind every number we sell. If you experience any issues porting your number to your chosen carrier, our dedicated support team will make it right or provide a full refund.
            </p>
            <ul>
              <li>100% Number Portability</li>
              <li>30-Day Money-Back Guarantee</li>
              <li>Dedicated Support Assistance</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="business" className="fn-section fn-usecases">
        <div className="fn-container fn-usecases-grid">
          <div className="fn-usecase-card">
            <div className="fn-usecase-header">
              <Smartphone className="fn-usecase-icon" />
              <h3>Personal Use</h3>
            </div>
            <p>Pick digits that reflect you — memorable, local, and easy to share with friends and family. Keep it forever on any mobile carrier.</p>
            <ul className="fn-usecase-list">
              <li>Easy-to-remember family & personal numbers</li>
              <li>Port directly to Verizon, AT&T, T-Mobile & more</li>
              <li>No monthly fees or commitments</li>
            </ul>
            <button type="button" className="fn-link-btn" onClick={focusLandingSearch}>
              Find a personal number →
            </button>
          </div>
          <div className="fn-usecase-card">
            <div className="fn-usecase-header">
              <Briefcase className="fn-usecase-icon" />
              <h3>Business Use</h3>
            </div>
            <p>Give customers a number they remember. Vanity numbers and repetitive patterns build instant trust and brand recognition.</p>
            <ul className="fn-usecase-list">
              <li>Toll-free 800 & local area code vanity options</li>
              <li>Increase response rates on ads and campaigns</li>
              <li>Full ownership and instant forwarding support</li>
            </ul>
            <button type="button" className="fn-link-btn" onClick={focusLandingSearch}>
              Explore business numbers →
            </button>
          </div>
        </div>
      </section>

      <section className="fn-section fn-social-section">
        <div className="fn-container fn-social-grid">
          <div>
            <h2 className="fn-h2">What our customers say about us</h2>
            <div className="fn-testimonials">
              {TESTIMONIALS.map((t) => (
                <blockquote key={t.name} className="fn-testimonial">
                  <div className="fn-stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                    ))}
                  </div>
                  <p>&ldquo;{t.quote}&rdquo;</p>
                  <footer>
                    <strong>{t.name}</strong>
                    {t.role ? <span> • {t.role}</span> : null}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
          <div className="fn-app-block">
            <h2 className="fn-h2">Modern apps and tools</h2>
            <p className="fn-muted">Manage call forwarding, voicemail, SMS, and number porting from any device.</p>
            <div className="fn-app-preview">
              <div className="fn-app-phone-frame">
                <div className="fn-app-screen">
                  <div className="fn-app-screen-header">
                    <span className="fn-app-dot red" />
                    <span className="fn-app-dot yellow" />
                    <span className="fn-app-dot green" />
                  </div>
                  <div className="fn-app-screen-body">
                    <div className="fn-app-chip">Active Number</div>
                    <div className="fn-app-number-mock">(571) 390-0000</div>
                    <div className="fn-app-status">● Live Call Forwarding</div>
                  </div>
                </div>
              </div>
            </div>
            <button type="button" className="fn-btn-primary fn-btn-app" onClick={focusLandingSearch}>
              EXPLORE ALL TOOLS
            </button>
          </div>
        </div>
      </section>

      <section id="pricing" className="fn-section fn-faq-section">
        <div className="fn-container fn-faq-wrap">
          <h2 className="fn-h2 fn-h2-center">Frequently Asked Questions</h2>
          <div className="fn-faq-list">
            {FAQS.map((faq) => (
              <details key={faq.q} className="fn-faq-item">
                <summary>
                  {faq.q}
                  <Plus className="fn-faq-plus h-4 w-4" />
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="fn-final-cta">
        <div className="fn-container fn-final-cta-inner">
          <div className="fn-final-cta-text">
            <h2>Ready to find a number you&apos;ll remember?</h2>
            <p className="fn-final-cta-sub">Search our vast inventory of local, toll-free, and memorable vanity numbers today.</p>
          </div>
          <button type="button" className="fn-btn-white" onClick={focusLandingSearch}>
            GET STARTED NOW
          </button>
        </div>
      </section>

      <footer className="fn-footer">
        <div className="fn-container fn-footer-top">
          <div className="fn-footer-brand-row">
            <Link href="/" className="fn-logo fn-logo-footer">
              <LogoMark />
              <span>FindNumber.ai</span>
            </Link>
            <div className="fn-footer-social">
              {["f", "in", "t", "m"].map((s) => (
                <span key={s} className="fn-social-dot">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="fn-footer-cols">
            {[
              {
                label: "Company",
                links: [
                  ["About", "/contact"],
                  ["Careers", "/contact"],
                  ["Contact", "/contact"],
                ],
              },
              {
                label: "Services",
                links: [
                  ["Find a Number", "#search"],
                  ["Port a Number", "/personal/porting"],
                  ["Business Numbers", "#business"],
                  ["Toll-Free Numbers", "#search"],
                ],
              },
              {
                label: "Support",
                links: [
                  ["Help Center", "/contact"],
                  ["Porting Guide", "/personal/porting"],
                  ["Pricing & FAQs", "#pricing"],
                ],
              },
              {
                label: "Legal",
                links: [
                  ["Privacy Policy", "/privacy"],
                  ["Terms of Service", "/terms"],
                  ["SMS Marketing", "/sms-marketing"],
                ],
              },
            ].map((col) => (
              <div key={col.label}>
                <p className="fn-footer-label">{col.label}</p>
                <ul>
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
        </div>
        <div className="fn-footer-copy">
          © {new Date().getFullYear()} FindNumber.ai. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
