"use client";

import React, { useState } from "react";
import {
  Monitor,
  Smartphone,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  Clock,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { BookingPageModel } from "@/features/appointments/kimi/booking/types";

const whyIcons: Record<string, React.ReactNode> = {
  clock: <Clock size={13} />,
  shield: <ShieldCheck size={13} />,
  message: <MessageSquare size={13} />,
};

type Props = {
  businessInfo: BookingPageModel["businessInfo"];
  appointmentTypes: BookingPageModel["appointmentTypes"];
  whyBookItems: BookingPageModel["whyBookItems"];
  smsConsent: BookingPageModel["smsConsent"];
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function LivePreview({
  businessInfo,
  appointmentTypes,
  whyBookItems,
  smsConsent,
}: Props) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const types = appointmentTypes.length
    ? appointmentTypes
    : [
        {
          id: "placeholder",
          name: "Consultation",
          duration: "30 min",
          description: "Add an appointment type to preview your booking page.",
        },
      ];

  return (
    <div>
      <div className="preview-card">
        <div className="preview-head">
          <span className="preview-head-title">Live preview</span>
          <div className="preview-device-btns">
            <button
              type="button"
              className={`preview-device-btn${device === "desktop" ? " active" : ""}`}
              onClick={() => setDevice("desktop")}
              aria-label="Desktop preview"
            >
              <Monitor size={14} />
            </button>
            <button
              type="button"
              className={`preview-device-btn${device === "mobile" ? " active" : ""}`}
              onClick={() => setDevice("mobile")}
              aria-label="Mobile preview"
            >
              <Smartphone size={14} />
            </button>
          </div>
        </div>

        <div className="preview-frame" style={device === "mobile" ? { maxWidth: 320, margin: "0 auto" } : undefined}>
          <div className="preview-banner">
            <div className="preview-avatar">{initials(businessInfo.displayName)}</div>
          </div>
          <div className="preview-body">
            <h4 className="preview-biz-name">{businessInfo.displayName}</h4>
            <div className="preview-biz-meta">
              <span><Phone size={11} /> {businessInfo.phone || "—"}</span>
              <span><MapPin size={11} /> {businessInfo.address || "—"}</span>
            </div>

            <p className="preview-section-title">Select appointment type</p>
            {types.map((t) => (
              <button key={t.id} type="button" className="preview-type">
                <div>
                  <div className="preview-type-name">
                    <Calendar size={13} /> {t.name}
                  </div>
                  <div className="preview-type-dur">{t.duration}</div>
                  <div className="preview-type-desc">{t.description}</div>
                </div>
                <ChevronRight size={15} style={{ color: "#9b99a8", flexShrink: 0 }} />
              </button>
            ))}

            <p className="preview-section-title">Why book with us?</p>
            <div className="preview-why">
              {whyBookItems.map((w) => (
                <div key={w.title} className="preview-why-item">
                  <div className="preview-why-icon">{whyIcons[w.icon]}</div>
                  <div className="preview-why-title">{w.title}</div>
                  <div className="preview-why-text">{w.text}</div>
                </div>
              ))}
            </div>

            <p className="preview-legal">
              By booking, you agree to our <a href={smsConsent.termsUrl}>Terms of Service</a> and{" "}
              <a href={smsConsent.privacyUrl}>Privacy Policy</a>.
              <br />
              Message and data rates may apply. Reply STOP to opt out.
            </p>

            <div className="preview-powered">
              <Sparkles size={12} /> Powered by Transovo
            </div>
          </div>
        </div>
      </div>
      <p className="preview-footnote">
        Preview is an approximation and may vary slightly from the live booking page.
      </p>
    </div>
  );
}
