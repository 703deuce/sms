import { MctbLandingPage } from "@/components/landing/mctb/mctb-landing-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: "Missed Call Text Back for Small Business | Transovo",
    },
    description:
      "Turn missed calls into SMS on your existing business line. Start immediately on the Transovo platform sending number — no A2P wait. Press-1 or existing permission. Free plan.",
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
