"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Clock,
  MessageSquare,
  Phone,
  PhoneMissed,
  Rocket,
  Shield,
  Menu,
  Zap,
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
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-transovo", label: "Why Transovo" },
  { href: "#industries", label: "Industries" },
  { href: "#faq", label: "FAQ" },
  { href: "/contact", label: "Book a demo" },
];

const DIFFERENTIATORS = [
  {
    icon: Rocket,
    title: "Go live in minutes",
    body: "Start on the Transovo platform sending number — we handle carrier compliance so you are not stuck waiting on A2P registration before your first recovery text.",
  },
  {
    icon: Phone,
    title: "Keep the number customers call",
    body: "Your public business line stays the same. Unanswered calls forward to Transovo; when you pick up, nothing changes.",
  },
  {
    icon: Shield,
    title: "Press-1 or existing permission",
    body: "Pick the consent path that fits your business — caller opt-in on the call, or recovery when you already have permission to text.",
  },
  {
    icon: MessageSquare,
    title: "Your words, not a chatbot",
    body: "Deterministic recovery templates plus one automatic acknowledgment. Your team replies when it is human time — no endless AI thread.",
  },
  {
    icon: Bell,
    title: "Team notified instantly",
    body: "When a caller texts back, your people know. Track needs follow-up vs handled so leads do not slip through.",
  },
  {
    icon: Zap,
    title: "Free plan to prove it",
    body: "Connect forwarding, run a live test, and see real missed-call recovery before you pay for more volume.",
  },
];

