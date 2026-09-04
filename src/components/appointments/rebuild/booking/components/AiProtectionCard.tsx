"use client";

import { ShieldCheck, Check } from "lucide-react";
import type { ProtectionMode, ProtectionModeOption } from "../types";

export default function AiProtectionCard({
  mode,
  modes,
  onChange,
}: {
  mode: ProtectionMode;
  modes: ProtectionModeOption[];
  onChange: (mode: ProtectionMode) => void;
}) {
  return (
    <div className="booking-card">
      <div className="flex items-start gap-3">
        <div className="card-icon">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">AI Booking Protection</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Screen public bookings for spam, bots, and suspicious patterns before they hit your calendar.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {modes.map((m) => {
          const selected = mode === m.value;
          return (
            <button
              key={m.value}
              className={`mode-option text-left ${selected ? "selected" : ""}`}
              onClick={() => onChange(m.value)}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    selected ? "border-[#5b4be0] bg-[#5b4be0]" : "border-[#cfcfda]"
                  }`}
                >
                  {selected ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} /> : null}
                </span>
                <span className="text-[13px] font-semibold text-foreground">{m.label}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
                {m.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
