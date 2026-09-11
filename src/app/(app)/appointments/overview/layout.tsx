import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import { appointmentsPilotFont } from "@/components/appointments/kimi-ui/appointments-pilot-font";
import { AppointmentsOverviewPilotChrome } from "@/components/appointments/kimi-ui/overview/appointments-overview-pilot-chrome";

/** Overview pilot — IBM Plex + canvas/graphite/violet (not global). */
export default function AppointmentsOverviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppointmentsOverviewPilotChrome fontVariableClass={appointmentsPilotFont.variable}>
      <div className={appointmentsPilotFont.className}>{children}</div>
    </AppointmentsOverviewPilotChrome>
  );
}
