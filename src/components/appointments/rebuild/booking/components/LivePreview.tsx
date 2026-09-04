"use client";

import { useState } from "react";
import {
  Monitor,
  Smartphone,
  Phone,
  MapPin,
  ChevronRight,
  CalendarDays,
  Clock,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { BusinessPreviewInfo, PreviewAppointmentType } from "../types";

const trustPoints = [
  {
    id: "fast",
    icon: "clock" as const,
    title: "Fast & Easy",
    description: "Book in just a few clicks.",
  },
  {
    id: "secure",
    icon: "shield" as const,
    title: "Secure & Private",
    description: "Your information is always protected.",
  },
  {
    id: "reminders",
    icon: "message" as const,
    title: "SMS Reminders",
    description: "Get timely reminders on your phone.",
  },
];

const trustIcons = {
  clock: Clock,
  shield: ShieldCheck,
  message: MessageSquare,
} as const;

export default function LivePreview({
  businessInfo,
  appointmentTypes,
  termsUrl,
  privacyUrl,
}: {
  businessInfo: BusinessPreviewInfo;
  appointmentTypes: PreviewAppointmentType[];
  termsUrl: string;
  privacyUrl: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="booking-card !p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13.5px] font-semibold text-foreground">Live preview</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDevice("desktop")}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              device === "desktop"
                ? "bg-[#efedfc] text-[#5b4be0]"
                : "text-muted-foreground hover:bg-gray-100"
            }`}
            aria-label="Desktop preview"
            type="button"
          >
            <Monitor className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <button
            onClick={() => setDevice("mobile")}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              device === "mobile"
                ? "bg-[#efedfc] text-[#5b4be0]"
                : "text-muted-foreground hover:bg-gray-100"
            }`}
            aria-label="Mobile preview"
            type="button"
          >
            <Smartphone className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden rounded-xl border border-[#ececf1] bg-white mx-auto transition-all ${
          device === "mobile" ? "max-w-[300px]" : "w-full"
        }`}
      >
        <div className="relative h-[92px] bg-gradient-to-br from-[#8b7ff0] via-[#a99df5] to-[#c7bffc]">
          <div className="absolute -bottom-8 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-[#5b4be0] text-[18px] font-bold text-white shadow-sm">
            {businessInfo.initials || "?"}
          </div>
        </div>

        <div className="px-5 pb-5 pt-11 text-center">
          <h4 className="text-[16px] font-bold text-foreground">
            {businessInfo.displayName || "Your business"}
          </h4>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
            {businessInfo.phone ? (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" strokeWidth={1.9} />
                {businessInfo.phone}
              </span>
            ) : null}
            {businessInfo.address ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" strokeWidth={1.9} />
                {businessInfo.address}
              </span>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[#f1f1f5] px-5 py-4 text-left">
          <h5 className="mb-3 text-[13px] font-semibold text-foreground">Select appointment type</h5>
          {appointmentTypes.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Create an appointment type to show options here.
            </p>
          ) : (
            <div className="space-y-2.5">
              {appointmentTypes.map((a) => (
                <div key={a.id} className="appt-row">
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="mt-0.5 h-3.5 w-3.5 text-[#5b4be0]" strokeWidth={1.9} />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground">{a.duration}</p>
                      {a.description ? (
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {a.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" strokeWidth={1.9} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#f1f1f5] px-5 py-4 text-left">
          <h5 className="mb-3 text-[13px] font-semibold text-foreground">Why book with us?</h5>
          <div className="grid grid-cols-3 gap-2">
            {trustPoints.map((t) => {
              const Icon = trustIcons[t.icon];
              return (
                <div key={t.id} className="flex flex-col items-start gap-1.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#efedfc] text-[#5b4be0]">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </div>
                  <p className="text-[11.5px] font-semibold text-foreground">{t.title}</p>
                  <p className="text-[10.5px] leading-snug text-muted-foreground">{t.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#f1f1f5] px-5 py-4 text-center">
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            By booking, you agree to our{" "}
            <span className="text-[#5b4be0] underline underline-offset-2">{termsUrl || "Terms of Service"}</span>{" "}
            and{" "}
            <span className="text-[#5b4be0] underline underline-offset-2">{privacyUrl || "Privacy Policy"}</span>.
            <br />
            Message and data rates may apply. Reply STOP to opt out.
          </p>
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ececf1] bg-white px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm">
              <Sparkles className="h-3 w-3 text-[#5b4be0]" strokeWidth={1.9} />
              Powered by Transovo
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Preview is an approximation and may vary slightly from the live booking page.
      </p>
    </div>
  );
}
