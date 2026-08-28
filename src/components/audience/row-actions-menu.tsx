"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Copy,
  Link2,
  MoreVertical,
  Pencil,
  QrCode,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type RowAction = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
};

const defaultKeywordActions: RowAction[] = [
  { label: "Edit", icon: Pencil, href: "#" },
  { label: "Clone", icon: Copy, href: "#" },
  { label: "Create QR Code", icon: QrCode, href: "/grow/qr-codes" },
  { label: "Create Tap-to-Join Link", icon: Link2, href: "#" },
  { label: "Delete", icon: Trash2, destructive: true, onClick: () => undefined },
];

export function RowActionsMenu({
  actions = defaultKeywordActions,
}: {
  actions?: RowAction[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 px-0 text-slate-500"
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[210px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {actions.map((action) => {
            const Icon = action.icon;
            const className = cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] no-underline hover:bg-slate-50",
              action.destructive ? "text-rose-600" : "text-slate-700",
            );
            if (action.href) {
              return (
                <a
                  key={action.label}
                  href={action.href}
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </a>
              );
            }
            return (
              <button
                key={action.label}
                type="button"
                className={className}
                onClick={() => {
                  action.onClick?.();
                  setOpen(false);
                }}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
