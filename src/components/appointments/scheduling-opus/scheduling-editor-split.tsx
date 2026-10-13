"use client";

import { ArOpusPage } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { cn } from "@/lib/utils";

type Props = {
  header: React.ReactNode;
  subHeader?: React.ReactNode;
  nav?: React.ReactNode;
  editor: React.ReactNode;
  preview?: React.ReactNode;
  className?: string;
};

/** 70/30 business editor layout (package detail, etc.). */
export function SchedulingEditorSplit({
  header,
  subHeader,
  nav,
  editor,
  preview,
  className,
}: Props) {
  return (
    <ArOpusPage className={cn("pb-10", className)}>
      {header}
      {subHeader}
      {nav}
      <div
        className={cn(
          preview
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,30%)]"
            : "min-w-0",
        )}
      >
        <div className="min-w-0">{editor}</div>
        {preview ? (
          <aside className="hidden min-w-0 lg:block lg:sticky lg:top-24 lg:self-start">{preview}</aside>
        ) : null}
      </div>
    </ArOpusPage>
  );
}
