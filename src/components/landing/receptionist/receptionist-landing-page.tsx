"use client";

import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import {
  ArrowRight,
  Calendar,
  Headphones,
  MessageSquare,
  Phone,
  PhoneForwarded,
  Shield,
} from "lucide-react";

const OUTCOMES = [
  "Answer calls 24/7 with a natural AI receptionist",
  "Handle FAQs from your business knowledge",
  "Take messages and collect caller information",
  "Transfer callers to your team when needed",
  "Book appointments when calendar is connected",
];

const TRUST = [
  {
    icon: Headphones,
    title: "Never miss a lead",
    body: "Every inbound call gets answered — even after hours.",
  },
  {
    icon: MessageSquare,
    title: "Clear call outcomes",
    body: "Transcripts, summaries, and action history in one place.",
  },
  {
    icon: Shield,
    title: "Works without CRM",
    body: "Real value on day one — integrations are optional add-ons.",
  },
];

export function ReceptionistLandingPage() {
  return (
    <div className="min-h-screen bg-[#fafbff] text-[#111827]">
      <header className="border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6366f1] text-white">
              <Phone className="h-4 w-4" />
            </span>
            {BRAND_NAME}
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[#4b5563] md:flex">
            <Link href="#how-it-works" className="hover:text-[#111827]">
              How it works
            </Link>
            <Link href="/personal/numbers/premium" className="hover:text-[#111827]">
              Numbers
            </Link>
            <Link href="/contact" className="hover:text-[#111827]">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login?next=/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6]"
            >
              Log in
            </Link>
            <Link
              href="/signup?product=voice"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5558e8]"
            >
              Try the AI Receptionist
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6366f1]">
                AI Phone Receptionist
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
                Never Miss Another Customer Call
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4b5563]">
                {BRAND_NAME} answers calls, handles common questions, takes messages,
                transfers callers, and books appointments 24/7.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup?product=voice"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-[#5558e8]"
                >
                  Build Your Receptionist
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login?next=/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#d1d5db] bg-white px-5 py-3 text-sm font-semibold text-[#111827] hover:bg-[#f9fafb]"
                >
                  <Phone className="h-4 w-4 text-[#6366f1]" />
                  Log in
                </Link>
              </div>
              <ul className="mt-8 space-y-2 text-sm text-[#4b5563]">
                {OUTCOMES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6366f1]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-xl shadow-indigo-100/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6366f1]">
                Example call flow
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-[#f5f3ff] p-4">
                  <p className="text-sm font-semibold text-[#111827]">Caller</p>
                  <p className="mt-1 text-sm text-[#4b5563]">
                    &ldquo;Hi, I need to schedule a service appointment.&rdquo;
                  </p>
                </div>
                <div className="rounded-2xl bg-[#eef2ff] p-4">
                  <p className="text-sm font-semibold text-[#111827]">AI Receptionist</p>
                  <p className="mt-1 text-sm text-[#4b5563]">
                    Collects name, callback number, and preferred time — then books or takes a message.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="rounded-xl border border-[#e5e7eb] p-3">
                    <Calendar className="mx-auto h-4 w-4 text-[#6366f1]" />
                    <p className="mt-2 font-semibold">Appointment booked</p>
                  </div>
                  <div className="rounded-xl border border-[#e5e7eb] p-3">
                    <PhoneForwarded className="mx-auto h-4 w-4 text-[#6366f1]" />
                    <p className="mt-2 font-semibold">Transfer when needed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-[#e5e7eb] bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              One receptionist. Real business outcomes.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {TRUST.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-[#e5e7eb] p-6">
                  <Icon className="h-6 w-6 text-[#6366f1]" />
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl bg-[#111827] px-6 py-10 text-white sm:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">
                  Also from {BRAND_NAME}: memorable phone numbers
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#d1d5db]">
                  Transovo Numbers is a separate product for finding, buying, and managing
                  custom phone numbers — without mixing it into your receptionist setup.
                </p>
              </div>
              <Link
                href="/personal/numbers/premium"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#111827]"
              >
                Browse Transovo Numbers
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
