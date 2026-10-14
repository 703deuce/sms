"use client";

import { BookOpen, CalendarDays, CreditCard, Gift, Package, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export type OfferingCoverCategory =
  | "package"
  | "membership"
  | "service"
  | "class"
  | "workshop"
  | "course"
  | "gift";

const CONFIG: Record<
  OfferingCoverCategory,
  { icon: typeof Package; gradient: string; label: string }
> = {
  package: {
    icon: Package,
    gradient: "from-violet-500/20 via-violet-400/10 to-card",
    label: "Package",
  },
  membership: {
    icon: CreditCard,
    gradient: "from-emerald-500/20 via-emerald-400/10 to-card",
    label: "Membership",
  },
  service: {
    icon: Wrench,
    gradient: "from-sky-500/20 via-sky-400/10 to-card",
    label: "Service",
  },
  class: {
    icon: CalendarDays,
    gradient: "from-amber-500/20 via-amber-400/10 to-card",
    label: "Class",
  },
  workshop: {
    icon: BookOpen,
    gradient: "from-orange-500/20 via-orange-400/10 to-card",
    label: "Workshop",
  },
  course: {
    icon: BookOpen,
    gradient: "from-indigo-500/20 via-indigo-400/10 to-card",
    label: "Course",
  },
  gift: {
    icon: Gift,
    gradient: "from-pink-500/20 via-pink-400/10 to-card",
    label: "Gift",
  },
};

type Props = {
  category: OfferingCoverCategory;
  className?: string;
  aspectClassName?: string;
  /** Small catalog thumbnail — no large decorative gradient. */
  variant?: "default" | "thumb";
};

/** 4:3 placeholder when no cover image is set. */
export function OfferingCoverPlaceholder({
  category,
  className,
  aspectClassName = "aspect-[4/3]",
  variant = "default",
}: Props) {
  const { icon: Icon, gradient, label } = CONFIG[category];
  if (variant === "thumb") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-gradient-to-br",
          gradient,
          className,
        )}
        aria-hidden
      >
        <Icon className="size-5 text-muted-foreground opacity-80" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br",
        aspectClassName,
        gradient,
        className,
      )}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Icon className="size-8 opacity-70" />
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide opacity-80">{label}</span>
      </div>
    </div>
  );
}
