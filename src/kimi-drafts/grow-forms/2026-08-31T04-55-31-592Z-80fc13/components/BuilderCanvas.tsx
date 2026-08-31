"use client";
import React from "react";
import { MessageCircle } from "lucide-react";
import { formDefaults } from "../mock-data";

export default function BuilderCanvas({
  formType, view, imageHue, emailRemoved, emailPlaceholder, selected, onSelect,
}: {
  formType: "landing" | "embed";
  view: "form" | "success";
  imageHue: string | null;
  emailRemoved: boolean;
  emailPlaceholder: string;
  selected: string | null;
  onSelect: (s: string | null) => void;
}) {
  const sel = (id: string) => (selected === id ? "tv-selected" : "");
  const inner = view === "success" ? (
    <div className="tv-success-view" onClick={(e) => { e.stopPropagation(); onSelect("header"); }}>
      <MessageCircle size={32} className="text-slate-300" />
      <h2 className="text-xl font-semibold">Check Your Texts</h2>
      <p className="text-xs text-slate-300 max-w-[240px]">We just sent you a message. Reply YES and we'll respond with your promo code.</p>
    </div>
  ) : (
    <>
      <h2 data-tag="Header" onClick={(e) => { e.stopPropagation(); onSelect("header"); }}
        className={`text-2xl font-semibold text-center cursor-pointer rounded ${sel("header")}`}
        style={{ fontFamily: "Georgia, serif", outline: selected === "header" ? "2px solid #6366f1" : undefined }}>
        {formDefaults.heading}
      </h2>
      <p className="text-xs text-center text-slate-300">{formDefaults.subtext}</p>
      <div className="flex gap-2">
        <div className="tv-input-mock flex-1">First Name</div>
        <div className="tv-input-mock flex-1">Last Name</div>
      </div>
      <div className="tv-input-mock">Mobile Number</div>
      {!emailRemoved && (
        <div data-tag="Field" className={`tv-input-mock cursor-pointer ${sel("field")}`}
          onClick={(e) => { e.stopPropagation(); onSelect("field"); }}>
          {emailPlaceholder}
        </div>
      )}
      <div data-tag="Button" className={`tv-btn-mock cursor-pointer ${formType === "embed" ? "tv-dark-btn text-black" : ""} ${sel("button")}`}
        onClick={(e) => { e.stopPropagation(); onSelect("button"); }}>
        {formDefaults.buttonLabel}
      </div>
      <p className="text-[9px] text-slate-400 leading-snug">By submitting, you agree to receive automated promotional messages. This agreement is not a condition of purchase. Text STOP to opt out or HELP for help. Message & data rates apply. Terms and privacy policy can be found here.</p>
    </>
  );

  if (formType === "embed") {
    return (
      <div className="tv-embed-preview w-full max-w-[560px] mx-auto" onClick={() => onSelect(null)}>
        {inner}
      </div>
    );
  }
  return (
    <div className="tv-landing-preview w-full max-w-[720px] mx-auto" onClick={() => onSelect(null)}>
      <div className="tv-landing-form">{inner}</div>
      <div className="tv-landing-img cursor-pointer" data-tag="Column"
        style={{
          background: imageHue ? `linear-gradient(160deg, ${imageHue}, #1f2937)` : undefined,
          outline: selected === "column" ? "2px solid #6366f1" : undefined,
        }}
        onClick={(e) => { e.stopPropagation(); onSelect("column"); }} />
    </div>
  );
}
