"use client";

import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { RECEPTIONIST_EDITOR_STAGES, type ReceptionistEditorStage } from "./types";

export function ReceptionistEditorSteps({
  stage,
  onStageChange,
}: {
  stage: ReceptionistEditorStage;
  onStageChange: (s: ReceptionistEditorStage) => void;
}) {
  return (
    <nav
      aria-label="Receptionist setup stages"
      className="-mx-4 mb-6 overflow-x-auto border-b px-4 md:mx-0 md:px-0"
    >
      <ul className="flex min-w-max gap-6 md:gap-10">
        {RECEPTIONIST_EDITOR_STAGES.map((s) => {
          const active = stage === s.id;
          return (
            <li key={s.id}>
              <Button
                type="button"
                variant="link"
                onClick={() => onStageChange(s.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-2 rounded-none text-sm no-underline hover:no-underline",
                  active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="tabular-nums text-xs text-muted-foreground">{s.index}</span>
                <span>{s.title}</span>
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                ) : null}
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
