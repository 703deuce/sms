"use client";

import type { Workspace } from "@/lib/types";
import { workspaceHomePath } from "@/lib/workspace/capabilities";
import { cn } from "@/lib/utils";
import { Building2, ChevronDown, Plus, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";

type Props = {
  workspaceId?: string;
  workspaceName: string;
  workspaceType?: "PERSONAL" | "BUSINESS";
  workspaces?: Workspace[];
  className?: string;
};

export function WorkspaceSwitcher({
  workspaceId,
  workspaceName,
  workspaceType = "BUSINESS",
  workspaces = [],
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const personalWorkspaces = workspaces.filter((w) => w.type === "PERSONAL");
  const businessWorkspaces = workspaces.filter((w) => w.type !== "PERSONAL");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function switchWorkspace(id: string, type?: "PERSONAL" | "BUSINESS") {
    setOpen(false);
    try {
      await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      const home = workspaceHomePath(type === "PERSONAL" ? "PERSONAL" : "BUSINESS");
      router.push(home);
      router.refresh();
    } catch {
      // ignore
    }
  }

  const icon =
    workspaceType === "PERSONAL" ? (
      <User className="h-3.5 w-3.5" />
    ) : (
      <Building2 className="h-3.5 w-3.5" />
    );

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#111827] hover:bg-[#f3f4f6]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eff6ff] text-[#6366f1]">
          {icon}
        </span>
        <span className="max-w-[160px] truncate">{workspaceName}</span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg"
          role="listbox"
        >
          {personalWorkspaces.length > 0 ? (
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
              Personal
            </div>
          ) : null}
          {personalWorkspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => switchWorkspace(w.id, "PERSONAL")}
              className={cn(
                "flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] hover:bg-[#f9fafb]",
                w.id === workspaceId ? "font-semibold text-[#6366f1]" : "text-[#374151]",
              )}
            >
              <User className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
              <span className="truncate">{w.name}</span>
            </button>
          ))}

          {personalWorkspaces.length === 0 ? (
            <Link
              href="/onboarding/add-personal"
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-[#374151] hover:bg-[#f9fafb]"
              onClick={() => setOpen(false)}
            >
              <Plus className="h-3.5 w-3.5 text-[#9ca3af]" />
              Add Personal Workspace
            </Link>
          ) : null}

          <div className="my-1 border-t border-[#e5e7eb]" />

          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
            Business
          </div>
          {businessWorkspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => switchWorkspace(w.id, "BUSINESS")}
              className={cn(
                "flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] hover:bg-[#f9fafb]",
                w.id === workspaceId ? "font-semibold text-[#6366f1]" : "text-[#374151]",
              )}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
              <span className="truncate">{w.name}</span>
            </button>
          ))}

          <Link
            href="/onboarding/add-business"
            className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-[#374151] hover:bg-[#f9fafb]"
            onClick={() => setOpen(false)}
          >
            <Plus className="h-3.5 w-3.5 text-[#9ca3af]" />
            Add Business
          </Link>
        </div>
      ) : null}
    </div>
  );
}
