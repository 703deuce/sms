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
  Mail,
  DollarSign,
  X,
  CheckCircle2,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import "../landing.css";
import "./mctb-landing.css";
import { mctbSignupNextQuery } from "@/lib/mctb/onboarding/entry-path";
import {
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
} from "@/lib/mctb/recovery-usage-constants";
import { MctbHeroMockup } from "./mctb-hero-mockup";
import { MctbLandingCheckoutButton } from "./mctb-landing-checkout-button";
import { MctbPlanCompareSection } from "./mctb-plan-compare-section";

const CHECKOUT_PRO = "/mctb/billing/checkout?product=mctb_pro";
const CHECKOUT_A2P = "/mctb/billing/checkout?product=mctb_own_sender";

const SIGNUP = mctbSignupNextQuery();

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-transovo", label: "Why Transovo" },
  { href: "#compare", label: "Free vs Pro" },
  { href: "#pricing", label: "Pricing" },
  { href: "#industries", label: "Industries" },
  { href: "#faq", label: "FAQ" },
  { href: "/contact", label: "Book a demo" },
];

const DIFFERENTIATORS = [
  {
    icon: Rocket,
    title: "Text back from our 1-800 today",
    body: "Use the Transovo platform toll-free as your text-back sender — already registered on our side. You do not need your own texting number or your own A2P brand campaign to start sending recovery SMS.",
  },
  {
    icon: Phone,
    title: "Keep the number customers call",
    body: "Forward unanswered calls from your existing business line. When you answer, nothing changes — we only step in on the miss.",
  },
  {
    icon: DollarSign,
    title: "Free plan — not a bait-and-switch",
    body: "Most missed-call texting tools start at painful monthly fees. Transovo includes real recoveries on the free plan. When you outgrow it, one straightforward paid plan — not a menu of add-ons.",
  },
  {
    icon: Shield,
    title: "Press-1 or existing permission",
    body: "Choose caller Press-1 opt-in or existing permission attestation — both supported from day one on the platform sender.",
  },
  {
    icon: Bell,
    title: "Email alerts on Free · SMS on Pro",
    body: "Free plan emails your team on missed calls, replies, and voicemail. Pro adds SMS alerts so the right person knows immediately.",
  },
  {
    icon: MessageSquare,
    title: "Your templates, not a runaway bot",
    body: "Recovery messages you write, plus one automatic acknowledgment. Then your people call back, reply, or mark handled.",
  },
];

