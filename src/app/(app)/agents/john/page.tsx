import { JohnAgentDetail } from "@/components/agents/missed-call-text-back/agent-detail";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function JohnAgentPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <JohnAgentDetail />;
}
