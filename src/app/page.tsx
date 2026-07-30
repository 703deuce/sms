import { LandingPage } from "@/components/landing/landing-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "SMS Marketing for Small Businesses | Transovo AI",
  },
  description:
    "SMS marketing for small businesses made simple. Send promotions, follow up with leads, request reviews, and manage customer replies with Transovo AI.",
};

export default function HomePage() {
  return <LandingPage />;
}
