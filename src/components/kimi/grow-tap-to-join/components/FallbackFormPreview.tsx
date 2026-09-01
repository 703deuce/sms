"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function FallbackFormPreview({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="ttj-fallback-overlay backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        className="ttj-fallback-close transition-colors hover:bg-muted"
        onClick={onClose}
        aria-label="Close preview"
      >
        <X size={18} />
      </button>
      <div
        className="ttj-fallback-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Want 30% Off?</h2>
        <p>Join our VIP text list and receive a code for 30% off your purchase during our Black Friday/Cyber Monday sale.</p>
        <div className="ttj-fallback-grid">
          <input placeholder="First Name" />
          <input placeholder="Last Name" />
        </div>
        <input placeholder="Mobile Number" />
        <input placeholder="Email" />
        <button className="ttj-fallback-submit">Join Now</button>
        <span className="ttj-fallback-fine">
          By entering your phone number and submitting this form, you consent to receive marketing text messages
          (such as promotion codes and cart reminders) from Transovo at the number provided. Consent is not a
          condition of any purchase. Message and data rates may apply.
        </span>
      </div>
    </div>
  );
}
