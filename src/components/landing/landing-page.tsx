"use client";

import Link from "next/link";
import { useState } from "react";
import "./landing.css";

const SUPPORT_EMAIL = "support@transovo.ai";

const NAV = [
  { href: "#top", label: "Home" },
  { href: "#problem", label: "Why Transovo" },
  { href: "#benefits", label: "Features" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "#faq", label: "FAQ" },
];

const BENEFITS = [
  {
    title: "Follow Up With New Leads",
    body: "Respond to new leads while your business is still fresh in their minds. Send a quick message after a form submission, phone call, or estimate request.",
    icon: "lead",
  },
  {
    title: "Send Offers and Updates",
    body: "Share promotions, service updates, event notices, and other useful information. Customers only receive messages after giving permission to hear from your business.",
    icon: "offers",
  },
  {
    title: "Request Customer Reviews",
    body: "Send polite review requests after completing a service. Give satisfied customers a simple way to reach your preferred review page.",
    icon: "reviews",
  },
  {
    title: "Manage Two-Way Conversations",
    body: "Customers can reply directly to your messages. Read and manage conversations from one business inbox instead of using your personal phone.",
    icon: "inbox",
  },
  {
    title: "Send Appointment Reminders",
    body: "Help reduce missed appointments with clear reminders. Send confirmations, scheduling updates, and follow-up messages from the same platform.",
    icon: "reminders",
  },
  {
    title: "Reconnect With Past Customers",
    body: "Stay in touch with customers who already know your business. Send useful updates and offers without relying only on email or social media.",
    icon: "reconnect",
  },
];

const PRODUCT_CHECKS = [
  "Campaigns, contacts, and templates in one place",
  "Two-way business inbox for customer replies",
  "Saved templates for common follow-ups",
  "Separate business number from your personal phone",
  "Permission-based SMS marketing workflows",
  "Business messaging software built for small teams",
];

const USE_CASES = [
  "Lead follow-up",
  "Appointment reminders",
  "Service updates",
  "Promotional offers",
  "Estimate follow-up",
  "Payment reminders",
  "Customer review requests",
  "Event notifications",
  "Two-way customer support",
  "Reengagement campaigns",
];

const AUDIENCES = [
  { label: "Contractors", icon: "hammer" },
  { label: "Home Services", icon: "home" },
  { label: "Salons", icon: "scissors" },
  { label: "Offices", icon: "briefcase" },
  { label: "Repair Shops", icon: "wrench" },
  { label: "Property Mgmt", icon: "building" },
  { label: "Healthcare", icon: "heart" },
  { label: "Local Business", icon: "store" },
];

const FAQS = [
  {
    q: "What is SMS marketing for small businesses?",
    a: [
      "SMS marketing lets a business send permission-based text messages to customers and leads. Messages may include promotions, updates, reminders, review requests, and follow-ups.",
      "Customers must agree to receive the messages. They must also have a clear way to opt out.",
    ],
  },
  {
    q: "Can customers reply to my messages?",
    a: [
      "Yes. Transovo is designed to support two-way customer conversations.",
      "Replies appear in your business inbox, so you can continue the conversation without using your personal phone number.",
    ],
  },
  {
    q: "Can I send messages to any phone number?",
    a: [
      "No. You should only message people who gave your business permission to contact them by text.",
      "Transovo does not allow purchased lists, scraped numbers, or unsolicited bulk messaging.",
    ],
  },
  {
    q: "Do I need to register my business before texting?",
    a: [
      "U.S. carriers require many business messaging programs to complete verification. The exact process can depend on the type of number, campaign, and messages being sent.",
      "Transovo collects the information needed to help support that process. Messaging access may remain limited until approval is complete.",
    ],
  },
  {
    q: "Can I use Transovo to request Google reviews?",
    a: [
      "Yes. Businesses can send review requests to customers who agreed to receive text messages.",
      "Review requests should be honest and should not pressure customers to leave only positive feedback.",
    ],
  },
  {
    q: "Can customers stop the messages?",
    a: [
      "Yes. Customers can reply STOP to opt out.",
      "Businesses must honor opt-out requests and should not continue sending marketing messages after consent has been withdrawn.",
    ],
  },
  {
    q: "Can I upload an existing customer list?",
    a: [
      "You may upload contacts only when your business has valid permission to text them. Having a customer's phone number does not always mean you have permission to send marketing messages.",
      "Your business should keep records showing how and when consent was obtained.",
    ],
  },
  {
    q: "Does Transovo guarantee message delivery?",
    a: [
      "No messaging provider can guarantee that every text will be delivered. Delivery may be affected by carrier filtering, invalid numbers, blocked contacts, content rules, or other network conditions.",
      "Following consent and messaging requirements can reduce the risk of messages being filtered.",
    ],
  },
];