const FAQS = [
  {
    q: "Do I have to change my business phone number?",
    a: "No. Customers keep calling the number they already know. You set up unanswered-call forwarding to Transovo — you do not replace your line.",
  },
  {
    q: "Do I need A2P or 10DLC registration before I can start?",
    a: "Not to get started. Most businesses begin with the Transovo platform sending number so recovery texts can go out while forwarding is connected. You can add your own verified business sender later in setup when you are ready — it is optional, not a gate to finishing onboarding.",
  },
  {
    q: "What happens when I answer the call?",
    a: "Nothing changes. You answer and handle the call normally. Transovo only runs when the call is not answered and forwarding applies.",
  },
  {
    q: "How does consent work for texting?",
    a: "Choose Press-1 (caller hears a disclosure and presses 1 to opt in) or existing permission (you confirm you already have permission to text those callers). With Press-1, a compliance confirmation text is sent before your recovery message.",
  },
  {
    q: "Does every missed caller automatically get a text?",
    a: "With Press-1, only if they press 1. With existing permission, recovery follows your configuration when a call qualifies as missed. Opt-outs and exclusions are always honored.",
  },
  {
    q: "Is this an AI that keeps texting my customers?",
    a: "No. You configure recovery templates and an optional one-time automatic reply. After that, your team continues the conversation or marks the lead handled.",
  },
  {
    q: "Can I send my booking or quote link?",
    a: "Yes. Paste your link in a reply from the missed-call conversation — same as you would from any business texting workflow.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Start free, connect forwarding, and validate with real missed calls before upgrading.",
  },
  {
    q: "What if my business is closed?",
    a: "After-hours callers can still reach your voicemail flow and, when configured, receive a recovery text so your team has context when you reopen.",
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
                <p className="lp-eyebrow">Missed call text back</p>
                <h1 className="lp-hero-title">
                  Stop losing customers when you cannot answer the phone.
                </h1>
                <p className="lp-hero-copy">
                  Transovo turns unanswered calls into compliant SMS — with templates you control, team
                  alerts, and a clear handoff when a human needs to step in.
                </p>
                <p className="mctb-highlight" style={{ marginTop: "0.75rem" }}>
                  Start on our platform sending number today. No A2P paperwork required to go live.
                  Keep your existing business line for every call.
                </p>
                <div className="lp-hero-actions" style={{ marginTop: "1.5rem" }}>
                  <Link href={SIGNUP} className="lp-btn lp-btn-primary">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="#how-it-works" className="lp-btn lp-btn-secondary">See how it works</Link>
                </div>
                <p className="mctb-trust-line">
                  Free plan · Platform sender included · Press-1 or existing permission · Set up in minutes
                </p>
              </div>
              <MctbHeroMockup />
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="why-transovo">
          <div className="lp-container">
            <div className="lp-section-center">
              <p className="lp-eyebrow">Why businesses switch</p>
              <h2>Missed-call texting that actually ships — not a six-week carrier project.</h2>
              <p className="lp-lead">
                Other tools make you register messaging, rebuild your number story, or bolt on a bot.
                Transovo is built around one job: recover the call you already missed.
              </p>
            </div>
            <div className="mctb-platform-grid">
              {DIFFERENTIATORS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="mctb-platform-card">
                    <div className="mctb-platform-icon" aria-hidden>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
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
              <h2>You cannot answer every ring. You can still win the lead.</h2>
              <p className="lp-lead">
                On a job, with another customer, or after hours — callers rarely leave voicemail. They
                will text back if you give them a fast, compliant path.
              </p>
            </div>
            <div className="mctb-problem-grid">
              <article className="mctb-problem-card">
                <PhoneMissed className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>Voicemail is a dead end</h3>
                <p>Most people hang up. A text invitation while they still care beats playing phone tag tomorrow.</p>
              </article>
              <article className="mctb-problem-card">
                <Phone className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>Competitors answer faster</h3>
                <p>The first business to respond often gets the job — even if you were busier doing the work.</p>
              </article>
              <article className="mctb-problem-card">
                <Clock className="h-6 w-6 text-indigo-500" aria-hidden />
                <h3>Your team stays in control</h3>
                <p>Automatic recovery and one ack — then a real person calls back or marks handled.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="how-it-works">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>From missed call to follow-up in seconds.</h2>
              <p className="lp-lead">
                Forward when you do not answer. Transovo handles consent, sends your recovery sequence, and
                puts the thread where your team already works.
              </p>
            </div>
            <div className="mctb-steps-4">
              {[
                {
                  n: "01",
                  title: "They call your line",
                  body: "Same number on your truck, website, and Google — you answer when you can.",
                },
                {
                  n: "02",
                  title: "No answer → Transovo",
                  body: "Carrier forwarding sends the unanswered call to Transovo ingress — not a new public number.",
                },
                {
                  n: "03",
                  title: "Permission to text",
                  body: "Press-1: disclosure + keypress. Existing permission: voicemail + recovery per your attestation.",
                },
                {
                  n: "04",
                  title: "Recover & notify",
                  body: "Recovery texts from the platform sender (or your verified sender later), team alerted, status tracked.",
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
                <p>You attest prior consent. Recovery without Press-1 audio.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">Two numbers, one story</p>
              <h2>Customers call your line. Recovery texts can start on ours.</h2>
              <p>
                Your <strong>business line</strong> is what you advertise. The <strong>text-back sender</strong> can
                be Transovo&apos;s platform number on day one — so you are not waiting on brand registration to help
                your first missed caller.
              </p>
              <p style={{ marginTop: "0.75rem" }}>
                When you are ready, switch to your own verified sender in setup. Forwarding and consent stay the same.
              </p>
            </div>
            <div className="mctb-number-hub mctb-number-hub-dual">
              <div className="mctb-number-role">
                <p className="mctb-mock-label">Business line (you keep)</p>
                <p className="mctb-mock-title">(571) 555-0142</p>
                <p className="mctb-mock-sub">Customers call here</p>
              </div>
              <p className="mctb-flow-arrow">No answer → forward</p>
              <div className="mctb-number-role highlight">
                <p className="mctb-mock-label">Recovery texts (start here)</p>
                <p className="mctb-mock-title">Transovo platform sender</p>
                <p className="mctb-mock-sub">Included · No A2P wait to start</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split mctb-split-60-40 reverse">
            <div className="mctb-split-visual">
              <div className="mctb-phone-mock mctb-phone-mock-wide">
                <p className="mctb-mock-label">What customers experience</p>
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
                Configure on-a-job, after-hours, and first-touch recovery messages. One automatic ack,
                then your crew replies, calls back, or marks the lead handled.
              </p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>Editable recovery openers (Press-1 compliance copy stays locked)</li>
                <li>Missed-call list with needs follow-up / handled</li>
                <li>Clear analytics — suppressed is not the same as failed</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="mctb-split" style={{ gap: "2rem" }}>
              <div>
                <p className="lp-eyebrow">Compliance</p>
                <h2>Consent that matches how you actually operate.</h2>
                <p>Recorded, auditable permission — aligned with carrier rules, not checkbox theater.</p>
              </div>
              <div className="mctb-consent-grid">
                {[
                  ["Press-1 on the call", "Caller hears disclosure and presses 1 before recovery texting."],
                  ["Existing permission", "For businesses with established customer relationships and documented consent."],
                  ["STOP & HELP", "Standard opt-out and help on every thread."],
                  ["Consent evidence", "See what was captured on the missed-call record."],
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
              <h2>Closed for the day. Still capture the intent.</h2>
              <p style={{ color: "#cbd5e1" }}>
                Night and weekend callers get your voicemail plus a recovery path when configured — so Monday
                starts with names and needs, not mystery hang-ups.
              </p>
            </div>
            <div className="mctb-phone-mock">
              <p className="mctb-mock-label">8:37 PM · Closed</p>
              <div className="mctb-bubble business">
                <p className="mctb-bubble-kicker">After-hours recovery</p>
                <p>We&apos;re closed — reply with your name and what you need; we&apos;ll respond when we open.</p>
              </div>
              <span className="mctb-chip">Missed call logged · Team sees it next business day</span>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">Missed-call inbox</p>
              <h2>Every recovery thread tied to the call that started it.</h2>
              <p>See the miss, the consent path, the texts, and the reply — then close the loop.</p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>Conversation linked to missed-call detail</li>
                <li>Team notifications when someone texts back</li>
                <li>Mark handled when the job is won or lost</li>
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
              <h2>Recovery messages for the moment they missed you.</h2>
              <p className="lp-lead">Busy, closed, or first touch — you write the templates; Transovo sends the right one.</p>
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

        <section className="lp-section" id="industries">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Built for businesses where every call matters.</h2>
            </div>
            <div className="mctb-industry-grid">
              {[
                ["Home services", "HVAC, plumbing, electrical, cleaning, landscaping — jobs that start with a ring."],
                ["Dental & healthcare", "Capture intent when the front desk is tied up."],
                ["Salons & personal care", "Stay responsive while you are with another client."],
                ["Automotive", "Service inquiries that cannot wait for voicemail."],
                ["Professional services", "Turn missed inquiries into conversations to qualify."],
                ["Local businesses", "When customers call to buy or book, meet them on SMS."],
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
              <p className="lp-eyebrow">Free plan</p>
              <h2>Start with real missed calls — not a slide deck.</h2>
              <p className="lp-lead">
                Sign up, connect forwarding, use the platform sender, and run your live test. Upgrade when
                volume grows — not before you have proof.
              </p>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary" style={{ marginTop: "1.25rem" }}>
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mctb-trust-line">Keep your business number · Platform texting included to start</p>
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
            <h2>The next call you miss does not have to be the next customer you lose.</h2>
            <p className="lp-lead">
              Start free with missed call text back — platform sender included, your business line unchanged.
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
                Missed call text back for service businesses — recover unanswered calls by SMS with consent
                built in.
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
                <Link href="#why-transovo">Why Transovo</Link>
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
