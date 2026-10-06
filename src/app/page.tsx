import { MctbLandingPage } from "@/components/landing/mctb/mctb-landing-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: "Missed Call Text Back, Appointments & SMS Inbox | Transovo",
    },
    description:
      "Recover missed calls by text on your existing business number — plus appointments, conversations, voicemail, and fax. Press-1 or existing permission. Free plan available.",
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: "Transovo — missed calls, booking, and conversations",
      description:
        "Service business workspace: missed call text back, SMS inbox, appointments, voicemail, and fax. Keep your existing number.",
      url: "/",
    },
  };
}

export default function HomePage() {
  return <MctbLandingPage />;
}
