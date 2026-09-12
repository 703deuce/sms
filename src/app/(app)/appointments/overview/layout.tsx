import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-neutral-r2.css";
import { GeistSans } from "geist/font/sans";
import { AppointmentsOverviewPilotChrome } from "@/components/appointments/kimi-ui/overview/appointments-overview-pilot-chrome";

/** Appointments Home — neutral 2027 pilot (Geist + light unified shell). */
export default function AppointmentsOverviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppointmentsOverviewPilotChrome fontVariableClass={GeistSans.variable}>
      <div className={GeistSans.className}>{children}</div>
    </AppointmentsOverviewPilotChrome>
  );
}
