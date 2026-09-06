"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

export function BookingLoading() {
  return (
    <div className="booking-page animate-pulse" aria-busy="true" aria-label="Loading booking settings">
      <div className="h-7 w-36 rounded-md bg-gray-200 mb-2" />
      <div className="h-4 w-80 rounded-md bg-gray-100 mb-6" />
      <div className="booking-grid">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="h-[520px] rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}

export function BookingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="booking-page flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">
          We couldn&apos;t load booking settings
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
          Something went wrong while fetching your booking page configuration.
          Your settings were not changed.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
