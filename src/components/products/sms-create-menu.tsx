"use client";

import { SMS_CREATE_ACTIONS, SMS_SEND_ACTIONS } from "@/lib/products/sms-routes";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SmsCreateMenuProps = {
  variant?: "sidebar" | "header";
  className?: string;
  /** Graphite primary — Appointments / MCTB neutral shell */
  neutralPrimary?: boolean;
};

export function SmsCreateMenu({ variant = "sidebar", className, neutralPrimary = false }: SmsCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actions = variant === "header" ? SMS_SEND_ACTIONS : SMS_CREATE_ACTIONS;
  const label = variant === "header" ? "Send Message" : "Create";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-center gap-1.5 font-semibold text-white shadow-sm transition",
          neutralPrimary
            ? "bg-[#1b1e23] hover:bg-[#262a31]"
            : "bg-[#6366f1] hover:bg-[#5558e8]",
          variant === "sidebar"
            ? "mt-3 w-full rounded-lg px-3 py-2.5 text-[13px]"
            : "h-9 rounded-lg px-4 text-[13px] sm:inline-flex",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Plus className="h-4 w-4" />
        {label}
        {variant === "sidebar" ? null : <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />}
      </button>
      {open ? (
        <div
          className={cn(
            "absolute z-50 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg",
            variant === "sidebar" ? "left-0 right-0 top-full mt-1" : "right-0 top-11 w-56",
          )}
          role="menu"
        >
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 hover:bg-muted"
            >
              <span className="block text-[13px] font-medium text-foreground">{action.label}</span>
              <span className="block text-[11px] text-muted-foreground">{action.description}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
