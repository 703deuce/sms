"use client";

import { WIZARD_STEPS } from "@/lib/receptionist-wizard/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

type FlowSegment = "about" | "capabilities" | "advanced" | "voice-test";

function segmentFromPath(pathname: string, agentId?: string): FlowSegment {
  if (pathname.includes("/voice-test")) return "voice-test";
  if (pathname.includes("/advanced")) return "advanced";
  if (pathname.includes("/capabilities")) return "capabilities";
  if (pathname.includes("/new") || pathname.endsWith(`/voice/agents/${agentId}`)) return "about";
  if (pathname.includes("/about")) return "about";
  return "about";
}

export function ReceptionistFlowStepper({
  agentId,
  createMode,
}: {
  agentId?: string;
  createMode?: boolean;
}) {
  const pathname = usePathname();
  const current = createMode ? "about" : segmentFromPath(pathname, agentId);
  const currentMainIndex = current === "voice-test" ? 2 : current === "capabilities" || current === "advanced" ? 1 : 0;
  const base = createMode ? "/voice/agents/new" : `/voice/agents/${agentId}`;

  return (
    <nav aria-label="Receptionist setup progress" className="w-full">
      <ol className="flex items-center justify-center gap-0">
        {WIZARD_STEPS.map((step, index) => {
          const resolvedHref = createMode
            ? "/voice/agents/new"
            : index === 0
              ? `${base}/about`
              : index === 1
                ? `${base}/capabilities`
                : `${base}/voice-test`;

          const done = !createMode && index < currentMainIndex;
          const active =
            (index === 0 && current === "about") ||
            (index === 1 && (current === "capabilities" || current === "advanced")) ||
            (index === 2 && current === "voice-test");

          return (
            <li key={step.id} className="flex items-center">
              <Link
                href={createMode && index > 0 ? "#" : resolvedHref}
                className={cn(
                  "flex flex-col items-center gap-2 px-2 sm:px-4",
                  createMode && index > 0 && "pointer-events-none opacity-50",
                )}
                onClick={(e) => {
                  if (createMode && index > 0) e.preventDefault();
                }}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    !done && !active && "border-2 border-border bg-card text-muted-foreground",
                  )}
                >
                  {done && !active ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "hidden max-w-[120px] text-center text-xs font-medium sm:block",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </Link>
              {index < WIZARD_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mb-6 h-0.5 w-12 sm:w-20",
                    done || active ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {!createMode && current === "advanced" ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Optional — fine-tune from capabilities or continue to Voice & Test
        </p>
      ) : null}
    </nav>
  );
}
