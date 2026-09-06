import { PublicReminderDiagnosticsClient } from "@/components/appointments/public-reminder-diagnostics-client";

type Props = { params: Promise<{ slug: string }> };

export default async function ReminderDiagnosticsPage({ params }: Props) {
  const { slug } = await params;
  return <PublicReminderDiagnosticsClient slug={slug} />;
}
