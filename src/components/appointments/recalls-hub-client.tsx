"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Bell, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const RECALL_LINKS = [
  {
    label: "Recall campaigns",
    href: "/appointments/recall-campaigns",
    description: "Target customers with no future appointment by last visit or appointment type.",
    icon: Bell,
  },
  {
    label: "No-show recovery",
    href: "/appointments/no-show-recovery",
    description: "Automatically follow up after missed appointments and invite customers to rebook.",
    icon: RefreshCcw,
  },
];

export function RecallsHubClient() {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Recalls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Re-engage customers without a future appointment and recover missed visits.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {RECALL_LINKS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Card
                className={cn(
                  "h-full p-5 transition hover:border-primary/40 hover:shadow-sm",
                  active && "border-primary/50 ring-1 ring-primary/20",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <CardTitle className="mt-4 text-base">{item.label}</CardTitle>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
