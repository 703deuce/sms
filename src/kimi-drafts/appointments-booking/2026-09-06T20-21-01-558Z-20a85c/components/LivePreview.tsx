"use client";

import React from "react";
import { Clock, ShieldCheck, MessageSquare } from "lucide-react";
import {
  appointmentTypes,
  whyBookItems,
  bookingUrl,
  type BookingAppointmentType,
} from "../mock-data";

type BusinessInfo = {
  displayName: string;
  timezone: string;
  phone: string;
  address: string;
};

type Props = {
  businessInfo: BusinessInfo;
  consentWording: string;
};

const whyIcons = {
  clock: Clock,
  shield: ShieldCheck,
  message: MessageSquare,
};

export default function LivePreview({ businessInfo, consentWording }: Props) {
  const initials = businessInfo.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="bk-preview" aria-label="Booking page preview">
      <div className="bk-preview-bar">
        <span className="bk-preview-dot" />
        <span className="bk-preview-dot" />
        <span className="bk-preview-dot" />
        <span className="bk-preview-url">{bookingUrl}</span>
      </div>
      <div className="bk-preview-body">
        <div className="bk-pv-biz">
          <span className="bk-pv-logo">{initials}</span>
          <div className="bk-pv-name">{businessInfo.displayName}</div>
          <div className="bk-pv-meta">
            {businessInfo.address} · {businessInfo.phone}
          </div>
        </div>

        {appointmentTypes.map((t: BookingAppointmentType) => (
          <div key={t.id} className="bk-pv-type">
            <div className="bk-pv-type-top">
              <span className="bk-pv-type-name">{t.name}</span>
              <span className="bk-pv-type-dur">{t.duration}</span>
            </div>
            <p className="bk-pv-type-desc">{t.description}</p>
          </div>
        ))}

        <div className="bk-pv-why">
          {whyBookItems.map((item) => {
            const Icon = whyIcons[item.icon];
            return (
              <div key={item.title} className="bk-pv-why-item">
                <Icon size={15} className="mx-auto text-blue-600" strokeWidth={2} />
                <div className="bk-pv-why-title">{item.title}</div>
                <div className="bk-pv-why-text">{item.text}</div>
              </div>
            );
          })}
        </div>

        <div className="bk-pv-consent">
          <span className="bk-pv-consent-box" aria-hidden="true" />
          <span className="bk-pv-consent-text">{consentWording}</span>
        </div>

        <div className="bk-pv-cta">Book appointment</div>
        <div className="bk-pv-foot">
          Powered by Transovo · Times shown in{" "}
          {businessInfo.timezone.replace("_", " ")}
        </div>
      </div>
    </div>
  );
}
