import { AppointmentAgentDetail } from "@/components/agents/appointment-booking/agent-detail";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppointmentAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <AppointmentAgentDetail agentId={id} />;
}
