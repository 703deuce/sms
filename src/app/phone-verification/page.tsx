import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Phone Number Verification & List Cleaning | ${BRAND_NAME}`,
  description:
    "Verify phone numbers, detect mobile vs landline vs VoIP, and clean CSV lists before you call or text.",
};

export default function PhoneVerificationLandingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        Clean Your Phone List Before You Call or Text It
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Remove invalid numbers, segment mobile vs landline vs VoIP, and stop wasting spend on lists
        that will never convert. Verification does not create SMS or call consent.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Verify a Number
        </Link>
        <Link href="/verify/bulk" className="inline-flex rounded-md border px-5 py-2.5 text-sm font-semibold">
          Upload a List
        </Link>
      </div>

      <section className="mt-16 grid gap-6 sm:grid-cols-2">
        <Feature title="Single lookup" body="Enter one number and get carrier, line type, and format validation." />
        <Feature title="Bulk CSV cleaning" body="Upload campaigns, CRM exports, or purchased lead lists. Deduped credits — pay once per unique number." />
        <Feature title="Credit packs" body="Buy 1,000 to 50,000 credits — no large subscription required." />
        <Feature title="Business telecom data" body="List intelligence for campaigns — not reverse person search." />
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
