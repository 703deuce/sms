import { Geist } from "next/font/google";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import { AppointmentsOverviewPilotChrome } from "@/components/appointments/kimi-ui/overview/appointments-overview-pilot-chrome";

/** Overview pilot only — professional grotesk + full-page charcoal/teal validation. */
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
    <AppointmentsOverviewPilotChrome>
      <div className={`${geistSans.variable} ${geistSans.className}`}>{children}</div>
    </AppointmentsOverviewPilotChrome>
  );
}
