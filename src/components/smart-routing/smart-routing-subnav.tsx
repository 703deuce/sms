import Link from "next/link";
import { cn } from "@/lib/utils";

export function SmartRoutingSubNav({
  flowId,
  active,
}: {
  flowId?: string;
  active: "flows" | "audio" | "builder" | "test" | "activity";
}) {
  const tab = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active === key
          ? "bg-indigo-50 text-indigo-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-3">
      {tab("/smart-routing", "Flows", "flows")}
      {tab("/smart-routing/audio", "Audio", "audio")}
      {flowId && (
        <>
          <span className="mx-1 text-slate-300">|</span>
          {tab(`/smart-routing/${flowId}`, "Builder", "builder")}
          {tab(`/smart-routing/${flowId}/test`, "Test", "test")}
          {tab(`/smart-routing/${flowId}/activity`, "Activity", "activity")}
        </>
      )}
    </div>
  );
}
