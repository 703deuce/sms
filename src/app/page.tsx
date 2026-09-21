import { MctbLandingPage } from "@/components/landing/mctb/mctb-landing-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: "Missed Call Text Back for Small Business | Transovo",
    },
    description:
      "When you miss a call, Transovo lets callers press 1 to continue by text on your existing business number. Free plan available. Set up in minutes.",
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: "Missed Call Text Back | Transovo",
      description:
        "Missed call → caller chooses text → conversation continues. Keep your existing business number.",
      url: "/",
    },
  };
}

export default function HomePage() {
  return <MctbLandingPage />;
}
