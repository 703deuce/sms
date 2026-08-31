"use client";
import React, { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Modal } from "./ui";
import { formDefaults } from "../mock-data";

export default function PreviewFormModal({
  open, onClose, imageHue, emailRemoved, emailPlaceholder,
}: { open: boolean; onClose: () => void; imageHue: string | null; emailRemoved: boolean; emailPlaceholder: string }) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <Modal open={open} onClose={() => { setSubmitted(false); onClose(); }} width={860}>
      <div className="tv-landing-preview" style={{ minHeight: 480 }}>
        <div className="tv-landing-form">
          {!submitted ? (
            <>
              <h2 className="text-center text-2xl font-semibold tracking-tight" style={{ fontFamily: "Georgia, serif" }}>{formDefaults.heading}</h2>
              <p className="text-center text-xs leading-relaxed text-slate-300">{formDefaults.subtext}</p>
              <div className="flex gap-2">
                <div className="tv-input-mock flex-1">First Name</div>
                <div className="tv-input-mock flex-1">Last Name</div>
              </div>
              <div className="tv-input-mock">Mobile Number</div>
              {!emailRemoved && <div className="tv-input-mock">{emailPlaceholder}</div>}
              <button className="tv-btn-mock transition hover:brightness-105" onClick={() => setSubmitted(true)}>
                {formDefaults.buttonLabel}
              </button>
              <p className="text-[9px] leading-snug text-slate-400">
                By submitting, you agree to receive automated promotional messages. This agreement is not a condition of purchase. Text STOP to opt out or HELP for help. Message &amp; data rates apply. Terms and privacy policy can be found here.
              </p>
            </>
          ) : (
            <div className="tv-success-view">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <MessageCircle size={28} className="text-slate-200" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Check Your Texts</h2>
              <p className="max-w-[260px] text-xs leading-relaxed text-slate-300">
                We just sent you a message. Reply YES and we'll respond with your promo code.
              </p>
            </div>
          )}
        </div>
        <div className="tv-landing-img" style={imageHue ? { background: `linear-gradient(160deg, ${imageHue}, #1f2937)` } : undefined} />
      </div>
    </Modal>
  );
}
