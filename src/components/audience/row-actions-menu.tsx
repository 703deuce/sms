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
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Serializable icon keys — server pages must not pass component references into this client menu. */
export type RowActionIcon =
  | "pencil"
  | "copy"
  | "qr-code"
  | "link"
  | "trash"
  | "users";

const ICONS: Record<RowActionIcon, LucideIcon> = {
  pencil: Pencil,
  copy: Copy,
  "qr-code": QrCode,
  link: Link2,
  trash: Trash2,
  users: Users,
};

export type RowAction = {
  label: string;
  icon?: RowActionIcon;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
};

const defaultKeywordActions: RowAction[] = [
  { label: "Edit", icon: "pencil", href: "#" },
  { label: "Clone", icon: "copy", href: "#" },
  { label: "Create QR Code", icon: "qr-code", href: "/grow/qr-codes" },
  { label: "Create Tap-to-Join Link", icon: "link", href: "/grow/tap-to-join/new" },
  { label: "Delete", icon: "trash", destructive: true, onClick: () => undefined },
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
            const Icon = action.icon ? ICONS[action.icon] : null;
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
                  {Icon ? <Icon className="h-4 w-4" /> : null}
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
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
