import { AppointmentsLandingPage } from "@/components/landing/appointments/appointments-landing-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: "Book More Appointments, Reduce No-Shows | Transovo",
    },
    description:
      "AI-assisted booking, automatic SMS and email reminders, appointment workflows, team scheduling, and payments — Transovo manages the full appointment lifecycle for service businesses.",
    alternates: {
      canonical: "/",
    },
  };
}

export default function HomePage() {
  return <AppointmentsLandingPage />;
}
