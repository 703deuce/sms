"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAND_NAME } from "@/lib/brand";
import {
  ArrowRight,
  Bell,
  Bot,
  ChevronDown,
  CreditCard,
  GitBranch,
  Menu,
  Users,
  X,
  Calendar,
} from "lucide-react";
import "../landing.css";
import "./appointments-landing.css";
import { AppointmentsHeroMockup } from "./hero-mockup";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#industries", label: "Industries" },
  { href: "#faq", label: "FAQ" },
  { href: "/contact", label: "Book a Demo" },
];

const CORE_FEATURES = [
  {
    icon: Calendar,
    title: "Online Scheduling",
    body: "Share a booking link so customers pick times that match your real availability, staff, and locations.",
  },
  {
    icon: Bot,
    title: "AI Natural-Language Booking",
    body: "Let customers ask for times, reschedule, or get guided into your booking flow — without filling out forms first.",
  },
  {
    icon: Bell,
    title: "SMS & Email Reminders",
    body: "Send automatic reminders before appointments to cut no-shows and keep confirmations on track.",
  },
  {
    icon: GitBranch,
    title: "Appointment Workflows",
    body: "Automate confirmations, reminders, follow-ups, and review requests across the appointment lifecycle.",
  },
  {
    icon: CreditCard,
    title: "Payments & Deposits",
    body: "Connect Stripe or Square to collect deposits or full payments when customers book.",
  },
  {
    icon: Users,
    title: "Team Scheduling / Round Robin",
    body: "Route bookings across staff with multi-staff availability, round robin, and shared calendars.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Set up your availability",
    body: "Create appointment types, staff hours, booking questions, recurring rules, and Google Calendar conflict checking.",
  },
  {
    step: "2",
    title: "Let customers book",
    body: "Share your booking link. Customers book online, join a waitlist when full, or use AI-assisted scheduling.",
  },
  {
    step: "3",
    title: "Automate everything after",
    body: "Reminders, confirmations, workflows, rescheduling, payments, and follow-up run automatically.",
  },
];

const DEEP_DIVES = [
  {
    tag: "Reminders",
    title: "Automatic SMS and email reminders that reduce no-shows",
    lead: "Stop chasing confirmations manually. Transovo sends the right reminder at the right time — by SMS and email.",
    bullets: [
      "24-hour and same-day reminder templates",
      "Custom reminder timing per workflow",
      "Confirmation prompts and reply handling",
      "Reschedule and cancellation follow-ups",
      "Works alongside recurring and group appointments",
    ],
    visual: "reminders",
    dark: false,
  },
  {
    tag: "AI Booking",
    title: "AI booking and rescheduling — without replacing your flow",
    lead: "Customers can ask for availability in natural language. AI guides them into your secure booking and payment steps when required.",
    bullets: [
      "Conversational booking on your public page",
      "Reschedule and cancel intent handling",
      "Routes to payment when the appointment type requires it",
      "Custom booking questions on the standard form",
      "Waitlist when preferred times are unavailable",
    ],
    visual: "ai",
    dark: true,
  },
  {
    tag: "Workflows",
    title: "Appointment workflows for the full lifecycle",
    lead: "Go beyond a calendar. Trigger sequences for confirmation, reminders, follow-up, and reviews — with templates or custom workflows.",
    bullets: [
      "Confirmation-required and standard reminder templates",
      "Multi-staff scheduling and round robin routing",
      "Recurring appointment series support",
      "Group bookings with capacity limits",
      "Post-appointment follow-up and review request flows",
    ],
    visual: "workflows",
    dark: false,
  },
  {
    tag: "Payments",
    title: "Collect deposits with your own Stripe or Square account",
    lead: "Connect your merchant account so customers pay at booking. Funds go to your business — not through Transovo subscription billing.",
    bullets: [
      "Stripe Connect and Square OAuth connections",
      "Deposits or full payment at booking time",
      "Booking-time checkout with payment status on the appointment",
      "Refund support from appointment detail",
      "Business keeps the merchant relationship",
    ],
    visual: "payments",
    dark: true,
  },
];

const INDUSTRIES = [
  {
    title: "Salons & barbers",
    body: "Reduce no-shows and keep chairs full with easy scheduling and reminders.",
  },
  {
    title: "Med spas & beauty",
    body: "Collect deposits and send polished reminders for high-value services.",
  },
  {
    title: "Home services",
    body: "Let customers book windows that match your crew availability.",
  },
  {
    title: "Clinics",
    body: "Send confirmations and reminders patients actually see.",
  },
  {
    title: "Consultants",
    body: "Share a booking link and automate follow-up after every session.",
  },
  {
    title: "Agencies / service teams",
    body: "Route bookings across staff with shared calendars and workflows.",
  },
];

const COMPARE_ROWS = [
  "Online scheduling",
  "AI natural-language booking",
  "Automatic SMS reminders",
  "Automatic email reminders",
  "Appointment workflows",
  "Stripe & Square payments",
  "Team scheduling & round robin",
  "Recurring appointments",
  "Group bookings",
  "Custom booking questions",
  "Waitlist",
  "Google Calendar conflict checking",
  "Follow-up automation",
];

