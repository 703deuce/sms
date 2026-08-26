import Link from "next/link";
import { MassTextingPricingSection } from "@/components/mass-texting/mass-texting-pricing-section";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: `Mass Texting for Small Businesses | ${BRAND_NAME}`,
  },
  description:
    "Upload your contacts, create an SMS campaign, send now or schedule it. No CRM or complicated automation required.",
  alternates: { canonical: "/mass-texting" },
};

const FAQ = [
  {
    q: "Can I upload a CSV?",
    a: "Yes. Import contacts with phone numbers, names, and tags. Opted-out numbers stay suppressed.",
  },
  {
    q: "Can people reply?",
    a: "Yes. Replies land in your shared Inbox with Mass Texting clearly tagged.",
  },
  {
    q: "Can I schedule campaigns?",
    a: "Send now or pick a future date and time in your workspace timezone.",
  },
  {
    q: "Can I send MMS?",
    a: "MMS support is planned. Mass Texting V1 billing and launch focus on SMS segments.",
  },
  {
    q: "Can I personalize messages?",
    a: "Use merge fields and templates for names and custom contact data.",
  },
  {
    q: "Do I need a CRM?",
    a: "No. Bring your list. We handle the texting.",
  },
  {
    q: "Do you support STOP/HELP?",
    a: "Yes. Standard opt-out handling and suppression are built in.",
  },
  {
    q: "Do I need A2P approval?",
    a: "Yes for promotional bulk SMS in the US. Mass Texting uses its own marketing A2P registration.",
  },
  {
    q: "Can I use my existing contacts?",
    a: "Import CSV lists and organize them into send-ready groups.",
  },
  {
    q: "How does the free trial work?",
    a: "14 days and 100 SMS segments, no credit card. Your trial begins when your business messaging is approved and activated — not at signup.",
  },
  {
    q: "Is there an A2P registration fee?",
    a: "$20 one time on Starter, Growth, and smaller PAYG packs. Included on Pro and larger plans/packs (2,500+ segments).",
  },
  {
    q: "Why does PAYG have a monthly Messaging Line fee?",
    a: "Your dedicated number and carrier registration stay active even in months when you do not buy message packs.",
  },
  {
    q: "Do you charge per message or segment?",
    a: "SMS usage is based on billable message segments. Long messages may use multiple segments.",
  },
  {
    q: "Do unused monthly messages roll over?",
    a: "No — monthly included segments reset each billing cycle.",
  },
];

export default function MassTextingLandingPage() {
  return (
    <main className="min-h-screen bg-[#f8fafb] text-slate-900">
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Mass Texting</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Send a text to your whole customer list.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Upload your contacts, create a campaign, send now or schedule it. No CRM or complicated
          automation required.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup?product=mass_texting"
            className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Start Free Trial
          </Link>
          <a
            href="#how-it-works"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            See How It Works
          </a>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 md:grid-cols-4">
          {[
            "Upload your list",
            "Write your message",
            "Send or schedule",
            "See replies",
          ].map((step, i) => (
            <div key={step} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">
                {i + 1}
              </div>
              <p className="mt-3 font-semibold">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Campaigns",
              body: "SMS personalization, scheduling, and reusable templates.",
            },
            {
              title: "Replies",
              body: "Two-way shared inbox with product and number filters.",
            },
            {
              title: "Simple follow-ups",
              body: "Send a second message only to people who did not respond.",
            },
            {
              title: "Compliance",
              body: "A2P onboarding, STOP/HELP handling, and suppression that survives imports.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <MassTextingPricingSection />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-bold">FAQ</h2>
        <div className="mt-6 space-y-4">
          {FAQ.map((item) => (
            <details key={item.q} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer font-semibold">{item.q}</summary>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
