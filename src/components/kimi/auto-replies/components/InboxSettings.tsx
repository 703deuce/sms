import { useState } from "react";
import { Inbox, ChevronDown } from "lucide-react";
import { inboxDefaults } from "../mock-data";
import MessageEditor from "./MessageEditor";
import Toggle from "./Toggle";
import Toast from "./Toast";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const baseToggles = [
  {
    id: "inboxOn",
    title: "Inbox On",
    desc: "Engage in real-time, one-on-one messaging using your text number. Manage conversations, collaborate with team members and connect with contacts using this powerful two-way messaging tool.",
  },
  {
    id: "start",
    title: "Allow Starting Conversations",
    desc: "This determines whether or not team members have the ability to start conversations or reply to existing ones that are closed. This does not apply to inbox managers and account owners.",
  },
  {
    id: "assign",
    title: "Allow Conversation Assignment",
    desc: "This determines whether or not team members have the ability to assign conversations to other teammates. This does not apply to inbox managers and account owners.",
  },
  {
    id: "tag",
    title: "Allow Conversation Tagging",
    desc: "This determines whether or not team members have the ability to tag conversations. This does not apply to inbox managers and account owners.",
  },
  {
    id: "unassign",
    title: "Unassign Conversations When Closed",
    desc: "This determines whether or not a conversation should be automatically unassigned when it's closed.",
  },
  {
    id: "unread",
    title: "Mark Conversations as Unread When Assigned",
    desc: "This determines whether or not a conversation should be marked as unread when it's assigned to a team member.",
  },
];

export default function InboxSettings({
  onBack,
  initialAwayMessage,
  initialAwayInsideMessage,
  initialAwayEnabled,
  initialOfficeHoursEnabled,
  initialActiveDays,
  initialTimezone,
  onSave,
}: {
  onBack: () => void;
  initialAwayMessage?: string;
  initialAwayInsideMessage?: string;
  initialAwayEnabled?: boolean;
  initialOfficeHoursEnabled?: boolean;
  initialActiveDays?: string[];
  initialTimezone?: string;
  onSave?: (payload: {
    awayMessage: string;
    awayInsideMessage?: string;
    awayEnabled: boolean;
    officeHoursEnabled?: boolean;
    activeDays?: string[];
    timezone?: string;
  }) => Promise<void>;
}) {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    inboxOn: true,
    start: true,
    assign: true,
    tag: true,
    unassign: true,
    unread: true,
  });
  const [autoOn, setAutoOn] = useState(initialAwayEnabled ?? true);
  const [single, setSingle] = useState(initialAwayMessage ?? inboxDefaults.autoResponseMessage);
  const [officeOn, setOfficeOn] = useState(initialOfficeHoursEnabled ?? true);
  const [activeDays, setActiveDays] = useState<string[]>(
    initialActiveDays ?? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  );
  const [inside, setInside] = useState(initialAwayInsideMessage ?? inboxDefaults.insideMessage);
  const [outside, setOutside] = useState(initialAwayMessage ?? inboxDefaults.outsideMessage);
  const [toast, setToast] = useState<string | null>(null);

  const toggleDay = (d: string) =>
    setActiveDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div>
      <Toast message={toast} />
      <p className="ar-breadcrumb">Auto-Replies / Inbox / General</p>
      <div className="flex items-center gap-2.5">
        <span className="ar-title-icon bg-teal-50 text-teal-600">
          <Inbox size={17} />
        </span>
        <h1 className="ar-title">General Inbox Settings</h1>
      </div>
      <p className="ar-subtitle">Manage general inbox rules and behaviors.</p>

      <div className="mt-7 space-y-6 max-w-3xl">
        {baseToggles.map((t) => (
          <div key={t.id} className="ar-toggle-row">
            <div>
              <h3 className="ar-setting-title">{t.title}</h3>
              <p className="ar-setting-desc">{t.desc}</p>
            </div>
            <Toggle
              on={toggles[t.id]}
              onChange={(v) => setToggles({ ...toggles, [t.id]: v })}
            />
          </div>
        ))}

        {/* Office hours */}
        <div className="ar-toggle-row">
          <div>
            <h3 className="ar-setting-title">Office Hours</h3>
            <p className="ar-setting-desc">
              Specify the days and times that teammates are generally online and available. Setting
              office hours lets you send different auto-responses inside and outside those times.
            </p>
          </div>
          <Toggle on={officeOn} onChange={setOfficeOn} />
        </div>

        {officeOn && (
          <div className="ar-panel space-y-2">
            {days.map((d) => {
              const active = activeDays.includes(d);
              return (
                <div key={d} className="flex items-center gap-3">
                  <button
                    className={`day-pill w-32 text-center ${active ? "active" : ""}`}
                    onClick={() => toggleDay(d)}
                  >
                    {d}
                  </button>
                  <div
                    className={`flex items-center gap-2 ${
                      active ? "" : "opacity-40 pointer-events-none"
                    }`}
                  >
                    <button className="time-select">
                      9:00 am <ChevronDown size={13} />
                    </button>
                    <span className="text-[13px] text-muted-foreground">To</span>
                    <button className="time-select">
                      5:00 pm <ChevronDown size={13} />
                    </button>
                    <span className="text-[12.5px] text-muted-foreground font-medium">
                      {initialTimezone || "CDT"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Inbox auto-response */}
        <div className="ar-toggle-row">
          <div>
            <h3 className="ar-setting-title">Inbox Auto-Response</h3>
            <p className="ar-setting-desc">
              Send a standard automated response in conversations that are opened as a result of a
              new inbound message.
            </p>
          </div>
          <Toggle on={autoOn} onChange={setAutoOn} />
        </div>

        {autoOn && !officeOn && (
          <div className="ar-panel">
            <MessageEditor
              label="Auto-Response Message"
              value={single}
              onChange={setSingle}
              withAttachment
            />
          </div>
        )}

        {autoOn && officeOn && (
          <div className="ar-panel space-y-5">
            <MessageEditor
              label="Auto-Response Message Inside of Office Hours"
              value={inside}
              onChange={setInside}
              withAttachment
            />
            <MessageEditor
              label="Auto-Response Message Outside of Office Hours"
              value={outside}
              onChange={setOutside}
              withAttachment
            />
          </div>
        )}
      </div>

      <div className="ar-save-row">
        <button
          onClick={() => {
            const finish = () => {
              setToast("Inbox settings saved.");
              setTimeout(() => setToast(null), 2500);
            };
            if (onSave) {
              const awayMessage = autoOn ? (officeOn ? outside : single) : "";
              const awayInsideMessage = autoOn && officeOn ? inside : "";
              void onSave({
                awayMessage,
                awayInsideMessage,
                awayEnabled: autoOn,
                officeHoursEnabled: officeOn,
                activeDays,
                timezone: initialTimezone,
              })
                .then(finish)
                .catch(() => {
                  setToast("Save failed.");
                  setTimeout(() => setToast(null), 2500);
                });
              return;
            }
            finish();
          }}
          className="ar-btn-primary"
        >
          Save
        </button>
        <button onClick={onBack} className="ar-btn-secondary">
          Back
        </button>
      </div>
    </div>
  );
}
