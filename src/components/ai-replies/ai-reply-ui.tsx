"use client";

import { AutoReplyStatusToggle } from "@/components/auto-replies/auto-reply-ui";
import { cn } from "@/lib/utils";
import { Bot, Check, Signal, Wifi, BatteryFull } from "lucide-react";

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
    <ol className="mb-6 flex flex-wrap items-center gap-y-3">
      {steps.map((label, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <li key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  isDone
                    ? "bg-emerald-100 text-emerald-700"
                    : isActive
                      ? "bg-primary text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-400",
                )}
              >
                {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  isActive ? "text-foreground" : isDone ? "text-slate-600" : "text-slate-400",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "mx-3 hidden h-px w-6 sm:block",
                  isDone ? "bg-emerald-200" : "bg-slate-200",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
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
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Live preview
      </p>
      <div className="w-[300px] rounded-[40px] border border-slate-800/60 bg-slate-900 p-[10px] shadow-2xl shadow-slate-900/25">
        <div className="relative overflow-hidden rounded-[32px] bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-white px-6 pb-1 pt-2.5">
            <span className="text-[10px] font-semibold text-slate-900">9:41</span>
            <span className="absolute left-1/2 top-[6px] h-[18px] w-[80px] -translate-x-1/2 rounded-full bg-slate-900" />
            <span className="flex items-center gap-1 text-slate-900">
              <Signal className="h-3 w-3" />
              <Wifi className="h-3 w-3" />
              <BatteryFull className="h-3.5 w-3.5" />
            </span>
          </div>
          {/* Chat header */}
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-white px-4 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-slate-900">
                {senderLabel || "AI Agent"}
              </p>
              <p className="flex items-center gap-1 text-[10px] text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </p>
            </div>
          </div>
          {/* Messages */}
          <div className="flex min-h-[340px] flex-col gap-2 bg-slate-50/80 px-3.5 py-4">
            <p className="mb-1 text-center text-[10px] font-medium text-slate-400">
              Today
            </p>
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200/60">
                  <Bot className="h-5 w-5" />
                </span>
                <p className="max-w-[190px] text-[11px] leading-relaxed text-slate-400">
                  Type a test message to see how your agent responds
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed",
                    m.role === "user"
                      ? "self-start rounded-bl-md border border-slate-200/80 bg-white text-slate-800 shadow-sm"
                      : "ml-auto self-end rounded-br-md bg-primary text-white shadow-sm shadow-primary/25",
                  )}
                >
                  {m.content}
                </div>
              ))
            )}
          </div>
          {/* Input bar */}
          <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
            <span className="h-7 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-[11px] leading-7 text-slate-400">
              Text Message
            </span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <path d="M3.4 20.4l17.1-8.4L3.4 3.6l-.01 6.53L14 12 3.39 13.87z" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
