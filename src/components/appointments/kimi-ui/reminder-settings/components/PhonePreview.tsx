import { Signal, Wifi, BatteryFull } from 'lucide-react';

function renderMessage(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    p.startsWith('http') ? (
      <a key={i} href="#" onClick={(e) => e.preventDefault()} className="text-[#147d74] break-all">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function PhonePreview({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border bg-[#fafafa] p-3">
      <div className="mx-auto max-w-[260px]">
        {/* status bar */}
        <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] text-muted-foreground">
          <span className="font-medium">12:30</span>
          <div className="flex items-center gap-1 text-foreground">
            <Signal className="h-2.5 w-2.5" />
            <Wifi className="h-2.5 w-2.5" />
            <BatteryFull className="h-3 w-3" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-[11px] font-semibold text-[#6b7280]">
              T
            </div>
            <div className="min-w-0">
              <div className="mb-1 text-[10px] text-muted-foreground">Transovo</div>
              <div className="rounded-xl rounded-tl-sm bg-[#f3f4f6] p-2.5 text-[10.5px] leading-snug text-foreground">
                {renderMessage(message)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
