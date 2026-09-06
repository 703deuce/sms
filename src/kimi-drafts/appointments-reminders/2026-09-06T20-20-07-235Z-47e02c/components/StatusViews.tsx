"use client";

import { AlertTriangle, BellRing } from "lucide-react";

export function RemindersLoading() {
  return (
    <div className="reminder-settings-page mx-auto max-w-[1100px] px-8 py-7">
      <div className="rs-skel mb-2 h-7 w-64" />
      <div className="rs-skel mb-6 h-4 w-96" />
      <div className="grid grid-cols-2 gap-4">
        <div className="rs-skel h-40 rounded-xl" />
        <div className="rs-skel h-40 rounded-xl" />
      </div>
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rs-skel h-52 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function RemindersError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="reminder-settings-page mx-auto flex min-h-[60vh] max-w-[1100px] items-center justify-center px-8 py-7">
      <div className="max-w-md rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
        <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">
          We couldn&apos;t load reminder settings
        </h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching your reminder templates. Your saved settings are
          unchanged.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function RemindersEmpty({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="reminder-settings-page mx-auto flex min-h-[60vh] max-w-[1100px] items-center justify-center px-8 py-7">
      <div className="max-w-md rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
        <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <BellRing className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">No reminders configured yet</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Set up automatic appointment reminders to reduce no-shows. Start with the recommended
          sequence — confirmation at booking, 24 hours before, and 2 hours before.
        </p>
        <button
          type="button"
          onClick={onEnable}
          className="mt-5 inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Set up recommended reminders
        </button>
      </div>
    </div>
  );
}
