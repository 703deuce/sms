"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Instructions", segment: "instructions" },
  { label: "Knowledge", segment: "knowledge" },
  { label: "Actions", segment: "actions" },
  { label: "Voice & Call Handling", segment: "voice" },
  { label: "Test", segment: "test" },
  { label: "Advanced", segment: "advanced" },
] as const;

export function AgentEditorNav({ agentId }: { agentId: string }) {
  const pathname = usePathname();
  const base = `/voice/agents/${agentId}`;

  return (
    <div className="mb-6 border-b border-border">
      <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active =
            tab.segment === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.segment || "overview"}
              href={href}
              className={cn(
                "-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-[13px] font-semibold transition whitespace-nowrap",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
