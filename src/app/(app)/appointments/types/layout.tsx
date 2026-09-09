import { Geist } from "next/font/google";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import { AppointmentsOverviewPilotChrome } from "@/components/appointments/kimi-ui/overview/appointments-overview-pilot-chrome";

/** Booking Types — same charcoal/teal pilot as Overview (art direction, not layout clone). */
const geistSans = Geist({
  variable: "--font-appt-overview-pilot",
  subsets: ["latin"],
});

export default function BookingTypesLayout({
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
