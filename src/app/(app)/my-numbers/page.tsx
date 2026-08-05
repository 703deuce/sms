import { MyNumbersView } from "@/components/numbers/my-numbers-view";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadMyNumbers } from "@/lib/numbers/load-my-numbers";
import { redirect } from "next/navigation";

export default async function MyNumbersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const { cards, summary } = await loadMyNumbers(workspaceId);
  return <MyNumbersView cards={cards} summary={summary} />;
}
