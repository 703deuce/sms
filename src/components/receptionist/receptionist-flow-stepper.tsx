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
  const currentMainIndex =
    current === "voice-test" ? 2 : current === "capabilities" || current === "advanced" ? 1 : 0;
  const base = createMode ? "/voice/agents/new" : `/voice/agents/${agentId}`;

  return (
    <nav aria-label="Receptionist setup progress" className="w-full max-w-2xl">
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
                  "flex items-center gap-2 px-2 sm:px-3",
                  createMode && index > 0 && "pointer-events-none opacity-45",
                )}
                onClick={(e) => {
                  if (createMode && index > 0) e.preventDefault();
                }}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                    done || active
                      ? "bg-[#6366f1] text-white"
                      : "border border-[#d1d5db] bg-white text-[#9ca3af]",
                  )}
                >
                  {done && !active ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "hidden text-sm sm:inline",
                    active ? "font-semibold text-[#111827]" : "font-medium text-[#9ca3af]",
                  )}
                >
                  {step.label}
                </span>
              </Link>
              {index < WIZARD_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 h-px w-8 sm:w-14",
                    index < currentMainIndex || (active && index < currentMainIndex + 1)
                      ? "bg-[#6366f1]"
                      : "bg-[#e6e8ef]",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {!createMode && current === "advanced" ? (
        <p className="mt-2 text-center text-xs text-[#6b7280]">
          Optional — fine-tune from capabilities or continue to Voice & Test
        </p>
      ) : null}
    </nav>
  );
}
