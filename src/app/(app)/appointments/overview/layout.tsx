import { Geist } from "next/font/google";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import { AppointmentsOverviewPilotChrome } from "@/components/appointments/kimi-ui/overview/appointments-overview-pilot-chrome";

/** Overview pilot — Geist + charcoal/teal full-page validation (not global). */
const geistSans = Geist({
  variable: "--font-appt-overview-pilot",
  subsets: ["latin"],
});

export default function AppointmentsOverviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppointmentsOverviewPilotChrome fontVariableClass={geistSans.variable}>
      <div className={geistSans.className}>{children}</div>
    </AppointmentsOverviewPilotChrome>
  );
}
