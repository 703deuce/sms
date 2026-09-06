"use client";

import React, { useState } from "react";
import { ArrowLeft, Clock, MailQuestion, ShieldCheck } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TOGGLES: Array<{ key: string; label: string; helper: string }> = [
  { key: "read", label: "Mark conversations as read when opened", helper: "Opening a conversation automatically clears its unread state." },
  { key: "assignReply", label: "Assign to me when I reply", helper: "Replying to an unassigned conversation assigns it to you." },
  { key: "closeResolve", label: "Suggest closing resolved conversations", helper: "Show a prompt when a conversation appears resolved." },
];

export function InboxSettings({ onBack }: { onBack: () => void }) {
  const [awayEnabled, setAwayEnabled] = useState(true);
  const [officeHours, setOfficeHours] = useState(true);
  const [awayMessage, setAwayMessage] = useState("Thanks for reaching out! We're currently away but will respond during business hours (Mon–Fri, 9 AM – 5 PM ET). Reply RESCHEDULE to move an existing appointment.");
  const [awayInside, setAwayInside] = useState("");
  const [activeDays, setActiveDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [toggles, setToggles] = useState<Record<string, boolean>>({ read: true, assignReply: true, closeResolve: false });
  const [saved, setSaved] = useState(false);

  const toggleDay = (d: string) => setActiveDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  return (
    <div className="tv-settings">
      <div className="tv-settings-inner">
        <button type="button" className="tv-btn sm" onClick={onBack} style={{ marginBottom: 14 }}>
          <ArrowLeft size={13} /> Back to Inbox
        </button>
        <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>General Inbox Settings</h2>
        <p style={{ fontSize: 12.5, color: "var(--tv-muted)", marginTop: 3, marginBottom: 18 }}>Manage general inbox rules and behaviors.</p>

        {saved ? (
          <div style={{ marginBottom: 14, padding: "9px 13px", borderRadius: 9, background: "var(--tv-green-soft)", border: "1px solid #a7f3d0", color: "var(--tv-green)", fontSize: 12.5, fontWeight: 600 }}>
            Settings saved.
          </div>
        ) : null}

        <div className="tv-card" style={{ marginBottom: 16 }}>
          <div className="tv-card-head" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <MailQuestion size={15} style={{ color: "var(--tv-muted)" }} /> Away Message
          </div>
          <div className="tv-card-body">
            <div className="tv-toggle-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Enable away message</div>
                <div className="tv-helper">Automatically reply when contacts message outside your availability.</div>
              </div>
              <button type="button" role="switch" aria-checked={awayEnabled} aria-label="Enable away message" className={"tv-switch" + (awayEnabled ? " on" : "")} onClick={() => setAwayEnabled((v) => !v)} />
            </div>
            {awayEnabled ? (
              <>
                <div className="tv-field" style={{ marginTop: 10 }}>
                  <label className="tv-label" htmlFor="away-out">Outside office hours</label>
                  <textarea id="away-out" className="tv-textarea" value={awayMessage} onChange={(e) => setAwayMessage(e.target.value)} />
                </div>
                <div className="tv-field" style={{ marginBottom: 0 }}>
                  <label className="tv-label" htmlFor="away-in">During office hours — Optional</label>
                  <textarea id="away-in" className="tv-textarea" value={awayInside} onChange={(e) => setAwayInside(e.target.value)} placeholder="Leave blank to disable during business hours" />
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="tv-card" style={{ marginBottom: 16 }}>
          <div className="tv-card-head" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Clock size={15} style={{ color: "var(--tv-muted)" }} /> Office Hours
          </div>
          <div className="tv-card-body">
            <div className="tv-toggle-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Use office hours</div>
                <div className="tv-helper">Away messages only send outside these days. Times follow workspace timezone (America/New_York).</div>
              </div>
              <button type="button" role="switch" aria-checked={officeHours} aria-label="Use office hours" className={"tv-switch" + (officeHours ? " on" : "")} onClick={() => setOfficeHours((v) => !v)} />
            </div>
            {officeHours ? (
              <div style={{ marginTop: 12 }}>
                <span className="tv-label">Active days</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DAYS.map((d) => (
                    <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={activeDays.includes(d)}
                      className={"tv-daychip" + (activeDays.includes(d) ? " active" : "")}>{d}</button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="tv-card" style={{ marginBottom: 18 }}>
          <div className="tv-card-head" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <ShieldCheck size={15} style={{ color: "var(--tv-muted)" }} /> Inbox Behaviors
          </div>
          <div className="tv-card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {TOGGLES.map((t) => (
              <div key={t.key} className="tv-toggle-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                  <div className="tv-helper">{t.helper}</div>
                </div>
                <button type="button" role="switch" aria-checked={!!toggles[t.key]} aria-label={t.label}
                  className={"tv-switch" + (toggles[t.key] ? " on" : "")}
                  onClick={() => setToggles((prev) => ({ ...prev, [t.key]: !prev[t.key] }))} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="tv-btn primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}>Save changes</button>
          <button type="button" className="tv-btn" onClick={onBack}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
