"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  Inbox,
  MessageSquare,
  Phone,
  PhoneMissed,
  Printer,
  Shield,
  Menu,
  Users,
  Voicemail,
  X,
  CheckCircle2,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import "../landing.css";
import "./mctb-landing.css";
import { mctbSignupNextQuery } from "@/lib/mctb/onboarding/entry-path";
import { MctbHeroMockup } from "./mctb-hero-mockup";

const SIGNUP = mctbSignupNextQuery();

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#features", label: "Missed calls" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#industries", label: "Industries" },
  { href: "#faq", label: "FAQ" },
  { href: "/contact", label: "Book a demo" },
];

const PLATFORM = [
  {
    icon: PhoneMissed,
    title: "Missed call text back",
    body: "Turn unanswered calls into SMS with Press-1 consent or existing permission — templates, one automatic ack, team alerts, and handled tracking.",
    href: "#how-it-works",
  },
  {
    icon: Calendar,
    title: "Appointments & reminders",
    body: "Online booking, calendar, and SMS reminders so customers can schedule without phone tag.",
    href: "/appointments",
  },
  {
    icon: Inbox,
    title: "Conversations",
    body: "One inbox for recovery texts and customer replies — with missed-call context on every thread.",
    href: "/login?next=/conversations",
  },
  {
    icon: Users,
    title: "Contacts",
    body: "Every caller and texter in one place, ready for follow-up when your team is free.",
    href: "/login?next=/contacts",
  },
  {
    icon: Voicemail,
    title: "Visual voicemail",
    body: "Listen, read transcripts, and follow up from a dedicated voicemail workspace.",
    href: "/login?next=/mctb/voicemail",
  },
  {
    icon: Printer,
    title: "Transovo Fax",
    body: "Send and receive fax in the same workspace — no separate fax machine required.",
    href: "/fax",
  },
];

