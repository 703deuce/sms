import { Geist } from "next/font/google";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-overrides.css";
import "@/components/campaigns/appointments-campaigns-overrides.css";
import { AppointmentsPilotChrome } from "@/components/appointments/kimi-ui/shared/appointments-pilot-chrome";

/** Appointments product — Geist + charcoal/teal theme on all /appointments/* routes. */
const geistSans = Geist({
  variable: "--font-appt-overview-pilot",
  subsets: ["latin"],
});

export default function AppointmentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppointmentsPilotChrome fontVariableClass={geistSans.variable}>
      <div className={`${geistSans.className} appt-overview-pilot min-h-full`}>{children}</div>
    </AppointmentsPilotChrome>
  );
}
