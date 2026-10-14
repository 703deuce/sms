"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { OpusIconBadge } from "@/newui-transplant/components/app/kit";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

export type SellChoice = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

type Props = {
  choices: readonly SellChoice[];
  className?: string;
};

export function SellChoiceRows({ choices, className }: Props) {
  return (
    <ul className={cn("mx-auto mt-7 flex w-full max-w-[820px] flex-col gap-3", className)}>
      {choices.map((choice) => (
        <li key={choice.href}>
          <Link
            href={choice.href}
            className={cn(
              OPUS_CARD,
              "group flex min-h-[5.25rem] w-full items-center gap-4 px-5 py-3.5 transition-colors",
              "hover:border-primary/35 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
          >
            <OpusIconBadge
              icon={choice.icon}
              className="size-11 shrink-0 rounded-xl bg-primary/12"
            />
            <div className="min-w-0 flex-1 text-left">
              <span className="block text-base font-semibold leading-snug">{choice.title}</span>
              <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground line-clamp-2">
                {choice.description}
              </span>
            </div>
            <ChevronRight
              className="size-[1.125rem] shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
