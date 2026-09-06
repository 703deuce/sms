"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import {
  protectionOptions,
  suspiciousBookings,
  type ProtectionMode,
} from "../mock-data";

type Props = {
  mode: ProtectionMode;
  onModeChange: (mode: ProtectionMode) => void;
};

export default function AiProtectionCard({ mode, onModeChange }: Props) {
  return (
    <section className="bk-card" aria-labelledby="bk-protect-title">
      <h2 id="bk-protect-title" className="bk-card-title">
        <ShieldCheck size={15} className="text-blue-600" strokeWidth={2} />
        Booking protection
      </h2>
      <p className="bk-card-desc">
        Screen online bookings for spam and abuse before they reach your
        calendar.
      </p>

      <div className="mt-3" role="radiogroup" aria-label="Booking protection mode">
        {protectionOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={mode === opt.id}
            className="bk-protect-opt w-full text-left"
            data-active={mode === opt.id}
            onClick={() => onModeChange(opt.id)}
          >
            <span className="bk-protect-radio" aria-hidden="true" />
            <span>
              <span className="bk-protect-name">{opt.name}</span>
              <span className="bk-protect-desc block">{opt.description}</span>
            </span>
          </button>
        ))}
      </div>

      {suspiciousBookings.length > 0 && mode !== "off" && (
        <>
          <p className="bk-label mt-5 mb-0">Recently screened bookings</p>
          <table className="bk-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Booking type</th>
                <th scope="col">Risk</th>
                <th scope="col">Action</th>
                <th scope="col">Signals</th>
              </tr>
            </thead>
            <tbody>
              {suspiciousBookings.map((sb) => (
                <tr key={sb.id}>
                  <td className="whitespace-nowrap">{sb.at}</td>
                  <td>{sb.serviceName ?? "—"}</td>
                  <td>
                    <span
                      className={
                        sb.riskLevel === "HIGH"
                          ? "bk-chip bk-chip-danger"
                          : sb.riskLevel === "MEDIUM"
                          ? "bk-chip bk-chip-warn"
                          : "bk-chip bk-chip-off"
                      }
                    >
                      {sb.riskLevel}
                    </span>
                  </td>
                  <td className="capitalize">{sb.action}ed</td>
                  <td className="bk-signals">{sb.signals.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
