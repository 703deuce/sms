import { CallForwardingBusinessHoursEditor } from "@/components/call-forwarding/business-hours-editor";

export default function CallForwardingHoursPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Business hours</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Forward during open hours; voicemail after close.
      </p>
      <div className="mt-6">
        <CallForwardingBusinessHoursEditor />
      </div>
    </div>
  );
}
