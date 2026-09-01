"use client";

import { cn } from "@/lib/utils";
import {
  Copy,
  Link2,
  MoreHorizontal,
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const regular = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  function renderAction(action: RowAction) {
    const Icon = action.icon ? ICONS[action.icon] : null;
    const className = cn(
      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      action.destructive
        ? "text-rose-600 hover:bg-rose-50"
        : "text-slate-700 hover:bg-slate-100",
    );
    const inner = (
      <>
        {Icon ? (
          <Icon
            className={cn("h-4 w-4 shrink-0", action.destructive ? "text-rose-500" : "text-slate-400")}
          />
        ) : null}
        {action.label}
      </>
    );
    if (action.href) {
      return (
        <a key={action.label} href={action.href} className={className} onClick={() => setOpen(false)}>
          {inner}
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
        {inner}
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          open && "bg-slate-100 text-slate-700",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 min-w-[200px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
        >
          {regular.map(renderAction)}
          {destructive.length > 0 ? (
            <>
              {regular.length > 0 ? <div className="mx-2 my-1.5 h-px bg-slate-100" /> : null}
              {destructive.map(renderAction)}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
