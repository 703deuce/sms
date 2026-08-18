"use client";

import { PHONE_SETTINGS_SECTIONS, SHORT_TAGS } from "@/lib/realtor/dialer-crm-mock";
import { cn } from "@/lib/utils";
import {
  Headphones,
  Mic,
  Phone,
  Settings,
  Smartphone,
  Speaker,
  Volume2,
} from "lucide-react";
import { useState } from "react";

const SECTION_ICONS: Record<string, typeof Phone> = {
  general: Phone,
  "call-handling": Headphones,
  voicemail: Volume2,
  sms: Smartphone,
  display: Settings,
  devices: Speaker,
  ringtone: Volume2,
  advanced: Settings,
};

export function PhoneSettingsView() {
  const [section, setSection] = useState("general");
  const [toggles, setToggles] = useState({
    conferencing: true,
    autoDraft: true,
    alertSound: false,
    pushToTalk: true,
    noiseCancellation: true,
  });

  const toggle = (key: keyof typeof toggles) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Phone Settings</h1>
        <p className="mt-1 text-[15px] text-[#6b7280]">Manage your phone preferences, audio, and call handling.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[240px_1fr_260px]">
        <div className="realtor-card p-2">
          {PHONE_SETTINGS_SECTIONS.map((s) => {
            const Icon = SECTION_ICONS[s.id] ?? Phone;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition",
                  active ? "bg-purple-50 text-[#7c3aed]" : "hover:bg-[#f9fafb]",
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-[#7c3aed]" : "text-[#6b7280]")} />
                <div>
                  <p className="text-[13px] font-semibold">{s.label}</p>
                  <p className="text-[11px] text-[#9ca3af]">{s.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          {section === "general" ? (
            <>
              <div className="realtor-card p-5">
                <h3 className="font-semibold text-[#111827]">General Settings</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-[13px] font-medium text-[#374151]">Number format</label>
                    <select className="mt-1 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
                      <option>(555) 555-5555 (Standard USA & Canada)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-[#374151]">Default country calling code</label>
                    <select className="mt-1 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
                      <option>USA (+1)</option>
                    </select>
                  </div>
                  {[
                    { key: "conferencing" as const, label: "Audio Conferencing", desc: "Host conference calls for up to 50 people." },
                    { key: "autoDraft" as const, label: "Auto-Draft in Composer", desc: "Your draft is saved automatically as you type." },
                    { key: "alertSound" as const, label: "Alert Sound on Dialer", desc: "Play sound while using the dialer number pad." },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-medium">{item.label}</p>
                        <p className="text-[12px] text-[#6b7280]">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        className={cn("h-6 w-11 rounded-full transition", toggles[item.key] ? "bg-[#7c3aed]" : "bg-[#d1d5db]")}
                      >
                        <span className={cn("block h-5 w-5 rounded-full bg-white shadow transition", toggles[item.key] ? "ml-5" : "ml-0.5")} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="realtor-card p-5">
                <h3 className="font-semibold text-[#111827]">Audio Settings</h3>
                <div className="mt-4 space-y-4">
                  {[
                    { label: "Microphone", value: "Default - MacBook Pro Microphone" },
                    { label: "Speaker", value: "Default - MacBook Pro Speakers" },
                    { label: "Device", value: "Built-in Audio" },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-[13px] font-medium text-[#374151]">{field.label}</label>
                      <select className="mt-1 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
                        <option>{field.value}</option>
                      </select>
                    </div>
                  ))}
                  {[
                    { key: "pushToTalk" as const, label: "Push to Talk", desc: "Hold space to talk when calling." },
                    { key: "noiseCancellation" as const, label: "Noise Cancellation", desc: "Filter out background noise for clearer calls." },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-medium">{item.label}</p>
                        <p className="text-[12px] text-[#6b7280]">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        className={cn("h-6 w-11 rounded-full transition", toggles[item.key] ? "bg-[#7c3aed]" : "bg-[#d1d5db]")}
                      >
                        <span className={cn("block h-5 w-5 rounded-full bg-white shadow transition", toggles[item.key] ? "ml-5" : "ml-0.5")} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">Reset to Default</button>
                <button type="button" className="text-[13px] text-[#6b7280] hover:text-[#111827]">Discard changes</button>
              </div>
            </>
          ) : (
            <div className="realtor-card p-8 text-center text-[#6b7280]">
              <Settings className="mx-auto h-8 w-8 text-[#9ca3af]" />
              <p className="mt-3 font-medium text-[#111827]">
                {PHONE_SETTINGS_SECTIONS.find((s) => s.id === section)?.label}
              </p>
              <p className="mt-1 text-[13px]">
                {PHONE_SETTINGS_SECTIONS.find((s) => s.id === section)?.description}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Phone Status</h3>
            <button type="button" className="realtor-btn-outline mt-3 w-full border-emerald-500 text-emerald-600">
              + Connect Equipment
            </button>
            <ul className="mt-4 space-y-2 text-[13px]">
              {["Calling", "SMS", "Voicemail", "Record Call"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {item}
                  <span className="ml-auto text-emerald-600">Connected</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-[#9ca3af]">Last checked: Sept 15</p>
          </div>

          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Short Tags</h3>
            <ul className="mt-3 space-y-2">
              {SHORT_TAGS.map((tag) => (
                <li key={tag}>
                  <button type="button" className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-left text-[12px] hover:bg-[#f9fafb]">
                    {tag}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="realtor-card border-red-200 p-4">
            <h3 className="font-semibold text-red-600">Danger Zone</h3>
            <div className="mt-3 space-y-2 text-[13px]">
              <button type="button" className="block text-red-600 hover:underline">Restore Settings</button>
              <button type="button" className="block text-red-600 hover:underline">Delete All Notifications</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
