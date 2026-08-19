import { LandingPage } from "@/components/landing/landing-page";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: `SMS Marketing for Small Businesses | ${BRAND_NAME}`,
    },
    description: `SMS marketing for small businesses made simple. Send promotions, follow up with leads, request reviews, and manage customer replies with ${BRAND_NAME}.`,
    alternates: {
      canonical: "/sms-marketing",
    },
  };
}

export default function SmsMarketingPage() {
  return <LandingPage />;
}
