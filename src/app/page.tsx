import { MctbLandingPage } from "@/components/landing/mctb/mctb-landing-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: "Missed Call Text Back for Small Business | Transovo",
    },
    description:
      "Missed call text back on your business line, recovery texts from Transovo's platform toll-free — start free without your own A2P. Team email and SMS alerts. One simple paid upgrade.",
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: "Missed Call Text Back | Transovo",
      description:
        "Recover missed calls by text. Keep your business number, start on the platform sender, go live in minutes.",
      url: "/",
    },
  };
}

export default function HomePage() {
  return <MctbLandingPage />;
}
