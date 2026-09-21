"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  MessageSquare,
  Phone,
  PhoneMissed,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import "../landing.css";
import "./mctb-landing.css";
import { MctbHeroMockup } from "./mctb-hero-mockup";

const SIGNUP = "/signup?next=/onboarding/mctb";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#industries", label: "Industries" },
  { href: "#faq", label: "FAQ" },
  { href: "/contact", label: "Book a Demo" },
];

const FAQS = [
  {
    q: "Do I have to change my business phone number?",
    a: "No. Transovo is designed to work with your existing business number using unanswered-call forwarding.",
  },
  {
    q: "What happens when I answer the call?",
    a: "Nothing changes. You answer and handle the call normally.",
  },
  {
    q: "What happens when I miss the call?",
    a: "The unanswered call can be forwarded to Transovo, where the caller is offered the option to continue by text.",
  },
  {
    q: "Does every missed caller automatically receive a text?",
    a: "No. The caller must choose to receive the text by pressing 1. If they don't press 1, no SMS is sent.",
  },
  {
    q: "Can customers reply to the text?",
    a: "Yes. Once they've opted in, they can continue the conversation by SMS.",
  },
  {
    q: "Can customers opt out?",
    a: "Yes. Customers can reply STOP to opt out.",
  },
  {
    q: "Can I use my existing booking link?",
    a: "Yes. You can send customers your existing booking link through the conversation.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Transovo offers a free plan so businesses can get started before upgrading.",
  },
  {
    q: "What if my business is closed?",
    a: "Callers can choose text and leave their message so your team can respond when you're back.",
  },
];

function TransovoLogoMark() {
  return (
    <span className="lp-logo-mark" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon.svg" alt="" width={22} height={22} />
    </span>
  );
}

