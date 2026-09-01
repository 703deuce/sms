import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { inboxDefaults } from "../mock-data";
import { AutoReplySubScreen, AutoReplyToggleRow } from "./AutoReplySubScreen";
import MessageEditor from "./MessageEditor";
import Toggle from "./Toggle";
import Toast from "./Toast";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const baseToggles = [
  {
    id: "inboxOn",
    title: "Inbox On",
    desc: "Engage in real-time, one-on-one messaging using your text number. Manage conversations and collaborate with team members.",
  },
  {
    id: "start",
    title: "Allow Starting Conversations",
    desc: "Whether team members can start conversations or reply to closed ones. Does not apply to inbox managers and account owners.",
  },
  {
    id: "assign",
    title: "Allow Conversation Assignment",
    desc: "Whether team members can assign conversations to other teammates. Does not apply to inbox managers and account owners.",
  },
  {
    id: "tag",
    title: "Allow Conversation Tagging",
    desc: "Whether team members can tag conversations. Does not apply to inbox managers and account owners.",
  },
  {
    id: "unassign",
    title: "Unassign Conversations When Closed",
    desc: "Automatically unassign a conversation when it's closed.",
  },
  {
    id: "unread",
    title: "Mark Conversations as Unread When Assigned",
    desc: "Mark a conversation as unread when it's assigned to a team member.",
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
  initialInboxToggles,
  onSave,
}: {
  onBack: () => void;
  initialAwayMessage?: string;
  initialAwayInsideMessage?: string;
  initialAwayEnabled?: boolean;
  initialOfficeHoursEnabled?: boolean;
  initialActiveDays?: string[];
  initialTimezone?: string;
  initialInboxToggles?: Record<string, boolean>;
  onSave?: (payload: {
    awayMessage: string;
    awayInsideMessage?: string;
    awayEnabled: boolean;
    officeHoursEnabled?: boolean;
    activeDays?: string[];
    timezone?: string;
    inboxToggles?: Record<string, boolean>;
  }) => Promise<void>;
}) {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    initialInboxToggles ?? {
      inboxOn: true,
      start: true,
      assign: true,
      tag: true,
      unassign: true,
      unread: true,
    },
  );
  const [autoOn, setAutoOn] = useState(initialAwayEnabled ?? true);
  const [single, setSingle] = useState(initialAwayMessage ?? inboxDefaults.autoResponseMessage);
  const [officeOn, setOfficeOn] = useState(initialOfficeHoursEnabled ?? true);
  const [activeDays, setActiveDays] = useState<string[]>(
    initialActiveDays ?? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  );
  const [inside, setInside] = useState(initialAwayInsideMessage ?? inboxDefaults.insideMessage);
  const [outside, setOutside] = useState(initialAwayMessage ?? inboxDefaults.outsideMessage);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: string) =>
    setActiveDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  useEffect(() => {
    if (initialInboxToggles) setToggles(initialInboxToggles);
  }, [initialInboxToggles]);

  const save = () => {
    const finish = () => {
      setToast("Inbox settings saved.");
      setTimeout(() => setToast(null), 2500);
    };
    if (onSave) {
      const awayMessage = autoOn ? (officeOn ? outside : single) : "";
      const awayInsideMessage = autoOn && officeOn ? inside : "";
      setSaving(true);
      void onSave({
        awayMessage,
        awayInsideMessage,
        awayEnabled: autoOn,
        officeHoursEnabled: officeOn,
        activeDays,
        timezone: initialTimezone,
        inboxToggles: toggles,
      })
        .then(finish)
        .catch(() => {
          setToast("Save failed.");
          setTimeout(() => setToast(null), 2500);
        })
        .finally(() => setSaving(false));
      return;
    }
    finish();
  };

  return (
    <AutoReplySubScreen
      emoji="💬"
      title="General Inbox Settings"
      description="Manage general inbox rules, office hours, and auto-responses for new inbound conversations."
      breadcrumb={[{ label: "Inbox" }]}
      onBack={onBack}
      onSave={save}
      saving={saving}
    >
      <Toast message={toast} />

      <div className="mt-2 max-w-3xl space-y-4">
        {baseToggles.map((t) => (
          <AutoReplyToggleRow
            key={t.id}
            title={t.title}
            description={t.desc}
            control={
              <Toggle
                on={toggles[t.id]}
                onChange={(v) => setToggles({ ...toggles, [t.id]: v })}
              />
            }
          />
        ))}

        <AutoReplyToggleRow
          title="Office Hours"
          description="Set days and times teammates are available. Send different auto-responses inside and outside office hours."
          control={<Toggle on={officeOn} onChange={setOfficeOn} />}
        />

        {officeOn && (
          <div className="ar-panel space-y-2 rounded-[12px]">
            {days.map((d) => {
              const active = activeDays.includes(d);
              return (
                <div key={d} className="flex items-center gap-3">
                  <button
                    type="button"
                    className={`day-pill w-32 text-center ${active ? "active" : ""}`}
                    onClick={() => toggleDay(d)}
                  >
                    {d}
                  </button>
                  <div
                    className={`flex items-center gap-2 ${
                      active ? "" : "pointer-events-none opacity-40"
                    }`}
                  >
                    <button type="button" className="time-select">
                      9:00 am <ChevronDown size={13} />
                    </button>
                    <span className="text-[13px] text-muted-foreground">To</span>
                    <button type="button" className="time-select">
                      5:00 pm <ChevronDown size={13} />
                    </button>
                    <span className="text-[12.5px] font-medium text-muted-foreground">
                      {initialTimezone || "CDT"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AutoReplyToggleRow
          title="Inbox Auto-Response"
          description="Send a standard automated response when a new inbound message opens a conversation."
          control={<Toggle on={autoOn} onChange={setAutoOn} />}
        />

        {autoOn && !officeOn && (
          <div className="ar-panel rounded-[12px]">
            <MessageEditor
              label="Auto-Response Message"
              value={single}
              onChange={setSingle}
              withAttachment
            />
          </div>
        )}

        {autoOn && officeOn && (
          <div className="ar-panel space-y-5 rounded-[12px]">
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
    </AutoReplySubScreen>
  );
}
