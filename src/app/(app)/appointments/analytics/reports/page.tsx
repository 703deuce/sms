import { AppointmentsAnalyticsShell } from "@/components/appointments/analytics-shell";

type Props = {
  searchParams: Promise<{
    report?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
};

export default async function AppointmentsAnalyticsReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <AppointmentsAnalyticsShell
      section="reports"
      reportFocus={params.report === "service-booking" ? "service-booking" : undefined}
      reportFrom={params.from}
      reportTo={params.to}
      reportStatus={params.status}
    />
  );
}