function LogoMark() {
  return (
    <span className="lp-logo-mark" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function BenefitIcon({ type }: { type: string }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "lead":
      return (
        <svg {...props} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
      );
    case "offers":
      return (
        <svg {...props} aria-hidden>
          <path d="m3 11 19-9-9 19-2-8-8-2z" />
        </svg>
      );
    case "reviews":
      return (
        <svg {...props} aria-hidden>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...props} aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "reminders":
      return (
        <svg {...props} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    default:
      return (
        <svg {...props} aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
  }
}

function AudienceIcon({ type }: { type: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "hammer":
      return (
        <svg {...common}>
          <path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" />
          <path d="M18 15l4-4" />
          <path d="m21.5 11.5-1.8-1.8a2.4 2.4 0 0 0-3.4 0l-.7.7 3.4 3.4.7-.7a2.4 2.4 0 0 0 0-3.4Z" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "scissors":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
          <path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
  }
}

function CheckMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SideIcon({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return <div className={`nav-item${active ? " active" : ""}`}>{children}</div>;
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="landing" id="top">
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <Link href="/" className="lp-logo">
            <LogoMark />
            Transovo AI
          </Link>
          <nav className="lp-nav-links" aria-label="Primary">
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="lp-nav-actions">
            <Link href="/login" className="lp-login">
              Log In
            </Link>
            <Link href="/signup" className="lp-btn lp-btn-primary lp-btn-sm">
              Get Started
            </Link>
            <button
              type="button"
              className="lp-menu-btn"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        <div className={`lp-container lp-mobile-menu${menuOpen ? " open" : ""}`}>
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setMenuOpen(false)}>
            Log In
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-blob lp-blob-1" />
          <div className="lp-blob lp-blob-2" />
          <div className="lp-blob lp-blob-3" />
          <div className="lp-container lp-hero-grid">
            <div>
              <div className="lp-eyebrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z" />
                </svg>
                Business messaging software for small teams
              </div>
              <h1>SMS Marketing for Small Businesses Made Simple</h1>
              <p className="lp-hero-copy">
                SMS marketing for small businesses should make it easier to reach customers, not
                create more work. Transovo AI gives you one place to send text campaigns, manage
                replies, and follow up with leads. Reach customers through a channel they already
                use every day.
              </p>
              <div className="lp-hero-actions">
                <Link href="/signup" className="lp-btn lp-btn-primary">
                  Get Started
                </Link>
                <a href="#how-it-works" className="lp-btn lp-btn-secondary">
                  See How It Works
                </a>
              </div>
              <p className="lp-disclaimer">
                Consent-based business messaging. Customers can reply STOP at any time.
              </p>
            </div>

            <div className="lp-dash-wrap" aria-hidden>
              <div className="lp-dash-glow" />
              <div className="lp-dashboard">
                <div className="lp-dash-side">
                  <div className="lp-dash-brand">T</div>
                  <SideIcon active>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12 12 4l9 8" />
                      <path d="M5 10v10h14V10" />
                    </svg>
                  </SideIcon>
                  <SideIcon>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </SideIcon>
                  <SideIcon>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </SideIcon>
                  <SideIcon>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </SideIcon>
                  <SideIcon>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                    </svg>
                  </SideIcon>
                </div>
                <div className="lp-dash-main">
                  <div className="lp-dash-top">
                    <div className="lp-dash-welcome">
                      Welcome back
                      <span>Harbor Home · Inbox overview</span>
                    </div>
                    <div className="lp-dash-search">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3-3" />
                      </svg>
                      Search messages
                    </div>
                  </div>
                  <div className="lp-dash-stats">
                    <div className="lp-stat">
                      <div className="label">Messages sent</div>
                      <strong>1,248</strong>
                      <div className="lp-bars">
                        <i style={{ height: "40%" }} />
                        <i style={{ height: "65%" }} />
                        <i style={{ height: "50%" }} />
                        <i style={{ height: "85%" }} />
                        <i style={{ height: "70%" }} />
                        <i style={{ height: "95%" }} />
                      </div>
                    </div>
                    <div className="lp-stat">
                      <div className="label">Delivery rate</div>
                      <strong>96%</strong>
                      <div className="lp-bars">
                        <i style={{ height: "55%" }} />
                        <i style={{ height: "70%" }} />
                        <i style={{ height: "60%" }} />
                        <i style={{ height: "90%" }} />
                        <i style={{ height: "80%" }} />
                        <i style={{ height: "100%" }} />
                      </div>
                    </div>
                    <div className="lp-stat">
                      <div className="label">Replies</div>
                      <strong>312</strong>
                      <div className="lp-bars">
                        <i style={{ height: "35%" }} />
                        <i style={{ height: "50%" }} />
                        <i style={{ height: "45%" }} />
                        <i style={{ height: "75%" }} />
                        <i style={{ height: "60%" }} />
                        <i style={{ height: "88%" }} />
                      </div>
                    </div>
                  </div>
                  <div className="lp-dash-panels">
                    <div className="lp-dash-card">
                      <div className="lp-dash-card-h">
                        Recent conversations
                        <span className="lp-pill">Live</span>
                      </div>
                      <div className="lp-dash-row">
                        <div className="lp-avatar">MC</div>
                        <div className="meta">
                          <div className="name">Maya Chen</div>
                          <div className="msg">Thanks — I can come Thursday at 2.</div>
                        </div>
                        <span className="lp-pill">Reply</span>
                      </div>
                      <div className="lp-dash-row">
                        <div className="lp-avatar" style={{ background: "linear-gradient(135deg,#86efac,#059669)" }}>
                          JL
                        </div>
                        <div className="meta">
                          <div className="name">Jordan Lee</div>
                          <div className="msg">Can you send the estimate again?</div>
                        </div>
                        <span className="lp-pill amber">New</span>
                      </div>
                      <div className="lp-dash-row">
                        <div className="lp-avatar" style={{ background: "linear-gradient(135deg,#fcd34d,#f59e0b)" }}>
                          SR
                        </div>
                        <div className="meta">
                          <div className="name">Sam Rivera</div>
                          <div className="msg">Reminder confirmed. See you then.</div>
                        </div>
                        <span className="lp-pill green">Done</span>
                      </div>
                    </div>
                    <div className="lp-dash-card">
                      <div className="lp-dash-card-h">Weekly activity</div>
                      <div className="lp-mini-chart">
                        <div className="bars">
                          <span style={{ height: "42%" }} />
                          <span style={{ height: "58%" }} />
                          <span style={{ height: "48%" }} />
                          <span style={{ height: "76%" }} />
                          <span style={{ height: "64%" }} />
                          <span style={{ height: "88%" }} />
                          <span style={{ height: "72%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="problem" className="lp-section">
          <div className="lp-container lp-section-center">
            <h2>Reach Customers Before They Move On</h2>
            <p className="lp-lead">
              Emails get missed. Phone calls go unanswered. Social posts may never reach the people
              who follow your business.
            </p>
            <p className="lp-lead">
              Text messaging gives your business a direct way to communicate. Transovo helps you
              send timely messages without juggling personal phones, spreadsheets, and separate
              tools.
            </p>
          </div>
        </section>

        <section id="benefits" className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="lp-benefits-intro">
              <h2>Turn More Customer Conversations Into Business</h2>
              <p className="lp-lead">
                Transovo helps small businesses stay connected before and after the sale. Send the
                right message at the right time and keep every reply organized.
              </p>
            </div>
            <div className="lp-benefits-grid">
              {BENEFITS.map((item) => (
                <article key={item.title} className="lp-benefit-card">
                  <div className="lp-icon">
                    <BenefitIcon type={item.icon} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="lp-section">
          <div className="lp-container lp-product-grid">
            <div className="lp-phone-wrap" aria-hidden>
              <div className="lp-phone-glow" />
              <div className="lp-phone">
                <div className="lp-phone-notch" />
                <div className="lp-phone-screen">
                  <div className="lp-phone-header">
                    <strong>Harbor Home</strong>
                    <span>Business SMS · iMessage style</span>
                  </div>
                  <div className="lp-bubble out">
                    Hi Maya — your appointment is tomorrow at 10 AM. Reply YES to confirm or STOP
                    to opt out.
                    <time>9:12 AM</time>
                  </div>
                  <div className="lp-bubble in">
                    YES — see you then!
                    <time>9:14 AM</time>
                  </div>
                  <div className="lp-bubble out">
                    Great. If you need to reschedule, just reply here and we will help.
                    <time>9:15 AM</time>
                  </div>
                  <div className="lp-bubble in">
                    Perfect, thank you.
                    <time>9:16 AM</time>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h2>One SMS Marketing Platform for Your Small Business</h2>
              <p className="lp-lead">
                Transovo brings your business messages, contacts, templates, and replies together.
                You do not need several tools to handle a simple customer conversation.
              </p>
              <p className="lp-lead" style={{ marginTop: "1rem" }}>
                Use saved templates for common messages. Track replies in one inbox and keep your
                business communication separate from your personal number.
              </p>
              <ul className="lp-checklist">
                {PRODUCT_CHECKS.map((item) => (
                  <li key={item}>
                    <span className="lp-check" aria-hidden>
                      <CheckMini />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Start Texting Customers in Three Steps</h2>
            </div>
            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-num">1</div>
                <h3>Create Your Business Account</h3>
                <p>
                  Add your business information and choose how you plan to use text messaging. We
                  use this information to support carrier registration and responsible messaging.
                </p>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">2</div>
                <h3>Complete Messaging Verification</h3>
                <p>
                  U.S. business texting may require carrier verification before full messaging is
                  activated. Transovo guides you through the required business, consent, and
                  campaign information.
                </p>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">3</div>
                <h3>Send Messages and Manage Replies</h3>
                <p>
                  Add customers who have agreed to receive messages. Send campaigns, follow up with
                  leads, and continue conversations from your Transovo inbox.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="use-cases" className="lp-section">
          <div className="lp-container lp-two-panels">
            <div className="lp-panel">
              <h2>Business Text Messaging That Fits Your Workflow</h2>
              <p>
                Transovo can support many common customer conversations. Choose the workflows that
                fit your business and only send messages people agreed to receive.
              </p>
              <ul className="lp-use-grid">
                {USE_CASES.map((item) => (
                  <li key={item}>
                    <span className="lp-use-check" aria-hidden>
                      <CheckMini />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-panel" id="audience">
              <h2>SMS Marketing for Local and Service Businesses</h2>
              <p>
                Transovo is built for businesses that need a simple way to reach customers. It can
                support one-person companies, growing teams, and businesses with several locations.
              </p>
              <p>
                It may be useful for contractors, home-service companies, salons, professional
                offices, repair shops, property managers, healthcare practices, and other local
                businesses. Each business controls its own customer list, message content, and
                communication schedule.
              </p>
              <div className="lp-audience-grid" style={{ marginTop: "1.35rem" }}>
                {AUDIENCES.map((item) => (
                  <div key={item.label} className="lp-audience-item">
                    <div className="lp-audience-icon">
                      <AudienceIcon type={item.icon} />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="compliance" className="lp-compliance">
          <div className="lp-container lp-compliance-grid">
            <div className="lp-compliance-left">
              <div className="lp-shield-circle" aria-hidden>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h2>Permission-Based Messaging Comes First</h2>
              <p>
                Transovo is designed for messages sent to customers who have agreed to receive them.
                Purchased contact lists, scraped phone numbers, and unsolicited mass texting are not
                allowed.
              </p>
              <p>
                Businesses must clearly explain what customers are signing up to receive. Messages
                must identify the sender and provide a simple way to opt out.
              </p>
              <p>
                Customers can reply STOP to end messages and HELP for assistance. Transovo helps
                businesses follow carrier rules, but each business remains responsible for its
                messaging practices and customer consent.
              </p>
            </div>
            <article className="lp-compliance-card">
              <h2>Give Customers a Clear Choice</h2>
              <p>
                A customer should understand what they are agreeing to before submitting a phone
                number. Consent language should explain who will send the messages, what the
                messages may include, and how often they may arrive.
              </p>
              <div className="lp-consent-box">
                <div className="lp-consent-label">Example consent language</div>
                By providing your phone number, you agree to receive customer-service and marketing
                text messages from [Business Name]. Message frequency may vary. Message and data
                rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition
                of purchase.
              </div>
              <p>
                Your final consent language should match your actual messaging program and business
                practices.
              </p>
              <Link href="/acceptable-use" className="lp-btn lp-btn-secondary lp-btn-sm" style={{ marginTop: "0.35rem" }}>
                Read Acceptable Use Policy
              </Link>
            </article>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-value-grid">
            <div>
              <h2>Stay Connected Without Chasing Every Customer</h2>
              <p className="lp-lead">
                Imagine following up with a new lead before a competitor calls them. Imagine
                reminding customers about appointments without making every call yourself.
              </p>
              <p className="lp-lead" style={{ marginTop: "1rem" }}>
                Transovo gives your business a repeatable way to stay in contact. That means fewer
                missed conversations and more chances to turn interest into action.
              </p>
              <p className="lp-lead" style={{ marginTop: "1rem" }}>
                Built for small businesses, not complicated marketing teams. Create templates,
                organize contacts, and manage customer conversations without turning your phone into
                a full-time marketing system.
              </p>
            </div>
            <div id="cta" className="lp-cta-card">
              <h2>Start Building Better Customer Conversations</h2>
              <p className="lp-lead">
                Use SMS marketing to follow up faster, keep customers informed, and bring more
                conversations into one place. Transovo AI makes business texting easier to manage.
              </p>
              <Link href="/signup" className="lp-btn lp-btn-primary">
                Get Started With Transovo
              </Link>
              <p className="lp-disclaimer" style={{ marginTop: "0.9rem" }}>
                Business verification may be required before sending U.S. application-to-person
                messages.
              </p>
              <div className="lp-cta-phone" aria-hidden>
                <div className="lp-bubble out" style={{ maxWidth: "100%" }}>
                  Thanks for booking — we will text you a reminder tomorrow.
                  <time>Today</time>
                </div>
                <div className="lp-bubble in" style={{ maxWidth: "100%" }}>
                  Sounds good!
                  <time>Today</time>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="lp-section-center">
              <h2>Frequently Asked Questions</h2>
            </div>
            <div className="lp-faq-grid">
              {FAQS.map((item, index) => {
                const open = openFaq === index;
                return (
                  <div key={item.q} className={`lp-faq-item${open ? " open" : ""}`}>
                    <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? null : index)}>
                      {item.q}
                      <Chevron />
                    </button>
                    <div className="lp-faq-answer">
                      {item.a.map((para) => (
                        <p key={para}>{para}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div>
              <div className="lp-logo">
                <LogoMark />
                Transovo AI
              </div>
              <p className="lp-footer-tag">
                SMS marketing and customer communication tools for small businesses. Transovo AI
                LLC provides business messaging software for permission-based texting.
              </p>
              <p className="lp-support-note">
                Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                <br />
                Transovo AI LLC · Woodbridge, Virginia
              </p>
            </div>
            <div className="lp-footer-cols">
              <div>
                <h4>Product</h4>
                <a href="#product">Overview</a>
                <a href="#how-it-works">How it Works</a>
                <a href="#benefits">Features</a>
                <a href="#use-cases">Use Cases</a>
              </div>
              <div>
                <h4>Company</h4>
                <Link href="/">Home</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/login">Log In</Link>
                <Link href="/signup">Get Started</Link>
              </div>
              <div>
                <h4>Resources</h4>
                <a href="#faq">FAQ</a>
                <a href="#compliance">Consent Guide</a>
                <a href="#compliance">STOP / HELP</a>
                <Link href="/contact">Support</Link>
              </div>
              <div>
                <h4>Legal</h4>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/terms">Terms of Service</Link>
                <Link href="/acceptable-use">Acceptable Use Policy</Link>
              </div>
            </div>
          </div>
          <div className="lp-footer-legal">
            <div className="lp-footer-legal-box">
              Transovo supports permission-based business messaging. Message frequency varies by
              business and campaign. Message and data rates may apply. Reply STOP to opt out or HELP
              for help. Questions:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </div>
            <p className="lp-footer-copy">
              © 2026 Transovo AI LLC. Woodbridge, Virginia. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
