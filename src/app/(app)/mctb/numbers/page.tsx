import { MctbNumbersView } from "@/components/mctb/mctb-numbers-view";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  enrichWorkspacePhoneWithMessagingStatus,
  loadWorkspaceAccessiblePhoneNumbers,
} from "@/lib/numbers/workspace-accessible-numbers";

export default async function MctbNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadWorkspaceAccessiblePhoneNumbers(workspaceId);
  const numbersWithStatus = enrichWorkspacePhoneWithMessagingStatus(numbers);

  return <MctbNumbersView numbers={numbersWithStatus} />;
}
