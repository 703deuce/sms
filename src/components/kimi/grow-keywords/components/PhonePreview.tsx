"use client";

import { complianceFooter } from "../mock-data";

export default function PhonePreview({
  keyword,
  message,
}: {
  keyword: string;
  message: string;
}) {
  return (
    <div className="sticky top-6 w-[300px] shrink-0">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Message Preview
      </div>
      <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lg ring-1 ring-black/5">
        {/* Status bar */}
        <div className="flex items-center justify-between bg-muted/40 px-5 pb-1.5 pt-3">
          <span className="text-[11px] font-semibold text-foreground">9:41</span>
          <div className="h-[18px] w-[72px] rounded-full bg-foreground/90" />
          <span className="flex items-end gap-[2.5px]">
            <span className="w-[3px] rounded-sm bg-foreground/80" style={{ height: 4 }} />
            <span className="w-[3px] rounded-sm bg-foreground/80" style={{ height: 6 }} />
            <span className="w-[3px] rounded-sm bg-foreground/80" style={{ height: 8 }} />
            <span className="w-[3px] rounded-sm bg-foreground/80" style={{ height: 10 }} />
          </span>
        </div>
        {/* Conversation header */}
        <div className="flex items-center gap-2.5 border-b border-border bg-card px-4 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
            T
          </div>
          <span className="text-[13px] font-semibold text-foreground">Transovo</span>
        </div>

        <div className="flex min-h-[340px] flex-col gap-2 bg-muted/30 px-3.5 py-4">
          {keyword ? (
            <div className="flex flex-col items-end">
              <div className="kw-fade max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[12.5px] leading-relaxed text-primary-foreground shadow-sm">
                {keyword}
              </div>
              <div className="mt-1 text-[10.5px] font-medium text-muted-foreground">
                Delivered
              </div>
            </div>
          ) : null}
          {message ? (
            <div className="kw-fade max-w-[85%] self-start whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground shadow-sm">
              {message}
              {"\n\n"}
              <span className="text-[10.5px] leading-relaxed text-muted-foreground">
                {complianceFooter}
              </span>
            </div>
          ) : null}
          {!keyword && !message && (
            <div className="m-auto max-w-[210px] text-center text-[12px] leading-relaxed text-muted-foreground">
              Start typing to preview how your keyword conversation will look on a
              subscriber&apos;s phone.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
