"use client";

import { LandingSearchResults } from "@/components/landing/numbers/landing-search-results";
import { LandingTopPicksNearYou } from "@/components/landing/numbers/landing-top-picks-near-you";
import { useLandingReserve } from "@/components/landing/numbers/use-landing-reserve";
import { PersonalFindNumberClient } from "@/components/numbers/personal-find-number-ui";
import type { PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";
import {
  isPortInHiddenAtLaunch,
  isSmsMarketingHiddenAtLaunch,
} from "@/lib/workspace/platform-launch";
import Link from "next/link";
import {
  Briefcase,
  Check,
  Globe,
  Plus,
  Search,
  Shield,
  Smartphone,
  Star,
  Zap,
} from "lucide-react";
import { useState } from "react";
import "./numbers-landing.css";

const NAV = [
  { href: "#search", label: "Buy a Number" },
  ...(isPortInHiddenAtLaunch()
    ? [{ href: "/personal/porting?tab=out", label: "Port Out" }]
    : [{ href: "/personal/porting", label: "Port a Number" }]),
  { href: "#business", label: "Business Solutions" },
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Resources" },
  { href: "/contact", label: "Help" },
];

const CARRIERS = ["AT&T", "Verizon", "T-Mobile", "Mint Mobile", "Cricket", "Metro"];

const TRUST_POINTS = [
  {
    title: "Starting at $4.99",
    body: "Most numbers are ordinary carrier inventory priced for impulse buys — nicer patterns step up naturally.",
  },
  {
    title: "Keep your carrier",
    body: "Buy the number you want, then port it to Verizon, AT&T, T-Mobile, and other supported carriers.",
  },
  {
    title: "30-day portability guarantee",
    body: "Start your port within 30 days. If your carrier rejects a qualifying transfer, we help or refund per policy.",
  },
];

const FAQS = [
  {
    q: "How does the process work?",
    a: "Search, purchase your favorite number, then port it to your carrier or use our forwarding tools.",
  },
  {
    q: "Can I use my number with any provider?",
    a: "Most local and toll-free numbers can be ported to major US carriers and supported VoIP providers.",
  },
  {
    q: "Are there any hidden fees?",
    a: "No. The marketplace price is shown before checkout, and optional services are clearly separated.",
  },
  {
    q: "How long does porting take?",
    a: "Many mobile ports complete within a few business days; timing varies by number type and carrier.",
  },
  {
    q: "What if I can't port my number?",
    a: "Start your port within 30 days and our support team will help or apply the portability guarantee.",
  },
  {
    q: "Can I reserve a number without transferring it right away?",
    a: "Yes. You can securely hold your number until you are ready to activate or port it.",
  },
];

function LogoMark() {
  return (
    <span className="nb-logo-mark" aria-hidden>
      T
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
    const logId = searchResponse?.searchLogId ?? shelfSearchLogId;
    void reserveNumber(item, logId);
  }

  return (
    <div className="numbers-landing">
      <header className="nb-nav">
        <div className="nb-container nb-nav-inner">
          <Link href="/" className="nb-logo">
            <LogoMark />
            <span>Transovo AI</span>
          </Link>
          <nav className="nb-nav-links">
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
            <button type="button" className="nb-nav-search" onClick={focusLandingSearch} aria-label="Search">
              <Search className="h-4 w-4" />
            </button>
          </nav>
          <Link href="/login" className="nb-btn-primary nb-btn-nav">
            Get Started
          </Link>
        </div>
      </header>

      <section id="search" className="nb-hero">
        <div className="nb-container nb-hero-grid">
          <div className="nb-hero-copy">
            <h1 className="nb-hero-title">Choose a phone number you&apos;ll actually remember.</h1>
            <p className="nb-hero-subtitle">
              Don&apos;t settle for a random phone number. Build your brand and be more accessible with
              a custom phone number from the world&apos;s largest marketplace.
            </p>
            <ul className="nb-hero-checklist">
              {["Texting & calling", "Port to your favorite carrier", "World-class customer service"].map(
                (item) => (
                  <li key={item}>
                    <Check className="h-4 w-4" strokeWidth={3} />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <div className="nb-hero-actions">
              <button type="button" className="nb-btn-primary" onClick={focusLandingSearch}>
                Search Now
              </button>
              <a href="#pricing" className="nb-btn-outline">
                See Pricing
              </a>
            </div>
            <div className="nb-hero-reviews">
              <span className="nb-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#f97316] text-[#f97316]" />
                ))}
              </span>
              <span>4.8 out of 5 based on 2,500+ reviews</span>
            </div>
          </div>
          <div className="nb-hero-search-wrap">
            <PersonalFindNumberClient
              workspaceId="public-landing"
              publicLanding={{}}
              hidePageHeader
              hidePublicSidebar
              searchCardOnly
              onSearchResults={setSearchResponse}
              onSearchingChange={setSearchLoading}
            />
            {searchLoading ? <p className="nb-hero-search-loading">Searching inventory…</p> : null}
          </div>
        </div>
      </section>

      <LandingTopPicksNearYou
        onShelfSearchLogId={setShelfSearchLogId}
        onGetNumber={handleGetNumber}
        reserving={reserving}
      />

      {reserveError ? (
        <div className="nb-container">
          <p className="nb-inline-error">{reserveError}</p>
        </div>
      ) : null}

      <LandingSearchResults
        response={searchResponse}
        reserving={reserving}
        onGetNumber={handleGetNumber}
      />

      <section className="nb-carriers">
        <div className="nb-container nb-carriers-row">
          {CARRIERS.map((name) => (
            <span key={name} className="nb-carrier-logo">
              {name}
            </span>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="nb-section nb-how">
        <div className="nb-container nb-how-inner">
          <h2 className="nb-section-title nb-section-title-center">How it works</h2>
          <div className="nb-how-steps">
            {[
              {
                n: 1,
                title: "Search",
                body: "Enter a name, word, or number to find your perfect match.",
              },
              { n: 2, title: "Buy", body: "Add it to your cart and check out." },
              {
                n: 3,
                title: "Port or forward",
                body: "Move your number to your current provider or use it with our service.",
              },
            ].map((step) => (
              <div key={step.n} className="nb-how-step">
                <div className="nb-how-step-num">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nb-section nb-why">
        <div className="nb-container nb-why-grid">
          <div className="nb-features-grid">
            {[
              { icon: Globe, title: "Extensive inventory", body: "Millions of local and toll-free numbers." },
              { icon: Zap, title: "Fast transfer", body: "Transfer to your carrier with guided support." },
              { icon: Smartphone, title: "Instant activation", body: "Reserve online and get started quickly." },
              { icon: Shield, title: "Secure process", body: "Protected checkout and verified inventory." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="nb-feature-card">
                <Icon className="nb-feature-icon" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <div className="nb-promo-box">
            <Shield className="nb-promo-icon" />
            <h3>The FindNumber.ai Guarantee</h3>
            <ul>
              <li>Secure checkout</li>
              <li>Instant number ownership</li>
              <li>30-day portability guarantee</li>
              <li>Transparent pricing — no hidden fees</li>
            </ul>
            <button type="button" className="nb-btn-white" onClick={focusLandingSearch}>
              Search Now
            </button>
          </div>
        </div>
      </section>

      <section id="business" className="nb-section nb-secondary-blocks">
        <div className="nb-container nb-secondary-grid">
          <div className="nb-secondary-card">
            <div className="nb-usecase-heading">
              <Smartphone className="nb-usecase-icon" />
              <h3>Personal Use</h3>
            </div>
            <p className="nb-muted">
              Pick digits that reflect you — memorable, local, and easy to share with friends and family.
            </p>
            <ul className="nb-usecase-list">
              <li>Easy-to-remember personal numbers</li>
              <li>Port to your current mobile carrier</li>
              <li>No contracts or hidden fees</li>
            </ul>
            <button type="button" className="nb-link-button" onClick={focusLandingSearch}>
              Find a personal number →
            </button>
          </div>
          <div className="nb-secondary-card">
            <div className="nb-usecase-heading">
              <Briefcase className="nb-usecase-icon" />
              <h3>Business Use</h3>
            </div>
            <p className="nb-muted">
              Give customers a number they remember. Vanity and keyword numbers make your brand stand out.
            </p>
            <ul className="nb-usecase-list">
              <li>Local and toll-free vanity options</li>
              <li>Memorable numbers for every campaign</li>
              <li>Forward calls or port to your provider</li>
            </ul>
            <button type="button" className="nb-link-button" onClick={focusLandingSearch}>
              Explore business numbers →
            </button>
          </div>
        </div>
      </section>

      <section className="nb-section nb-social-proof">
        <div className="nb-container nb-social-grid">
          <div>
            <h2 className="nb-section-title">Why Transovo</h2>
            <div className="nb-testimonials">
              {TRUST_POINTS.map((point) => (
                <blockquote key={point.title} className="nb-testimonial">
                  <p>
                    <strong>{point.title}.</strong> {point.body}
                  </p>
                </blockquote>
              ))}
            </div>
          </div>
          <div className="nb-tools-card">
            <h2 className="nb-section-title">Included with your number</h2>
            <p className="nb-muted">Forwarding, voicemail, transcription, call activity, and port-out tools.</p>
            <ul className="nb-usecase-list">
              <li>Number Vault parking</li>
              <li>Forward to your cell</li>
              <li>Voicemail with transcription</li>
              <li>Port-out credentials when you are ready</li>
            </ul>
            <button type="button" className="nb-btn-primary nb-tools-button" onClick={focusLandingSearch}>
              Find your number
            </button>
          </div>
        </div>
      </section>

      <section id="pricing" className="nb-section nb-faq-section">
        <div className="nb-container nb-faq-wrap">
          <h2 className="nb-section-title nb-section-title-center">Frequently Asked Questions</h2>
          <div className="nb-faq-list">
            {FAQS.map((faq) => (
              <details key={faq.q} className="nb-faq-item">
                <summary>
                  {faq.q}
                  <Plus className="h-4 w-4" />
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="nb-footer-cta">
        <div className="nb-container nb-footer-cta-inner nb-footer-cta-row">
          <div>
            <h2>Ready to find a number you&apos;ll remember?</h2>
            <p>Search local, toll-free, and memorable vanity numbers today.</p>
          </div>
          <button type="button" className="nb-btn-primary" onClick={focusLandingSearch}>
            Get Started Now
          </button>
        </div>
      </section>

      <footer className="nb-footer">
        <div className="nb-container nb-footer-links-grid">
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
                ...(isPortInHiddenAtLaunch()
                  ? [["Port Out", "/personal/porting?tab=out"]]
                  : [["Port a Number", "/personal/porting"]]),
                ["Business Numbers", "#business"],
              ],
            },
            {
              label: "Support",
              links: [
                ["Help Center", "/contact"],
                ...(isPortInHiddenAtLaunch()
                  ? [["Port Out Help", "/personal/porting?tab=out"]]
                  : [["Porting Help", "/personal/porting"]]),
                ["FAQ", "#pricing"],
              ],
            },
            {
              label: "Legal",
              links: [
                ["Privacy", "/privacy"],
                ["Terms", "/terms"],
                ...(isSmsMarketingHiddenAtLaunch() ? [] : [["SMS Marketing", "/sms-marketing"]]),
              ],
            },
          ].map((col) => (
            <div key={col.label}>
              <p className="nb-footer-col-label">{col.label}</p>
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

        <div className="nb-container nb-footer-bottom">
          <div className="nb-footer-brand">
            <LogoMark />
            <span>FindNumber.ai</span>
          </div>
          <div className="nb-footer-social">
            {["F", "X", "I", "L"].map((network) => (
              <span key={network} className="nb-social-btn nb-social-btn-sm" aria-hidden>
                {network}
              </span>
            ))}
          </div>
          <p className="nb-footer-copy">
            © {new Date().getFullYear()} FindNumber.ai. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
