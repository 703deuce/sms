import { NumbersLandingPage } from "@/components/landing/numbers/numbers-landing-page";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: `Choose Your Own Phone Number | ${BRAND_NAME}`,
    },
    description:
      "Search available personal and business phone numbers, find memorable patterns with AI, buy your favorite, and transfer it to your carrier.",
    alternates: {
      canonical: "/",
    },
  };
}

/** Popular Picks + geo load client-side so the landing shell renders immediately. */
export default function HomePage() {
  return <NumbersLandingPage />;
}
