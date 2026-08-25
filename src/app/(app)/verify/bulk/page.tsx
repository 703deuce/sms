import { VerifySubnav } from "@/components/verify/verify-subnav";
import { BulkVerifyForm } from "@/components/verify/bulk-verify-form";

export default function VerifyBulkPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Bulk Verification</h1>
      <div className="mt-6">
        <VerifySubnav />
      </div>
      <div className="mt-6">
        <BulkVerifyForm />
      </div>
    </div>
  );
}
