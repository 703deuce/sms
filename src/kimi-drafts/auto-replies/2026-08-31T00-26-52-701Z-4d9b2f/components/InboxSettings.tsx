"use client";
import React, { useState } from "react";
import { inboxSettingsInit, officeDays } from "../mock-data";
import { Toggle, MessageEditor } from "./Shared";

function SettingRow({
  title, description, on, onChange,
}: { title: string; description: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="tv-card mb-3 flex items-start justify-between gap-6 p-5">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-[13px] tv-muted leading-relaxed">{description}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export default function InboxSettings() {
  const [s, setS] = useState(inboxSettingsInit);
  const [days, setDays] = useState(officeDays);
  const set = (k: keyof typeof inboxSettingsInit) => (v: boolean) => setS((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <h2 className="text-xl font-bold">General Inbox Settings</h2>
      <p className="mt-1 mb-6 text-[13px] tv-muted">Manage general inbox rules and behaviors.</p>

      <SettingRow title="Inbox On" description="Engage in real-time, one-on-one messaging using your text number. Manage conversations, collaborate with team members and connect with contacts using this powerful two-way messaging tool." on={s.inboxOn} onChange={set("inboxOn")} />
      <SettingRow title="Allow Starting Conversations" description="This determines whether or not team members have the ability to start conversations or reply to existing ones that are closed." on={s.allowStarting} onChange={set("allowStarting")} />
      <SettingRow title="Allow Conversation Assignment" description="This determines whether or not team members have the ability to assign conversations to other teammates." on={s.allowAssignment} onChange={set("allowAssignment")} />
      <SettingRow title="Allow Conversation Tagging" description="This determines whether or not team members have the ability to tag conversations." on={s.allowTagging} onChange={set("allowTagging")} />
      <SettingRow title="Private Conversations" description="This determines whether or not team members have visibility into conversations that aren't assigned to them." on={s.privateConversations} onChange={set("privateConversations")} />

      {/* Office Hours */}
      <div className="tv-card mb-3 p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold">Office Hours</div>
            <p className="mt-1 text-[13px] tv-muted leading-relaxed">
              This allows you to specify the days and times that teammates are generally online and available. Setting your office hours then allows you to take various actions based on whether or not certain events occur inside or outside those times.
            </p>
          </div>
          <Toggle on={s.officeHours} onChange={set("officeHours")} />
        </div>
        {s.officeHours && (
          <div className="mt-5 space-y-2">
            {days.map((d, i) => (
              <div key={d.day} className="flex items-center gap-3">
                <button
                  className={`tv-day-chip ${d.enabled ? "on" : ""}`}
                  style={{ width: 110, textAlign: "left" }}
                  onClick={() => setDays((p) => p.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)))}
                >
                  {d.day}
                </button>
                <select className="tv-select" disabled={!d.enabled} defaultValue={d.from}><option>9:00 am</option><option>8:00 am</option><option>10:00 am</option></select>
                <span className="text-xs tv-muted">To</span>
                <select className="tv-select" disabled={!d.enabled} defaultValue={d.to}><option>5:00 pm</option><option>6:00 pm</option><option>9:00 pm</option></select>
                <span className="text-xs tv-muted">{d.tz}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SettingRow title="Conversation Auto-Assignment" description="This setting allows you to automatically assign unassigned conversations to teammates when new inbound messages are received." on={s.autoAssignment} onChange={set("autoAssignment")} />
      <SettingRow title="Conversation Auto-Close" description="This setting allows open and pending conversations to be automatically closed after a specific number of days without messaging or status change activity." on={s.autoClose} onChange={set("autoClose")} />
      <SettingRow title="Unassign Conversations When Closed" description="This determines whether or not a conversation should be automatically unassigned when it's closed." on={s.unassignWhenClosed} onChange={set("unassignWhenClosed")} />
      <SettingRow title="Mark Conversations as Unread When Assigned" description="This determines whether or not a conversation should be marked as unread when it's assigned to a team member." on={s.markUnreadWhenAssigned} onChange={set("markUnreadWhenAssigned")} />

      {/* Inbox Auto-Response */}
      <div className="tv-card p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold">Inbox Auto-Response</div>
            <p className="mt-1 text-[13px] tv-muted leading-relaxed">
              This setting allows you to send a standard automated response in conversations that are opened as a result of a new inbound message.
            </p>
          </div>
          <Toggle on={s.autoResponse} onChange={set("autoResponse")} />
        </div>
        {s.autoResponse && (
          <div className="mt-5 space-y-5">
            {s.officeHours ? (
              <>
                <MessageEditor
                  label="Auto-Response Message Inside of Office Hours"
                  value={s.autoResponseInside}
                  onChange={(v) => setS((p) => ({ ...p, autoResponseInside: v }))}
                />
                <MessageEditor
                  label="Auto-Response Message Outside of Office Hours"
                  value={s.autoResponseOutside}
                  onChange={(v) => setS((p) => ({ ...p, autoResponseOutside: v }))}
                />
              </>
            ) : (
              <MessageEditor
                label="Auto-Response Message"
                value={s.autoResponseInside}
                onChange={(v) => setS((p) => ({ ...p, autoResponseInside: v }))}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
