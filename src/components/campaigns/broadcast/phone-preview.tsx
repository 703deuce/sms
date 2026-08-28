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
      <p className="mb-3 text-[12px] font-medium text-[#6b7280]">
        Preview as: {previewName}
      </p>
      <div className="w-[280px] rounded-[32px] border-[6px] border-[#111827] bg-[#111827] p-2 shadow-xl">
        <div className="rounded-[26px] bg-white">
          <div className="border-b border-[#f3f4f6] px-4 py-3 text-center">
            <p className="text-[11px] font-semibold text-[#111827]">
              {senderLabel ? formatPhone(senderLabel) : "Messages"}
            </p>
          </div>
          <div className="min-h-[320px] bg-[#f9fafb] p-4">
            {message.trim() ? (
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#e5e7eb] px-3 py-2.5 text-[13px] leading-relaxed text-[#111827]">
                <p className="whitespace-pre-wrap break-words">{message}</p>
              </div>
            ) : (
              <p className="text-center text-[12px] text-[#9ca3af]">
                Your message preview will appear here
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
