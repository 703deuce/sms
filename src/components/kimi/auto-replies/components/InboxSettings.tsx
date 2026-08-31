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

export default function InboxSettings({ onBack }: { onBack: () => void }) {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    inboxOn: true,
    start: true,
    assign: true,
    tag: true,
    unassign: true,
    unread: true,
  });
  const [autoOn, setAutoOn] = useState(true);
  const [single, setSingle] = useState(inboxDefaults.autoResponseMessage);
  const [officeOn, setOfficeOn] = useState(true);
  const [activeDays, setActiveDays] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  const [inside, setInside] = useState(inboxDefaults.insideMessage);
  const [outside, setOutside] = useState(inboxDefaults.outsideMessage);
  const [toast, setToast] = useState<string | null>(null);

  const toggleDay = (d: string) =>
    setActiveDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div>
      <Toast message={toast} />
      <p className="text-[12.5px] text-muted-foreground mb-1">Auto-Replies / Inbox / General</p>
      <div className="flex items-center gap-2.5">
        <Inbox size={22} className="text-teal-600" />
        <h1 className="text-[24px] font-bold text-foreground tracking-tight">
          General Inbox Settings
        </h1>
      </div>
      <p className="text-[14px] text-muted-foreground mt-1">
        Manage general inbox rules and behaviors.
      </p>

      <div className="mt-7 space-y-6 max-w-3xl">
        {baseToggles.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-8">
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">{t.title}</h3>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{t.desc}</p>
            </div>
            <Toggle
              on={toggles[t.id]}
              onChange={(v) => setToggles({ ...toggles, [t.id]: v })}
            />
          </div>
        ))}

        {/* Office hours */}
        <div className="flex items-start justify-between gap-8">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Office Hours</h3>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Specify the days and times that teammates are generally online and available. Setting
              office hours lets you send different auto-responses inside and outside those times.
            </p>
          </div>
          <Toggle on={officeOn} onChange={setOfficeOn} />
        </div>

        {officeOn && (
          <div className="bg-muted/40 border border-border rounded-2xl p-5 space-y-2.5">
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
                    <button className="field-input !w-28 flex items-center justify-between text-[13px]">
                      9:00 am <ChevronDown size={14} />
                    </button>
                    <span className="text-[13px] text-muted-foreground">To</span>
                    <button className="field-input !w-28 flex items-center justify-between text-[13px]">
                      5:00 pm <ChevronDown size={14} />
                    </button>
                    <span className="text-[13px] text-muted-foreground font-medium">CDT</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Inbox auto-response */}
        <div className="flex items-start justify-between gap-8">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Inbox Auto-Response</h3>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Send a standard automated response in conversations that are opened as a result of a
              new inbound message.
            </p>
          </div>
          <Toggle on={autoOn} onChange={setAutoOn} />
        </div>

        {autoOn && !officeOn && (
          <div className="bg-muted/40 border border-border rounded-2xl p-5">
            <MessageEditor
              label="Auto-Response Message"
              value={single}
              onChange={setSingle}
              withAttachment
            />
          </div>
        )}

        {autoOn && officeOn && (
          <div className="bg-muted/40 border border-border rounded-2xl p-5 space-y-5">
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

      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={() => {
            setToast("Inbox settings saved.");
            setTimeout(() => setToast(null), 2500);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[14px] font-semibold px-7 py-2.5 rounded-lg transition-colors"
        >
          Save
        </button>
        <button
          onClick={onBack}
          className="border border-border bg-card text-[14px] font-medium px-7 py-2.5 rounded-lg hover:bg-muted transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
