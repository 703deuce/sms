"use client";

import { LandingHeroSearch } from "@/components/landing/numbers/landing-hero-search";
import { LandingSearchResults } from "@/components/landing/numbers/landing-search-results";
import { LandingTopPicksNearYou } from "@/components/landing/numbers/landing-top-picks-near-you";
import { useLandingReserve } from "@/components/landing/numbers/use-landing-reserve";
import { BRAND_NAME } from "@/lib/brand";
import type { PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";
import Link from "next/link";
import { Check, Download, Search, Star } from "lucide-react";
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

const CARRIERS = ["AT&T", "Verizon", "T-Mobile", "Mint Mobile", "Cricket", "Metro"];

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
            <span>{BRAND_NAME}</span>
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
            <LandingHeroSearch
              onResults={(data) => {
                setSearchResponse(data);
              }}
              onSearching={setSearchLoading}
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
              { title: "Largest inventory", body: "Millions of local and toll-free numbers." },
              { title: "Fast porting", body: "Transfer to your carrier with guided support." },
              { title: "No hidden fees", body: "Transparent one-time pricing at checkout." },
              { title: "Mobile app", body: "Manage forwarding and voicemail on the go." },
            ].map(({ title, body }) => (
              <div key={title} className="nb-feature-card">
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <div className="nb-promo-box">
            <h3>We make phone numbers simple.</h3>
            <ul>
              <li>Buy once — no monthly number rental surprises</li>
              <li>30-day portability guarantee</li>
              <li>AI-powered search finds patterns fast</li>
              <li>Keep your current carrier and plan</li>
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
            <p className="nb-secondary-label">Mobile App Coming Soon</p>
            <h3>Manage your number anywhere</h3>
            <p className="nb-muted">Forward calls, set voicemail, and port — from your phone.</p>
            <div className="nb-phone-mock" aria-hidden />
          </div>
          <div className="nb-secondary-card">
            <p className="nb-secondary-label">Business Solutions</p>
            <h3>Built for teams that need memorable numbers</h3>
            <p className="nb-muted">Vanity numbers, bulk search, and porting for your brand.</p>
            <Link href="/contact" className="nb-link-arrow">
              Talk to sales →
            </Link>
          </div>
        </div>
      </section>

      <section id="pricing" className="nb-section nb-pricing-strip">
        <div className="nb-container nb-pricing-inner">
          <h2 className="nb-section-title">Simple pricing</h2>
          <div className="nb-pricing-row">
            {[
              { tier: "Choice", price: "From $4.99" },
              { tier: "Memorable", price: "$9.99 – $19.99" },
              { tier: "Premium", price: "From $29.99" },
              { tier: "Business Vanity", price: "Custom" },
            ].map(({ tier, price }) => (
              <div key={tier} className="nb-pricing-chip">
                <strong>{tier}</strong>
                <span>{price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="nb-footer">
        <div className="nb-container nb-footer-share">
          <h3>Help your friends find your number</h3>
          <div className="nb-social-share">
            {["F", "X", "I", "L"].map((network) => (
              <span key={network} className="nb-social-btn" aria-hidden>
                {network}
              </span>
            ))}
          </div>
        </div>

        <div className="nb-container nb-footer-account">
          <div>
            <h3>Manage your account</h3>
            <p className="nb-muted">Sign in to reserve numbers and track ports.</p>
          </div>
          <Link href="/login" className="nb-btn-outline nb-btn-dark-outline">
            <Download className="h-4 w-4" />
            Sign In
          </Link>
        </div>

        <div className="nb-container nb-footer-links-grid">
          {[
            {
              label: "Help",
              links: [
                ["FAQ", "/contact"],
                ["Porting", "/personal/porting"],
                ["Support", "/contact"],
              ],
            },
            {
              label: "Search",
              links: [
                ["Local", "#search"],
                ["Toll-Free", "#search"],
                ["Vanity", "#search"],
              ],
            },
            {
              label: "About",
              links: [
                ["Company", "/contact"],
                ["Careers", "/contact"],
                ["Contact", "/contact"],
              ],
            },
            {
              label: "Legal",
              links: [
                ["Privacy", "/privacy"],
                ["Terms", "/terms"],
                ["SMS Marketing", "/sms-marketing"],
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

        <section className="nb-footer-cta">
          <div className="nb-container nb-footer-cta-inner">
            <h2>Ready to find a number you&apos;ll actually love?</h2>
            <button type="button" className="nb-btn-primary" onClick={focusLandingSearch}>
              Search Now
            </button>
          </div>
        </section>

        <div className="nb-container nb-footer-bottom">
          <div className="nb-footer-brand">
            <LogoMark />
            <span>{BRAND_NAME}</span>
          </div>
          <div className="nb-footer-social">
            {["F", "X", "I", "L"].map((network) => (
              <span key={network} className="nb-social-btn nb-social-btn-sm" aria-hidden>
                {network}
              </span>
            ))}
          </div>
          <p className="nb-footer-copy">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
