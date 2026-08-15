"use client";

import type { Workspace } from "@/lib/types";
import { workspaceHomePath } from "@/lib/workspace/capabilities";
import { cn } from "@/lib/utils";
import { Building2, User } from "lucide-react";
import { useRouter } from "next/navigation";

export function WorkspaceModeToggle({
  workspaceType = "BUSINESS",
  workspaces = [],
  workspaceId,
}: {
  workspaceType?: "PERSONAL" | "BUSINESS";
  workspaces?: Workspace[];
  workspaceId?: string;
}) {
  const router = useRouter();
  const businessWorkspaces = workspaces.filter((w) => w.type !== "PERSONAL");

  async function switchMode(mode: "PERSONAL" | "BUSINESS") {
    if (mode === workspaceType) return;
    try {
      if (mode === "PERSONAL") {
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_personal" }),
        });
      } else {
        const target =
          businessWorkspaces.find((w) => w.id === workspaceId) || businessWorkspaces[0];
        if (!target) return;
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: target.id }),
        });
      }
      router.push(workspaceHomePath(mode));
      router.refresh();
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="flex shrink-0 items-center rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] p-0.5"
      role="tablist"
      aria-label="Workspace mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={workspaceType === "PERSONAL"}
        onClick={() => switchMode("PERSONAL")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition",
          workspaceType === "PERSONAL"
            ? "bg-white text-[#6366f1] shadow-sm"
            : "text-[#6b7280] hover:text-[#374151]",
        )}
      >
        <User className="h-3.5 w-3.5" />
        Personal
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={workspaceType === "BUSINESS"}
        onClick={() => switchMode("BUSINESS")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition",
          workspaceType === "BUSINESS"
            ? "bg-white text-[#6366f1] shadow-sm"
            : "text-[#6b7280] hover:text-[#374151]",
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
        Business
      </button>
    </div>
  );
}
