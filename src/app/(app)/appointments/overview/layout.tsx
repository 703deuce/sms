import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-neutral-r2.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-soft-cool-slate.css";
import { appointmentsPilotFont } from "@/components/appointments/kimi-ui/appointments-pilot-font";
import { AppointmentsOverviewPilotChrome } from "@/components/appointments/kimi-ui/overview/appointments-overview-pilot-chrome";
import { OverviewPilotSsrStyles } from "@/components/appointments/kimi-ui/overview/overview-pilot-ssr-styles";

/** Appointments Home — neutral 2027 pilot (IBM Plex + light unified shell). */
export default function AppointmentsOverviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <OverviewPilotSsrStyles />
      <AppointmentsOverviewPilotChrome fontVariableClass={appointmentsPilotFont.variable}>
        <div className={appointmentsPilotFont.className}>{children}</div>
      </AppointmentsOverviewPilotChrome>
    </>
  );
}