export function MctbLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="landing mctb-landing">
      <header className="lp-nav">
        <div className="lp-container">
          <div className="lp-nav-inner">
            <Link href="/" className="lp-logo">
              <TransovoLogoMark />
              {BRAND_NAME}
            </Link>
            <nav className="lp-nav-links" aria-label="Primary">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>{item.label}</Link>
              ))}
              <Link href="/appointments">Appointments</Link>
            </nav>
            <div className="lp-nav-actions">
              <Link href="/login?next=/mctb" className="lp-login">Log in</Link>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary lp-btn-sm">Start Free</Link>
              <button
                type="button"
                className="lp-menu-btn"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className={`lp-mobile-menu${menuOpen ? " open" : ""}`}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="/appointments" onClick={() => setMenuOpen(false)}>Appointments</Link>
            <Link href="/login?next=/mctb" onClick={() => setMenuOpen(false)}>Log in</Link>
            <Link href={SIGNUP} onClick={() => setMenuOpen(false)}>Start Free</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero" id="top">
          <div className="lp-blob lp-blob-1" aria-hidden />
          <div className="lp-blob lp-blob-2" aria-hidden />
          <div className="lp-container">
            <div className="mctb-hero-grid">
              <div>
                <p className="lp-eyebrow">Missed call text back</p>
                <h1 className="lp-hero-title">Stop Letting Missed Calls Become Missed Customers.</h1>
                <p className="lp-hero-copy">
                  When you can&apos;t answer the phone, Transovo gives callers the option to continue
                  the conversation by text — automatically.
                </p>
                <p className="mctb-highlight" style={{ marginTop: "0.75rem" }}>
                  No new business number. No changing the number your customers already know.
                </p>
                <div className="lp-hero-actions" style={{ marginTop: "1.5rem" }}>
                  <Link href={SIGNUP} className="lp-btn lp-btn-primary">
                    Start Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="#how-it-works" className="lp-btn lp-btn-secondary">See How It Works</Link>
                </div>
                <p className="mctb-trust-line">
                  Free plan available • Keep your existing business number • Set up in minutes
                </p>
              </div>
              <MctbHeroMockup />
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="features">
          <div className="lp-container">
            <div className="lp-section-center">
              <p className="lp-eyebrow">The cost of a missed call</p>
              <h2>You Can&apos;t Answer Every Call. But You Don&apos;t Have to Lose the Opportunity.</h2>
              <p className="lp-lead">
                You&apos;re with another customer. You&apos;re on a job. It&apos;s after hours. Your team is
                busy. Whatever the reason, calls get missed — and callers don&apos;t always leave voicemail.
              </p>
            </div>
            <div className="mctb-problem-grid">
              <article className="mctb-problem-card">
                <PhoneMissed className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>They Don&apos;t Leave Voicemails</h3>
                <p>Many callers would rather send a quick text than leave a message and wait.</p>
              </article>
              <article className="mctb-problem-card">
                <Phone className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>They May Call Someone Else</h3>
                <p>A missed call can turn into a competitor&apos;s next customer.</p>
              </article>
              <article className="mctb-problem-card">
                <Clock className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>Calling Back Takes Time</h3>
                <p>By the time you&apos;re free, the caller may already have moved on.</p>
              </article>
            </div>
            <p className="lp-section-center mctb-highlight" style={{ marginTop: "2rem", textAlign: "center" }}>
              Turn the missed call into a conversation instead.
            </p>
          </div>
        </section>

        <section className="lp-section" id="how-it-works">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>From Missed Call to Text Conversation in Seconds.</h2>
              <p className="lp-lead">
                You keep using your existing business phone number. Transovo only steps in when you
                don&apos;t answer.
              </p>
            </div>
            <div className="mctb-steps-4">
              {[
                {
                  n: "01",
                  title: "They Call Your Business",
                  body: "Customers call the same business number they already use today. No new number to advertise.",
                },
                {
                  n: "02",
                  title: "You Don't Answer",
                  body: "Your existing phone service forwards the unanswered call to Transovo.",
                },
                {
                  n: "03",
                  title: "They Choose Text",
                  body: "The caller hears a short disclosure and presses 1 if they want to continue by text.",
                },
                {
                  n: "04",
                  title: "The Conversation Starts",
                  body: "Transovo sends the first message and the customer can reply.",
                },
              ].map((step) => (
                <div key={step.n} className="mctb-step-card">
                  <div className="mctb-step-num">{step.n}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
            <div className="mctb-trust-callout">
              No Press 1? No Text. — If the caller doesn&apos;t choose to receive a text, Transovo
              doesn&apos;t send one.
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">Keep your number</p>
              <h2>Keep the Business Number You&apos;ve Already Built.</h2>
              <p>
                Your phone number may already be on your website, Google Business Profile, business
                cards, trucks, signs, ads, directories, and customer contacts.
              </p>
              <p className="mctb-highlight" style={{ marginTop: "1rem" }}>
                With Transovo, you don&apos;t replace it.
              </p>
              <p style={{ marginTop: "0.75rem" }}>
                Customers continue calling your existing number. When you answer, nothing changes.
                When you don&apos;t, Transovo can take it from there.
              </p>
            </div>
            <div className="mctb-number-hub">
              <p className="mctb-mock-label">Your existing business number</p>
              <p className="mctb-mock-title">(571) 555-0142</p>
              <div className="mctb-source-tags">
                {["Website", "Google", "Business cards", "Truck", "Signs", "Ads", "Contacts"].map(
                  (t) => (
                    <span key={t}>{t}</span>
                  ),
                )}
              </div>
              <p className="mctb-flow-arrow">No answer → Forward to Transovo</p>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container mctb-split mctb-split-60-40 reverse">
            <div className="mctb-split-visual">
              <div className="mctb-phone-mock">
                <p className="mctb-mock-label">SMS conversation</p>
                <div className="mctb-bubble system">
                  You&apos;re subscribed to texts about your inquiry to Lakeside Dental. Reply STOP to
                  opt out.
                </div>
                <div className="mctb-bubble customer" style={{ marginTop: "0.5rem" }}>
                  Hi, I was calling about getting a cleaning this week.
                </div>
                <div className="mctb-bubble system" style={{ marginTop: "0.5rem" }}>
                  Absolutely. What day works best for you?
                </div>
              </div>
            </div>
            <div>
              <p className="lp-eyebrow">Customer experience</p>
              <h2>Simple for You. Even Simpler for Your Customers.</h2>
              <p>No apps to download and no complicated forms.</p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>They call.</li>
                <li>You can&apos;t answer.</li>
                <li>They choose text.</li>
                <li>They send you what they need.</li>
              </ul>
              <p className="mctb-highlight" style={{ marginTop: "1rem" }}>
                What started as a missed call is now an active customer conversation.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split" style={{ gridTemplateColumns: "1fr" }}>
            <div className="mctb-split" style={{ gap: "2rem" }}>
              <div>
                <p className="lp-eyebrow">Customer choice</p>
                <h2>Customers Choose Whether They Want to Text.</h2>
                <p>
                  After an unanswered call reaches Transovo, the caller hears the text-message
                  disclosure and can press 1 to consent. If they don&apos;t press 1, no SMS is sent.
                </p>
              </div>
              <div className="mctb-consent-grid">
                {[
                  ["Press-1 Opt-In", "The customer actively chooses to receive the text."],
                  ["Consent Recorded", "The opt-in is recorded and stored."],
                  ["STOP & HELP Support", "Standard SMS opt-out and help commands."],
                  ["Clear Identification", "Messages identify Transovo as the messaging platform."],
                ].map(([title, body]) => (
                  <div key={title} className="mctb-problem-card">
                    <Shield className="h-5 w-5 text-indigo-500" aria-hidden />
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container mctb-after-hours mctb-split mctb-split-60-40">
            <div>
              <p className="lp-eyebrow" style={{ color: "#a5b4fc" }}>After hours</p>
              <h2>Your Business May Be Closed. Your Next Customer Isn&apos;t.</h2>
              <p style={{ color: "#cbd5e1" }}>
                Calls don&apos;t stop when your office closes. Give after-hours callers another option
                instead of voicemail-only.
              </p>
            </div>
            <div className="mctb-phone-mock">
              <p className="mctb-mock-label">8:37 PM · Closed</p>
              <div className="mctb-bubble system">
                Lakeside Dental is closed right now. Leave a message and we&apos;ll respond when we&apos;re
                back. Reply STOP to opt out.
              </div>
              <div className="mctb-bubble customer" style={{ marginTop: "0.5rem" }}>
                Hi, I&apos;d like to schedule a cleaning next week.
              </div>
              <span className="mctb-chip">Waiting for business reply</span>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">One inbox</p>
              <h2>All Your Missed-Call Conversations in One Place.</h2>
              <p>See who tried to reach you and continue the conversation without chasing voicemails.</p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>Unified conversations</li>
                <li>Customer replies</li>
                <li>Conversation history</li>
                <li>Missed-call context</li>
              </ul>
            </div>
            <div className="mctb-inbox-mock" aria-hidden>
              <div className="mctb-inbox-list">
                <div className="active">Sarah M.<br />Missed call → Text</div>
                <div>David R.<br />New reply</div>
                <div>Maria T.<br />Waiting</div>
              </div>
              <div className="mctb-inbox-pane">
                <p><strong>Origin:</strong> Missed call · <strong>Consent:</strong> Recorded</p>
                <div className="mctb-bubble customer" style={{ marginTop: "0.5rem" }}>
                  Do you have openings Thursday?
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Respond Immediately — Even When You Can&apos;t.</h2>
              <p className="lp-lead">Useful information as soon as the text conversation begins.</p>
            </div>
            <div className="mctb-sms-cards">
              {[
                ["Busy right now", "We're helping another customer. Send us what you need and we'll get back to you shortly."],
                ["After hours", "We're closed right now. Leave a message and we'll respond when we're back."],
                ["Next step", "Thanks for reaching out. Tell us how we can help and we'll take it from here."],
              ].map(([title, preview]) => (
                <article key={title} className="mctb-sms-card">
                  <MessageSquare className="h-5 w-5 text-indigo-500" aria-hidden />
                  <h3>{title}</h3>
                  <div className="mctb-sms-preview">{preview}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split mctb-split-60-40">
            <div className="mctb-phone-mock">
              <div className="mctb-bubble customer">Do you have anything available Thursday?</div>
              <div className="mctb-bubble system" style={{ marginTop: "0.5rem" }}>
                We&apos;d be happy to help. You can choose an available time here:
              </div>
              <div className="lp-btn lp-btn-primary lp-btn-sm" style={{ marginTop: "0.75rem", display: "inline-flex" }}>
                Choose a time →
              </div>
            </div>
            <div>
              <p className="lp-eyebrow">Optional booking</p>
              <h2>Need to Schedule? Send Them Straight to Booking.</h2>
              <p>
                Send your booking link and let the customer choose a time — simple for them, less
                back-and-forth for your team.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-section" id="industries">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Built for Businesses Where Every Call Matters.</h2>
            </div>
            <div className="mctb-industry-grid">
              {[
                ["Home Services", "Plumbers, HVAC, electricians, roofers, cleaners, landscapers, and contractors."],
                ["Dental & Healthcare", "Give unanswered callers another way to reach the office."],
                ["Salons & Personal Care", "Capture inquiries while you're with another client."],
                ["Automotive", "Keep service inquiries moving when the phone isn't answered."],
                ["Professional Services", "Turn missed inquiries into conversations to follow up."],
                ["Local Businesses", "When customers call to buy, book, or ask questions, MCTB helps."],
              ].map(([title, body]) => (
                <article key={title} className="mctb-industry-card">
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="mctb-free-panel">
              <p className="lp-eyebrow">Free plan available</p>
              <h2>Start Turning Missed Calls Into Conversations for Free.</h2>
              <p className="lp-lead">
                Set it up, connect your existing business number, and see how it works with real missed
                calls — then upgrade when you need more capacity.
              </p>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary" style={{ marginTop: "1.25rem" }}>
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mctb-trust-line">No need to change your existing business number.</p>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">Why Transovo</p>
              <h2>Missed Call Text Back Without Rebuilding Your Phone System.</h2>
              <p>Most businesses need a better way to handle the calls they&apos;re already missing.</p>
            </div>
            <div className="mctb-benefit-stack">
              {[
                ["Keep Your Number", "Continue using the number customers already know."],
                ["Only Steps In When Needed", "Answer normally and nothing changes."],
                ["Explicit Customer Opt-In", "Texting starts only after the caller chooses it."],
                ["Fast Follow-Up", "Create a conversation while interest is still fresh."],
                ["Free Plan Available", "Start before committing to a paid plan."],
                ["Built for Real Businesses", "Designed for when you're too busy to pick up."],
              ].map(([title, body]) => (
                <div key={title} className="mctb-benefit-row">
                  <Phone className="h-5 w-5 text-indigo-500 shrink-0" aria-hidden />
                  <div>
                    <strong>{title}</strong>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--lp-muted)" }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="faq">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Frequently Asked Questions</h2>
            </div>
            <div className="lp-faq-grid">
              {FAQS.map((faq, index) => (
                <div key={faq.q} className={`lp-faq-item${openFaq === index ? " open" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    aria-expanded={openFaq === index}
                  >
                    {faq.q}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <div className="lp-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="appt-cta-band">
          <div className="lp-container lp-section-center">
            <h2>The Next Call You Miss Doesn&apos;t Have to Be the Next Customer You Lose.</h2>
            <p className="lp-lead">
              Keep your existing number. When you can&apos;t answer, give the caller another way to reach you.
            </p>
            <div className="lp-hero-actions" style={{ justifyContent: "center" }}>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#how-it-works" className="lp-btn lp-btn-secondary">See How It Works</Link>
            </div>
            <p className="mctb-trust-line">Turn missed calls into conversations with Transovo.</p>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div>
              <Link href="/" className="lp-logo">
                <TransovoLogoMark />
                {BRAND_NAME}
              </Link>
              <p className="lp-footer-tag">
                Missed call text back — turn unanswered calls into SMS conversations customers choose.
              </p>
              <p className="mctb-footer-disclosure">
                Transovo provides conversational messaging services for participating businesses. Message
                frequency may vary. Standard message and data rates may apply. Reply STOP to opt out. Reply
                HELP for help.
              </p>
            </div>
            <div className="lp-footer-cols">
              <div>
                <h4>Product</h4>
                <Link href="#how-it-works">How it works</Link>
                <Link href="/appointments">Appointments</Link>
                <Link href={SIGNUP}>Start Free</Link>
                <Link href="/login?next=/mctb">Login</Link>
              </div>
              <div>
                <h4>Contact</h4>
                <Link href="/contact">Contact</Link>
                <Link href="/contact">Book a Demo</Link>
              </div>
              <div>
                <h4>Legal</h4>
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/acceptable-use">Acceptable Use</Link>
              </div>
            </div>
          </div>
          <div className="lp-footer-legal">
            <p className="lp-footer-copy">
              © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
