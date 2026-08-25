import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Call Forwarding — Your Business Number, Your Phone | ${BRAND_NAME}`,
  description:
    "Get a Transovo business number and have calls ring your existing cell or landline. Voicemail and app-free callbacks included.",
};

export default function CallForwardingLandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">
        Your business number.
        <br />
        Your existing phone.
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Forward business calls to the phone you already use. No new phone system. No desk phone required.
      </p>
      <p className="mt-3 text-muted-foreground">
        Get a Transovo business number and have calls ring your existing cell or landline. Call customers back
        showing your business identity.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Get My Business Number
        </Link>
        <Link
          href="/settings/billing?upgrade=call_forwarding"
          className="inline-flex rounded-md border px-5 py-2.5 text-sm font-semibold"
        >
          $29.99/month
        </Link>
      </div>
      <section className="mt-16 border-t pt-10">
        <h2 className="text-lg font-semibold">Already need multiple people?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upgrade to Smart Routing and add a phone tree with multiple routes.
        </p>
        <Link href="/smart-routing" className="mt-3 text-sm font-medium text-primary hover:underline">
          Explore Smart Routing →
        </Link>
      </section>
    </main>
  );
}
