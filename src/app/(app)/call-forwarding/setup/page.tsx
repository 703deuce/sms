import { CallForwardingDashboard } from "@/components/call-forwarding/dashboard";

export default function CallForwardingSetupPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Forwarding setup</h1>
      <div className="mt-6">
        <CallForwardingDashboard />
      </div>
    </div>
  );
}
