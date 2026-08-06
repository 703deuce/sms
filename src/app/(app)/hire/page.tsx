import { HireTeamChooser } from "@/components/hire/hire-team-chooser";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HireTeamPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/hire");
  return <HireTeamChooser />;
}
