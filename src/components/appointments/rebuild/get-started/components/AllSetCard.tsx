"use client";

import React from "react";
import { PartyPopper, CheckSquare } from "lucide-react";

export default function AllSetCard({
  onboardingComplete,
  saving,
  loading,
  onMarkComplete,
}: {
  onboardingComplete: boolean;
  saving: boolean;
  loading: boolean;
  onMarkComplete: () => void;
}) {
  return (
    <div className="allset-card">
      <div className="allset-card__icon">
        <PartyPopper size={22} />
      </div>
      <div className="allset-card__text">
        <h3 className="allset-card__title">
          {onboardingComplete ? "Setup marked complete" : "You&apos;re all set!"}
        </h3>
        <p className="allset-card__desc">
          {onboardingComplete
            ? "You can revisit any step above anytime."
            : "Mark setup complete when you are ready — you can return to these steps anytime."}
        </p>
      </div>
      <button
        className="allset-card__btn"
        type="button"
        disabled={onboardingComplete || saving || loading}
        onClick={onMarkComplete}
      >
        <CheckSquare size={15} />{" "}
        {onboardingComplete ? "Setup complete" : saving ? "Saving…" : "Mark setup complete"}
      </button>
    </div>
  );
}
