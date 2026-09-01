"use client";

import { cn, formatPhone } from "@/lib/utils";

export function PhonePreview({
  message,
  senderLabel,
  previewName = "Anthony Johnson",
  className,
}: {
  message: string;
  senderLabel?: string;
  previewName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <p className="mb-3 text-[12px] font-medium text-muted-foreground">
        Preview as: <span className="font-semibold text-foreground">{previewName}</span>
      </p>
      <div className="w-[280px] rounded-[36px] border border-border bg-[#111827] p-2.5 shadow-[0_20px_50px_-12px_rgba(17,24,39,0.35)]">
        <div className="overflow-hidden rounded-[27px] bg-white">
          {/* Notch */}
          <div className="relative flex justify-center bg-white pt-2">
            <div className="h-[18px] w-[92px] rounded-full bg-[#111827]" />
          </div>
          <div className="border-b border-[#f3f4f6] px-4 pb-3 pt-2 text-center">
            <p className="text-[11px] font-semibold text-[#111827]">
              {senderLabel ? formatPhone(senderLabel) : "Messages"}
            </p>
            <p className="text-[9px] text-[#9ca3af]">Text Message · SMS</p>
          </div>
          <div className="min-h-[320px] bg-[#f9fafb] p-4">
            {message.trim() ? (
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#e9e9eb] px-3 py-2.5 text-[13px] leading-relaxed text-[#111827] shadow-sm">
                <p className="whitespace-pre-wrap break-words">{message}</p>
              </div>
            ) : (
              <div className="flex h-[280px] items-center justify-center">
                <p className="max-w-[180px] text-center text-[12px] leading-relaxed text-[#9ca3af]">
                  Your message preview will appear here
                </p>
              </div>
            )}
          </div>
          {/* Input bar */}
          <div className="flex items-center gap-2 border-t border-[#f3f4f6] bg-white px-3 py-2.5">
            <div className="h-7 flex-1 rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-3 text-[11px] leading-7 text-[#9ca3af]">
              Text Message
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d1d5db]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white">
                <path d="M12 4l8 8-1.4 1.4L13 7.8V20h-2V7.8l-5.6 5.6L4 12z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
