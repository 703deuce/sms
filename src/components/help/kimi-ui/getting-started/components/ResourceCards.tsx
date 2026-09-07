import {
  ArrowUpRight,
  BellRing,
  BookOpen,
  LifeBuoy,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import { resources } from "../types";

const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  BellRing,
  MessageSquareText,
  LifeBuoy,
};

export function ResourceCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resources.map((r) => {
        const Icon = ICONS[r.icon] ?? BookOpen;
        return (
          <a key={r.title} href={r.href} className="gs-resource">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                {r.title}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                {r.description}
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
