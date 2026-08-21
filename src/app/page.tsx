import { ReceptionistLandingPage } from "@/components/landing/receptionist/receptionist-landing-page";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: `AI Phone Receptionist — Never Miss a Call | ${BRAND_NAME}`,
    },
    description:
      "Transovo answers business calls with AI, handles FAQs, takes messages, transfers callers, and books appointments 24/7.",
    alternates: {
      canonical: "/",
    },
  };
}

export default function HomePage() {
  return <ReceptionistLandingPage />;
}
