"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getVoiceSectionForPath,
  isVoiceNavItemActive,
} from "./voice-nav";

/**
 * Contextual sub-navigation for AI Voice — shows only the 2–5 tabs for the
 * current section (agents, phone, calls, insights). Overview, campaigns, and
 * settings rely on the sidebar without a horizontal tab bar.
 */
export function VoiceSubNav() {
  const pathname = usePathname();
  const section = getVoiceSectionForPath(pathname);
  if (!section) return null;

  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {section.label}
      </p>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {section.items.map((item) => {
          const active = isVoiceNavItemActive(pathname, item, section.key);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-[13px] font-semibold transition",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
