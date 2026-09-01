import { VerifySubnav } from "@/components/verify/verify-subnav";
import { VerifyCreditPurchase } from "@/components/verify/verify-credit-purchase";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getVerifyCreditBalance } from "@/lib/verify/verify-credits";

export default async function VerifyBillingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const balance = await getVerifyCreditBalance(workspaceId);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Verify Billing</h1>
      <div className="mt-6">
        <VerifySubnav />
      </div>
      <p className="mt-6 text-sm">
        Current balance: <strong>{balance.toLocaleString()}</strong> credits
      </p>
      <div className="mt-6">
        <VerifyCreditPurchase />
      </div>
    </div>
  );
}
