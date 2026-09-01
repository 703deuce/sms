import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Online Fax for Modern Businesses | ${BRAND_NAME}`,
  description:
    "Send and receive faxes online without a fax machine. Search inside documents, AI summaries, and structured data extraction.",
};

export default function FaxLandingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        Reliable Online Fax + Intelligent Document Processing
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Send and receive faxes online with simple page accounting, clear delivery status, and
        optional AI document intelligence — no fax machine required.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Get Your Fax Number
        </Link>
        <Link href="/settings/billing?upgrade=fax" className="inline-flex rounded-md border px-5 py-2.5 text-sm font-semibold">
          View Pricing
        </Link>
      </div>

      <section className="mt-16 grid gap-8 sm:grid-cols-2">
        <Feature title="Send & Receive Online" body="Upload PDFs, track delivery, and receive faxes in your inbox." />
        <Feature title="Search Inside Every Fax" body="Find names, invoice numbers, and details buried in scanned pages." />
        <Feature title="AI Summaries" body="Understand documents without reading every page." />
        <Feature title="Extract Important Information" body="Turn fax documents into structured business data." />
      </section>

      <section className="mt-16 border-t pt-10">
        <h2 className="text-lg font-semibold">Plans from $9.99/month</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Starter $9.99/mo · 200 included pages · $0.05/page overage · 1 fax number included.
          Business and Pro add more pages with the same reliability-first experience.
        </p>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