const FAQS = [
  {
    q: "Do I have to change my business phone number?",
    a: "No. Customers keep calling the number they already know. You set up unanswered-call forwarding to Transovo — you do not replace your line.",
  },
  {
    q: "Do I need A2P or 10DLC registration?",
    a: "Only if you want recovery texts to come from your own local or toll-free sending number. On the Transovo platform sender (our pre-verified toll-free), we send on our registration — you can start and stay on that path on the free plan without filing your own A2P campaign. If you later add your own number as the text-back sender, carrier brand registration and approval apply — same as anywhere else.",
  },
  {
    q: "Do I need my own phone number to send texts?",
    a: "No. Recovery SMS can send from the Transovo platform toll-free while you keep your existing line for incoming calls only. Adding your own texting number is optional when you want texts to show your local caller ID.",
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
    q: "What does the free plan include?",
    a: "25 missed-call text-backs per month on the platform toll-free sender, Press-1 or existing consent, essential recovery workflow, and email notifications to your team — no credit card to start.",
  },
  {
    q: "What does Pro include?",
    a: "Pro is $19.99/month for 300 text-backs, all recovery strategies, email plus SMS team alerts, booking links, and detailed analytics. You can stay on the platform sender or add customer-owned A2P messaging separately.",
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
                  Send recovery texts from our platform toll-free — no own texting number, no waiting on
                  your A2P approval to try it. Free plan included. Keep your existing line for calls.
                </p>
                <div className="lp-hero-actions" style={{ marginTop: "1.5rem" }}>
                  <Link href={SIGNUP} className="lp-btn lp-btn-primary">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="#compare" className="lp-btn lp-btn-secondary">Compare Free vs Pro</Link>
                </div>
                <p className="mctb-trust-line">
                  $0 to start · Platform 1-800 sender · Team email &amp; SMS alerts · Press-1 or existing permission
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
                Others charge before you see a single recovery, or make you wait weeks on A2P just to
                test. Transovo lets you run on our toll-free sender, alert your team, and upgrade once —
                when volume — not vendor paperwork — says so.
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
              <p className="lp-eyebrow">Platform sender vs your own</p>
              <h2>Call your number. We can text from ours.</h2>
              <p>
                Your <strong>business line</strong> is still what customers dial — forward when you do not answer.
                Recovery SMS can come from Transovo&apos;s <strong>platform toll-free</strong> (already on our A2P) so
                you are not buying a second line or filing brand registration just to send your first text back.
              </p>
              <p style={{ marginTop: "0.75rem" }}>
                Want texts to show your local number instead? Add your own sender later — that path uses standard
                A2P/10DLC registration and approval timelines. Many businesses stay on the platform sender.
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
                <p className="mctb-mock-title">Transovo platform 1-800</p>
                <p className="mctb-mock-sub">We send · Our A2P · Free plan OK</p>
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
            <div className="mctb-after-hours-copy">
              <p className="lp-eyebrow">After hours</p>
              <h2>Closed for the day. Still capture the intent.</h2>
              <p>
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
              <p className="lp-eyebrow">Never miss the miss</p>
              <h2>Your phone was busy — your team still gets the alert.</h2>
              <p>
                Route business notifications by email and text when a recovery matters: a fresh missed call,
                a customer reply, or a thread that still needs follow-up — so the lead is not sitting silent in
                the inbox until tomorrow.
              </p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>Multiple recipients — owner, dispatcher, on-call</li>
                <li>Email and SMS channels</li>
                <li>Email on Free · email and SMS on Pro</li>
              </ul>
            </div>
            <div className="mctb-split-visual">
              <div className="mctb-notify-mock">
                <div className="mctb-notify-row">
                  <Mail className="h-5 w-5 text-indigo-500 shrink-0" aria-hidden />
                  <div>
                    <p className="mctb-mock-label" style={{ marginBottom: "0.2rem" }}>Email · Owner</p>
                    <p style={{ margin: 0, fontSize: "0.88rem" }}>
                      <strong>Missed call — Sarah replied</strong>
                      <br />
                      &quot;Do you have openings Thursday?&quot; · Needs follow-up
                    </p>
                  </div>
                </div>
                <div className="mctb-notify-row" style={{ marginTop: "0.75rem" }}>
                  <Bell className="h-5 w-5 text-indigo-500 shrink-0" aria-hidden />
                  <div>
                    <p className="mctb-mock-label" style={{ marginBottom: "0.2rem" }}>SMS · On-call tech</p>
                    <p style={{ margin: 0, fontSize: "0.88rem" }}>
                      Missed call text back: new reply from (571) 555-0198
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-alt">
          <div className="lp-container mctb-split mctb-split-40-60">
            <div>
              <p className="lp-eyebrow">Missed-call inbox</p>
              <h2>Every recovery thread tied to the call that started it.</h2>
              <p>See the miss, the consent path, the texts, and the reply — then close the loop.</p>
              <ul className="mctb-bullet-list" style={{ marginTop: "1rem" }}>
                <li>Conversation linked to missed-call detail</li>
                <li>Needs follow-up vs handled on the list</li>
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

        <section className="lp-section lp-section-alt" id="compare">
          <div className="lp-container">
            <div className="lp-section-center">
              <p className="lp-eyebrow">Plans</p>
              <h2>Free vs Pro — see exactly what changes when you upgrade.</h2>
              <p className="lp-lead">
                Both plans send recovery SMS from our platform toll-free so you can start without your own A2P
                registration. Pro adds volume, SMS alerts to your team, every recovery strategy, booking links, and
                deeper analytics — not a different product.
              </p>
            </div>
            <MctbPlanCompareSection />
          </div>
        </section>

        <section className="lp-section" id="pricing">
          <div className="lp-container">
            <div className="lp-section-center">
              <p className="lp-eyebrow">Pricing</p>
              <h2>Choose how you want to start — upgrade anytime.</h2>
              <p className="lp-lead">
                Start free with no card, or go straight to Pro checkout. Optional customer-owned messaging is a
                separate add-on on either plan.
              </p>
            </div>
            <div className="mctb-pricing-grid mctb-pricing-grid-3">
              <article className="mctb-pricing-card featured">
                <p className="mctb-pricing-tier">Free</p>
                <p className="mctb-pricing-amount"><span>$0</span>/mo</p>
                <ul className="mctb-bullet-list mctb-pricing-list">
                  <li>{MCTB_FREE_MONTHLY_RECOVERY_LIMIT} missed-call text-backs / month</li>
                  <li>2 recovery strategies (Simple, What do you need?)</li>
                  <li>Press-1 or existing consent</li>
                  <li>Email team alerts — no SMS on Free</li>
                  <li>Platform toll-free sender — no A2P required</li>
                </ul>
                <Link href={SIGNUP} className="lp-btn lp-btn-primary" style={{ marginTop: "1.25rem", width: "100%", justifyContent: "center" }}>
                  Start free
                </Link>
              </article>
              <article className="mctb-pricing-card">
                <p className="mctb-pricing-tier">Pro</p>
                <p className="mctb-pricing-amount"><span>$19.99</span>/mo</p>
                <p className="mctb-pricing-note">One paid plan — not a menu of tiers.</p>
                <ul className="mctb-bullet-list mctb-pricing-list">
                  <li>{MCTB_PRO_MONTHLY_RECOVERY_LIMIT} missed-call text-backs / month</li>
                  <li>All 5 recovery strategies + after-hours message wording</li>
                  <li>Email + SMS team alerts</li>
                  <li>Booking links &amp; full analytics</li>
                  <li>Same platform sender — optional own-number add-on below</li>
                </ul>
                <MctbLandingCheckoutButton
                  productKey="mctb_pro"
                  loginNextPath={CHECKOUT_PRO}
                  className="lp-btn lp-btn-primary"
                  style={{ marginTop: "1.25rem", width: "100%", justifyContent: "center" }}
                >
                  Get Pro — $19.99/mo
                </MctbLandingCheckoutButton>
                <p className="mctb-pricing-foot" style={{ marginTop: "0.75rem" }}>
                  <Link href="#compare">See full Free vs Pro comparison</Link>
                </p>
                <p className="mctb-pricing-foot">
                  Need more than 300? Pro can enable optional usage-based overages with a monthly spending cap
                  (coming soon).
                </p>
              </article>
              <article className="mctb-pricing-card">
                <p className="mctb-pricing-tier">A2P add-on</p>
                <p className="mctb-pricing-amount mctb-pricing-amount-stack">
                  <span>$19.50</span> once
                  <br />
                  <span className="mctb-pricing-plus">+</span>
                  <span>$10</span>/mo
                </p>
                <p className="mctb-pricing-note">
                  Stacks on Free or Pro. Separate from the $19.99 subscription.
                </p>
                <ul className="mctb-bullet-list mctb-pricing-list">
                  <li>Customer-branded, customizable messaging</li>
                  <li>Manual two-way SMS after carrier approval</li>
                  <li>Carrier registration fees (pass-through)</li>
                  <li>Free + add-on = $10/mo · Pro + add-on = $29.99/mo</li>
                </ul>
                <MctbLandingCheckoutButton
                  productKey="mctb_own_sender"
                  loginNextPath={CHECKOUT_A2P}
                  className="lp-btn lp-btn-secondary"
                  style={{ marginTop: "1.25rem", width: "100%", justifyContent: "center" }}
                >
                  Add customer-owned messaging
                </MctbLandingCheckoutButton>
                <p className="mctb-pricing-foot">
                  $19.50 covers standard brand + campaign review fees; $10/mo is the standard campaign
                  recurring fee (Telnyx pass-through, no Transovo markup).
                </p>
              </article>
            </div>
            <p className="mctb-pricing-disclaimer">
              A recovery counts when the first automated recovery SMS is accepted for sending — not when the call
              is missed. Voicemail and call records continue after you hit your text-back limit.
            </p>
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
                <Link href="#compare">Free vs Pro</Link>
                <Link href="#pricing">Pricing</Link>
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
