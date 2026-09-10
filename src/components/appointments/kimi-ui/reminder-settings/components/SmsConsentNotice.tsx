import Link from "next/link";
import { Info } from "lucide-react";

export default function SmsConsentNotice() {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4f46e5]" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-medium text-foreground">SMS reminders require customer consent</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Appointment reminders are sent only when consent was captured at booking or through an approved opt-in flow.
          </p>
          <Link
            href="/settings/messaging"
            className="mt-2 inline-block text-[12.5px] font-medium text-[#4f46e5] hover:underline"
          >
            Manage messaging settings
          </Link>
        </div>
      </div>
    </div>
  );
}