const FAQS = [
  {
    q: "Do I have to change my business phone number?",
    a: "No. Missed call text back works with your existing business number using unanswered-call forwarding.",
  },
  {
    q: "What happens when I answer the call?",
    a: "Nothing changes. You answer and handle the call normally — Transovo only steps in when you don't.",
  },
  {
    q: "How does consent work for texting?",
    a: "Choose Press-1 (caller hears a disclosure and presses 1 to opt in) or existing permission (you attest you already have permission to text — common for businesses with prior customer relationships). Press-1 sends a compliance confirmation text before your recovery message.",
  },
  {
    q: "Does every missed caller automatically receive a text?",
    a: "With Press-1, no — the caller must press 1. With existing permission, recovery texts send per your configuration when a call is missed. Opt-outs and exclusions are always honored.",
  },
  {
    q: "Is this an AI chatbot that keeps texting customers?",
    a: "No. You configure recovery templates and optional one automatic acknowledgment. Your team replies from Conversations — or marks leads handled when you're done.",
  },
  {
    q: "Can customers reply and opt out?",
    a: "Yes. Customers can reply by SMS. They can reply STOP to opt out at any time.",
  },
  {
    q: "Can I use my existing booking link?",
    a: "Yes. Send your booking link from Conversations, or use Transovo Appointments for scheduling and reminders.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Start on the free plan and upgrade when you need more capacity.",
  },
  {
    q: "What else is included in Transovo?",
    a: "V1 includes missed call text back, appointments, conversations, contacts, visual voicemail, and fax — one login for daily operations.",
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
            </nav>
            <div className="lp-nav-actions">
              <Link href="/login?next=/mctb" className="lp-login">Log in</Link>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary lp-btn-sm">Start free</Link>
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
            <Link href="/login?next=/mctb" onClick={() => setMenuOpen(false)}>Log in</Link>
            <Link href={SIGNUP} onClick={() => setMenuOpen(false)}>Start free</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero mctb-hero-opus" id="top">
          <div className="lp-blob lp-blob-1" aria-hidden />
          <div className="lp-blob lp-blob-2" aria-hidden />
          <div className="lp-container">
            <div className="mctb-hero-grid">
              <div>
                <p className="lp-eyebrow">Service businesses · One workspace</p>
                <h1 className="lp-hero-title">
                  Missed calls, appointments, and conversations — without changing your number.
                </h1>
                <p className="lp-hero-copy">
                  Transovo helps you recover missed calls by text, book customers online, and keep every
                  reply in one inbox — with compliance built in, not bolted on.
                </p>
                <p className="mctb-highlight" style={{ marginTop: "0.75rem" }}>
                  Keep the business line customers already know. Set up in minutes.
                </p>
                <div className="lp-hero-actions" style={{ marginTop: "1.5rem" }}>
                  <Link href={SIGNUP} className="lp-btn lp-btn-primary">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="#platform" className="lp-btn lp-btn-secondary">See the platform</Link>
                </div>
                <p className="mctb-trust-line">
                  Free plan · Press-1 or existing permission · Voicemail · Fax · Team notifications
                </p>
              </div>
              <MctbHeroMockup />
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="platform">
          <div className="lp-container">
            <div className="lp-section-center">
              <p className="lp-eyebrow">What you get</p>
              <h2>Everything in V1 — built for when the phone rings and you can&apos;t answer.</h2>
              <p className="lp-lead">
                Missed call text back is the hero — and it sits alongside the tools you need to book,
                reply, and follow through.
              </p>
            </div>
            <div className="mctb-platform-grid">
              {PLATFORM.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="mctb-platform-card">
                    <div className="mctb-platform-icon" aria-hidden>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <Link href={item.href} className="mctb-platform-link">
                      Learn more
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lp-section" id="features">
          <div className="lp-container">
            <div className="lp-section-center">
              <p className="lp-eyebrow">The cost of a missed call</p>
              <h2>You can&apos;t answer every call. You don&apos;t have to lose the lead.</h2>
              <p className="lp-lead">
                You&apos;re on a job, with another customer, or closed for the day. Callers often won&apos;t
                leave voicemail — but many will text if you give them a compliant path.
              </p>
            </div>
            <div className="mctb-problem-grid">
              <article className="mctb-problem-card">
                <PhoneMissed className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>Voicemail isn&apos;t enough</h3>
                <p>Callers expect a fast text-back, not a one-way message into the void.</p>
              </article>
              <article className="mctb-problem-card">
                <Phone className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>Speed wins</h3>
                <p>A missed call can become your competitor&apos;s booked job if you wait until tomorrow.</p>
              </article>
              <article className="mctb-problem-card">
                <Clock className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>Your team stays in control</h3>
                <p>Automatic recovery and one ack — then humans reply, call back, or mark handled.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="how-it-works">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>From missed call to follow-up in seconds.</h2>
              <p className="lp-lead">
                Forward unanswered calls to Transovo. Choose how you establish permission to text — then
                use the recovery flow your team actually runs.
              </p>
            </div>
            <div className="mctb-steps-4">
              {[
                {
                  n: "01",
                  title: "They call your line",
                  body: "Customers dial the same number on your site, Google, and truck — you answer when you can.",
                },
                {
                  n: "02",
                  title: "No answer → Transovo",
                  body: "Your carrier forwards the unanswered call. We classify the miss and start recovery eligibility.",
                },
                {
                  n: "03",
                  title: "Permission to text",
                  body: "Press-1: disclosure + keypress. Existing permission: voicemail + automatic recovery per your attestation.",
                },
                {
                  n: "04",
                  title: "Recover & follow up",
                  body: "Compliance + recovery texts, optional one ack, team notified, conversation in your inbox.",
                },
              ].map((step) => (
                <div key={step.n} className="mctb-step-card">
                  <div className="mctb-step-num">{step.n}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
            <div className="mctb-dual-consent-banner">
              <div>
                <strong>Press-1</strong>
                <p>Caller opts in on the call. Compliance text, then your recovery opener.</p>
              </div>
              <div>
                <strong>Existing permission</strong>
                <p>You confirm prior consent. Recovery text without Press-1 audio.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">Keep your number</p>
              <h2>The number on your truck stays the number customers call.</h2>
              <p>
                Transovo is an inbound layer — not a replacement line. Answer normally when you&apos;re
                available; forward when you&apos;re not.
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

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split mctb-split-60-40 reverse">
            <div className="mctb-split-visual">
              <div className="mctb-phone-mock mctb-phone-mock-wide">
                <p className="mctb-mock-label">Deterministic recovery — not endless automation</p>
                <div className="mctb-bubble business">
                  <p className="mctb-bubble-kicker">Your recovery template</p>
                  <p>Sorry we missed you — reply with what you need and we&apos;ll call back shortly.</p>
                </div>
                <div className="mctb-bubble customer" style={{ marginTop: "0.5rem" }}>
                  <p>Need a service call Thursday AM.</p>
                </div>
                <div className="mctb-bubble business ack" style={{ marginTop: "0.5rem" }}>
                  <p className="mctb-bubble-kicker">One automatic reply</p>
                  <p>Thanks — we got it and will reach out soon.</p>
                </div>
                <div className="mctb-hero-outcomes compact">
                  <span className="mctb-outcome-pill">
                    <Bell className="h-3.5 w-3.5" aria-hidden />
                    Team notified
                  </span>
                  <span className="mctb-outcome-pill highlight">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Needs follow-up
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="lp-eyebrow">Your playbook</p>
              <h2>Templates you control. Handoffs your team owns.</h2>
              <p>
                Configure on-a-job, after-hours, and next-step recovery messages. Send one automatic
                acknowledgment, notify your team, then reply from Conversations — or mark the lead handled
                when you&apos;re done.
              </p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>Editable recovery openers (compliance copy stays locked on Press-1)</li>
                <li>Missed-call list with needs follow-up / handled</li>
                <li>Analytics that separate suppressed vs failed</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="mctb-split" style={{ gap: "2rem" }}>
              <div>
                <p className="lp-eyebrow">Compliance</p>
                <h2>Consent paths that match how your business actually operates.</h2>
                <p>
                  High-trust SMS starts with the right permission model — recorded, auditable, and
                  aligned with carrier rules.
                </p>
              </div>
              <div className="mctb-consent-grid">
                {[
                  ["Press-1 on the call", "Caller hears disclosure and presses 1 before any marketing-style recovery."],
                  ["Existing permission", "For businesses with established customer relationships and documented consent."],
                  ["STOP & HELP", "Standard opt-out and help handling on every thread."],
                  ["Consent history", "Evidence available for your team — not buried in a spreadsheet."],
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

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-after-hours mctb-split mctb-split-60-40">
            <div>
              <p className="lp-eyebrow" style={{ color: "#a5b4fc" }}>After hours</p>
              <h2>Closed doesn&apos;t have to mean gone.</h2>
              <p style={{ color: "#cbd5e1" }}>
                After-hours callers still get a professional voicemail — and a recovery text path when
                your setup allows — so Monday morning starts with context, not guesswork.
              </p>
            </div>
            <div className="mctb-phone-mock">
              <p className="mctb-mock-label">8:37 PM · Closed</p>
              <div className="mctb-bubble business">
                <p className="mctb-bubble-kicker">After-hours recovery</p>
                <p>We&apos;re closed — reply with your name and what you need; we&apos;ll respond when we open.</p>
              </div>
              <span className="mctb-chip">Voicemail + recovery · Team sees it tomorrow</span>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">One inbox</p>
              <h2>Missed calls, replies, and context — together.</h2>
              <p>Open the thread, see the missed call, reply by SMS, or jump to voicemail when they left one.</p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>Unified conversations</li>
                <li>Missed-call detail timeline</li>
                <li>Mark handled when the lead is closed</li>
              </ul>
            </div>
            <div className="mctb-inbox-mock" aria-hidden>
              <div className="mctb-inbox-list">
                <div className="active">Sarah M.<br /><span className="mctb-inbox-status">Needs follow-up</span></div>
                <div>David R.<br /><span className="mctb-inbox-status handled">Handled</span></div>
                <div>Maria T.<br /><span className="mctb-inbox-status">New reply</span></div>
              </div>
              <div className="mctb-inbox-pane">
                <p><strong>Missed call</strong> · Press-1 consent recorded</p>
                <div className="mctb-bubble customer" style={{ marginTop: "0.5rem" }}>
                  Do you have openings Thursday?
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Recovery messages that match the moment.</h2>
              <p className="lp-lead">Templates for busy, closed, and first-touch — you edit the words; runtime sends the right one.</p>
            </div>
            <div className="mctb-sms-cards">
              {[
                ["On a job", "We're with another customer. Reply with what you need — we'll get back to you shortly."],
                ["After hours", "We're closed. Leave your details and we'll respond when we're back."],
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

        <section className="lp-section">
          <div className="lp-container mctb-split mctb-split-60-40">
            <div className="mctb-phone-mock mctb-phone-mock-wide">
              <div className="mctb-bubble customer">Do you have anything available Thursday?</div>
              <div className="mctb-bubble business" style={{ marginTop: "0.5rem" }}>
                <p>Happy to help — pick a time that works:</p>
              </div>
              <Link href="/appointments" className="lp-btn lp-btn-primary lp-btn-sm mctb-mock-cta">
                Book online →
              </Link>
            </div>
            <div>
              <p className="lp-eyebrow">Appointments</p>
              <h2>Booking and reminders in the same product.</h2>
              <p>
                Offer your scheduling link in conversation — or run full online booking with SMS reminders
                so customers show up prepared.
              </p>
              <Link href="/appointments" className="lp-btn lp-btn-secondary" style={{ marginTop: "1rem", display: "inline-flex" }}>
                Explore appointments
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="industries">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Built for businesses where every call matters.</h2>
            </div>
            <div className="mctb-industry-grid">
              {[
                ["Home services", "HVAC, plumbing, electrical, cleaning, landscaping — jobs that start with a ring."],
                ["Dental & healthcare", "Capture scheduling intent when the front desk is busy."],
                ["Salons & personal care", "Stay responsive while you're with another client."],
                ["Automotive", "Service inquiries that can't wait until you find voicemail."],
                ["Professional services", "Turn inquiries into conversations you can qualify."],
                ["Local businesses", "When customers call to buy or book, meet them where they are."],
              ].map(([title, body]) => (
                <article key={title} className="mctb-industry-card">
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="mctb-free-panel">
              <p className="lp-eyebrow">Free plan</p>
              <h2>Start with real missed calls — not a demo script.</h2>
              <p className="lp-lead">
                Connect forwarding, choose your consent mode, and see recovery texts hit your inbox. Upgrade
                when volume grows.
              </p>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary" style={{ marginTop: "1.25rem" }}>
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mctb-trust-line">No new business number required.</p>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">Why Transovo</p>
              <h2>Operations software — not another phone system science project.</h2>
              <p>One login for recovery, conversations, booking, voicemail, and fax.</p>
            </div>
            <div className="mctb-benefit-stack">
              {[
                ["Keep your number", "Forward unanswered calls — don't reprint collateral."],
                ["Two consent modes", "Press-1 and existing permission, both first-class."],
                ["Team notifications", "Know when a recovery text needs a human."],
                ["Handled tracking", "Close the loop on leads, not just message counts."],
                ["Free plan", "Prove value before you scale spend."],
                ["Built for mobile teams", "On a job, in the chair, or at the front desk."],
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

        <section className="lp-section" id="faq">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Frequently asked questions</h2>
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
            <h2>The next call you miss doesn&apos;t have to be the next customer you lose.</h2>
            <p className="lp-lead">
              Start free on Transovo — missed call text back, conversations, and more in one workspace.
            </p>
            <div className="lp-hero-actions" style={{ justifyContent: "center" }}>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="lp-btn lp-btn-secondary">Book a demo</Link>
            </div>
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
                Missed call text back, appointments, conversations, voicemail, and fax — for service
                businesses that live on the phone.
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
                <Link href="#platform">Platform</Link>
                <Link href="#how-it-works">Missed call text back</Link>
                <Link href="/appointments">Appointments</Link>
                <Link href={SIGNUP}>Start free</Link>
                <Link href="/login?next=/mctb">Log in</Link>
              </div>
              <div>
                <h4>Contact</h4>
                <Link href="/contact">Contact</Link>
                <Link href="/contact">Book a demo</Link>
              </div>
              <div>
                <h4>Legal</h4>
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/acceptable-use">Acceptable use</Link>
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