const FAQS = [
  {
    q: "Do I need a website to use Transovo?",
    a: "No. Share your booking link directly via text, email, or social media.",
  },
  {
    q: "Can I send automatic SMS and email reminders?",
    a: "Yes. Transovo supports configurable SMS and email reminders, including workflow-driven timing.",
  },
  {
    q: "Does Transovo support AI booking?",
    a: "Yes. Customers can use natural-language scheduling on your booking page. When payment is required, they complete the secure checkout step before confirmation.",
  },
  {
    q: "Can customers reschedule or join a waitlist?",
    a: "Yes. Transovo supports rescheduling and cancellation flows, plus waitlist signup when slots are full.",
  },
  {
    q: "Does Transovo support team scheduling and round robin?",
    a: "Yes. You can configure multi-staff availability, routing rules, and round robin assignment.",
  },
  {
    q: "Can I collect payments with my own Stripe or Square account?",
    a: "Yes. Connect Stripe or Square to collect deposits or full payments at booking. Your business remains the merchant.",
  },
  {
    q: "Is AI booking required?",
    a: "No. Use standard booking forms, AI booking, or both.",
  },
];

function TransovoLogoMark() {
  return (
    <span className="lp-logo-mark" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon.svg"
        alt=""
        width={36}
        height={36}
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
      />
    </span>
  );
}

