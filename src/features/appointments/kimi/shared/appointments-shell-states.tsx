import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Loading/error chrome aligned with Appointments charcoal + teal pilot. */
const PILOT_SOFT = "bg-[#dcefeb] text-[#147d74]";
const PILOT_CANVAS = "bg-[#f7f8fa]";

export function AppointmentsLoadingShell({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div className={`ref-root min-h-screen ${PILOT_CANVAS} p-6 font-sans animate-pulse ${className}`}>
      {children}
    </div>
  );
}

export function AppointmentsErrorShell({
  title,
  description,
  onRetry,
  className = "",
}: Readonly<{
  title: string;
  description: string;
  onRetry: () => void;
  className?: string;
}>) {
  return (
    <div
      className={`ref-root min-h-screen ${PILOT_CANVAS} p-6 font-sans flex items-center justify-center ${className}`}
    >
      <div className="max-w-md text-center rounded-xl border border-dashed border-[#e5e7eb] bg-white px-6 py-12">
        <div
          className={`mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl ${PILOT_SOFT}`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-[#101418]">{title}</h3>
        <p className="mt-1.5 text-[13px] text-[#6b7280]">{description}</p>
        <Button size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function AppointmentsSpinner({ label }: Readonly<{ label?: string }>) {
  return (
    <div className={`flex items-center justify-center gap-2 ${PILOT_SOFT} rounded-xl px-4 py-3`}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ? <span className="text-sm font-medium">{label}</span> : null}
    </div>
  );
}
