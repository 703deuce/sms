"use client";

import { AutoReplyStatusToggle } from "@/components/auto-replies/auto-reply-ui";
import { cn } from "@/lib/utils";

export function AiReplyStatusToggle(props: {
  active: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return <AutoReplyStatusToggle {...props} label="Toggle AI reply status" />;
}

export function AiWizardStepper({
  steps,
  activeIndex,
}: {
  steps: string[];
  activeIndex: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {steps.map((label, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                isDone
                  ? "bg-emerald-600 text-white"
                  : isActive
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "text-[12px] font-semibold",
                isActive ? "text-primary" : "text-slate-500",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-slate-200 sm:block" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AiChatPreview({
  messages,
  senderLabel,
  className,
}: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  senderLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <p className="mb-3 text-[12px] font-medium text-slate-500">Preview as customer</p>
      <div className="w-[280px] rounded-[32px] border-[6px] border-slate-900 bg-slate-900 p-2 shadow-xl">
        <div className="rounded-[26px] bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-center">
            <p className="text-[11px] font-semibold text-slate-900">
              {senderLabel || "Messages"}
            </p>
          </div>
          <div className="flex min-h-[320px] flex-col gap-2 bg-slate-50 p-4">
            {messages.length === 0 ? (
              <p className="text-center text-[12px] text-slate-400">
                Chat preview will appear here
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                    m.role === "user"
                      ? "rounded-bl-md bg-slate-200 text-slate-900"
                      : "ml-auto rounded-br-md bg-primary text-white",
                  )}
                >
                  {m.content}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
