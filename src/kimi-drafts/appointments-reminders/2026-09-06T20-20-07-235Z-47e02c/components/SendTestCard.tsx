"use client";

import { useState } from "react";
import { Send, Check, AlertCircle } from "lucide-react";
import type { ReminderStepKey } from "../mock-data";

type Option = { key: ReminderStepKey; label: string };

export default function SendTestCard({
  options,
  readOnly = false,
}: {
  options: Option[];
  readOnly?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<ReminderStepKey>("confirmation");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const send = () => {
    if (!phone.trim()) {
      setError("Enter a mobile number to send the test.");
      return;
    }
    setError("");
    setSending(true);
    setSent(false);
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 900);
  };

  return (
    <section className="rs-card" aria-labelledby="send-test-h">
      <div className="rs-card-hd">
        <span className="rs-icon-tile">
          <Send className="h-4 w-4" />
        </span>
        <div>
          <h2 id="send-test-h" className="text-[13.5px] font-semibold text-gray-900">
            Send a test reminder
          </h2>
          <p className="text-[12px] text-gray-500">
            Preview how a reminder looks on a real phone before it goes to customers.
          </p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label htmlFor="test-step" className="mb-1 block text-[12px] font-medium text-gray-600">
            Reminder
          </label>
          <select
            id="test-step"
            className="rs-select w-full"
            value={step}
            disabled={readOnly}
            onChange={(e) => setStep(e.target.value as ReminderStepKey)}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="test-phone" className="mb-1 block text-[12px] font-medium text-gray-600">
            Mobile number
          </label>
          <div className="flex gap-2">
            <input
              id="test-phone"
              type="tel"
              className="rs-input flex-1"
              placeholder="(571) 555-1234"
              value={phone}
              disabled={readOnly}
              onChange={(e) => {
                setPhone(e.target.value);
                setSent(false);
                setError("");
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || readOnly}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending…" : "Send test"}
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="flex items-center gap-1.5 text-[12px] font-medium text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        ) : null}
        {sent ? (
          <p role="status" className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Test reminder sent. Check your phone.
          </p>
        ) : null}
      </div>
    </section>
  );
}
