import { CallForwardingDashboard } from "@/components/call-forwarding/dashboard";

export default function CallForwardingPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Call Forwarding</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your business number rings the phone you already use.
      </p>
      <div className="mt-6">
        <CallForwardingDashboard />
      </div>
    </div>
  );
}
