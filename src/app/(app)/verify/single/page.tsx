import { VerifySubnav } from "@/components/verify/verify-subnav";
import { SingleVerifyForm } from "@/components/verify/single-verify-form";

export default function VerifySinglePage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Single Verification</h1>
      <div className="mt-6">
        <VerifySubnav />
      </div>
      <div className="mt-6">
        <SingleVerifyForm />
      </div>
    </div>
  );
}