function DeepDiveVisual({ type }: { type: string }) {
  if (type === "reminders") {
    return (
      <div className="appt-mini-mock">
        <div className="appt-sms-thread">
          <div className="appt-sms-bubble out">
            Reminder: Your consultation with Bright Studio is tomorrow at 2:00 PM. Reply YES to
            confirm.
          </div>
          <div className="appt-sms-bubble in">YES</div>
          <div className="appt-sms-bubble out">
            Thanks! You&apos;re confirmed for tomorrow at 2:00 PM. Need to reschedule? Use your
            link.
          </div>
        </div>
      </div>
    );
  }
  if (type === "ai") {
    return (
      <div className="appt-mini-mock dark">
        <div className="appt-sms-thread">
          <div className="appt-sms-bubble in">Can I book a haircut Friday afternoon?</div>
          <div className="appt-sms-bubble out">
            I found 3:30 PM and 4:15 PM on Friday. Which works better for you?
          </div>
          <div className="appt-sms-bubble in">3:30 works</div>
          <div className="appt-sms-bubble out">
            Great — I&apos;ll send you to secure checkout to confirm your spot.
          </div>
        </div>
      </div>
    );
  }
  if (type === "workflows") {
    return (
      <div className="appt-mini-mock">
        <div className="appt-workflow-steps">
          <div className="appt-workflow-step">
            <span className="num">1</span>
            Appointment booked → send confirmation
          </div>
          <div className="appt-workflow-step">
            <span className="num">2</span>
            24 hours before → SMS reminder
          </div>
          <div className="appt-workflow-step">
            <span className="num">3</span>
            2 hours before → same-day reminder
          </div>
          <div className="appt-workflow-step">
            <span className="num">4</span>
            After visit → review request
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="appt-mini-mock">
      <div className="appt-workflow-steps">
        <div className="appt-workflow-step">
          <span className="num">$</span>
          Service price: $200.00
        </div>
        <div className="appt-workflow-step">
          <span className="num">↓</span>
          Deposit required: $50.00
        </div>
        <div className="appt-workflow-step">
          <span className="num">✓</span>
          Paid at booking via Stripe Connect
        </div>
        <div className="appt-workflow-step">
          <span className="num">→</span>
          Balance due at appointment: $150.00
        </div>
      </div>
    </div>
  );
}

export function AppointmentsLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="landing appt-landing">
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
              <Link href="/login?next=/appointments/overview" className="lp-login">Log in</Link>
              <Link href="/appointment-reminders/pricing" className="lp-btn lp-btn-primary lp-btn-sm">
                Start Free
              </Link>
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
            <Link href="/login?next=/appointments/overview" onClick={() => setMenuOpen(false)}>Log in</Link>
            <Link href="/contact" onClick={() => setMenuOpen(false)}>Book a Demo</Link>
            <Link href="/appointment-reminders/pricing" onClick={() => setMenuOpen(false)}>Start Free</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-hero appt-hero" id="top">
          <div className="lp-blob lp-blob-1" aria-hidden />
          <div className="lp-blob lp-blob-2" aria-hidden />
          <div className="lp-container">
            <p className="lp-eyebrow">AI appointment automation for service businesses</p>
            <h1 className="appt-hero-title">
              <span className="appt-hero-title-line">Book more appointments.</span>
              <span className="appt-hero-title-line">Reduce no-shows.</span>
              <span className="appt-hero-title-line appt-hero-title-accent">Let AI handle the rest.</span>
            </h1>
            <p className="lp-hero-copy appt-hero-copy">
              Transovo gives service businesses online scheduling, AI-assisted booking, automatic
              SMS and email reminders, appointment workflows, team scheduling, and payments — all in
              one platform.
            </p>
            <div className="lp-hero-actions appt-hero-actions">
              <Link href="/appointment-reminders/pricing" className="lp-btn lp-btn-primary">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#how-it-works" className="lp-btn lp-btn-secondary">
                See How It Works
              </Link>
            </div>
            <p className="appt-trust-line">
              AI booking • Automatic SMS &amp; email reminders • Built to reduce no-shows
            </p>
            <div className="appt-hero-visual">
              <AppointmentsHeroMockup />
            </div>
          </div>
        </section>

        {/* Trust bar */}
        <section className="appt-trust-bar" aria-label="Product capabilities">
          <div className="lp-container appt-trust-inner">
            <p className="appt-trust-heading">Built for appointment-driven businesses</p>
            <p className="appt-trust-capabilities">
              AI booking · SMS reminders · Workflows · Team scheduling · Payments
            </p>
          </div>
        </section>

        {/* Core features */}
        <section className="lp-section" id="features">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Everything you need beyond a booking link</h2>
              <p className="lp-lead">
                Transovo manages the entire appointment lifecycle — booking, reminders,
                confirmations, rescheduling, payments, and follow-up — so your team spends less time
                chasing customers and more time serving them.
              </p>
            </div>
            <div className="appt-feature-grid" style={{ marginTop: "2.75rem" }}>
              {CORE_FEATURES.map((feature) => (
                <article key={feature.title} className="appt-feature-card">
                  <div className="lp-icon">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="lp-section lp-section-alt" id="how-it-works">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>How Transovo works</h2>
            </div>
            <div className="lp-steps">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="lp-step">
                  <div className="lp-step-num">{item.step}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Deep dives */}
        {DEEP_DIVES.map((section, index) => (
          <section
            key={section.tag}
            className={`appt-deep${section.dark ? " appt-deep-dark" : ""}${index % 2 === 1 ? " reverse" : ""}`}
          >
            <div className="lp-container">
              <div className="appt-deep-grid">
                <div>
                  <p className="appt-deep-tag">{section.tag}</p>
                  <h2>{section.title}</h2>
                  <p className="appt-deep-lead">{section.lead}</p>
                  <ul className="appt-bullet-list">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>
                        <span className="appt-bullet-dot" aria-hidden />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
                <DeepDiveVisual type={section.visual} />
              </div>
            </div>
          </section>
        ))}

        {/* Industries */}
        <section className="lp-section" id="industries">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Built for businesses that live on appointments</h2>
            </div>
            <div className="appt-industry-grid" style={{ marginTop: "2.5rem" }}>
              {INDUSTRIES.map((industry) => (
                <article key={industry.title} className="appt-industry-card">
                  <h3>{industry.title}</h3>
                  <p>{industry.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Why teams choose Transovo</h2>
              <p className="lp-lead">
                Unlike a generic calendar, Transovo is built for appointment automation — from AI
                booking and automatic reminders through workflows, team routing, and merchant
                payments.
              </p>
            </div>
            <div className="appt-compare-wrap" style={{ marginTop: "2.25rem" }}>
              <div className="appt-compare-row head">
                <span>Capability</span>
                <span style={{ textAlign: "center" }}>Transovo</span>
              </div>
              {COMPARE_ROWS.map((row) => (
                <div key={row} className="appt-compare-row">
                  <span>{row}</span>
                  <span className="yes">✓</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="appt-cta-band">
          <div className="lp-container">
            <h2>Ready to automate your appointments?</h2>
            <p className="appt-deep-lead">
              Start with scheduling and automatic reminders, then turn on AI booking, workflows,
              team routing, and payments when you&apos;re ready.
            </p>
            <div className="appt-hero-actions">
              <Link href="/appointment-reminders/pricing" className="lp-btn lp-btn-primary">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="lp-btn lp-btn-secondary">Book a Demo</Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-section" id="faq">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Frequently asked questions</h2>
            </div>
            <div className="lp-faq-grid">
              {FAQS.map((faq, index) => (
                <div
                  key={faq.q}
                  className={`lp-faq-item${openFaq === index ? " open" : ""}`}
                >
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
      </main>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div>
              <Link href="/" className="lp-logo">
                <TransovoLogoMark />
                {BRAND_NAME}
              </Link>
              <p className="lp-footer-tag">
                AI appointment automation — booking, reminders, workflows, team scheduling, and
                payments for service businesses.
              </p>
            </div>
            <div className="lp-footer-cols">
              <div>
                <h4>Product</h4>
                <Link href="#features">Features</Link>
                <Link href="#how-it-works">How it works</Link>
                <Link href="/">Missed Call Text Back</Link>
                <Link href="/appointment-reminders/pricing">Start Free</Link>
                <Link href="/login?next=/appointments/overview">Login</Link>
              </div>
              <div>
                <h4>Features</h4>
                <Link href="#features">AI Booking</Link>
                <Link href="#features">SMS &amp; Email Reminders</Link>
                <Link href="#features">Workflows</Link>
                <Link href="#features">Payments</Link>
                <Link href="#features">Team Scheduling</Link>
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
