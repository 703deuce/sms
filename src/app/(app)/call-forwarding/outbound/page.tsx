import { CallForwardingOutboundView } from "@/components/call-forwarding/outbound-view";

export default function CallForwardingOutboundPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Outbound calling</h1>
      <div className="mt-6">
        <CallForwardingOutboundView />
      </div>
    </div>
  );
}
