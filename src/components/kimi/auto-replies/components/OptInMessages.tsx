import { useState } from "react";
import { Info, MessageSquareText } from "lucide-react";
import { optInMessages } from "../mock-data";
import {
  AutoReplyAccordion,
  AutoReplySubScreen,
  AutoReplyToggleRow,
} from "./AutoReplySubScreen";
import MessageEditor from "./MessageEditor";
import Toggle from "./Toggle";
import Toast from "./Toast";

export default function OptInMessages({
  onBack,
  initialBodies,
  onSave,
  saveSuccessMessage = "Settings saved.",
}: {
  onBack: () => void;
  initialBodies?: Record<string, string>;
  onSave?: (payload: { bodies: Record<string, string> }) => Promise<void>;
  saveSuccessMessage?: string;
}) {
  const [open, setOpen] = useState<string | null>("optin");
  const [bodies, setBodies] = useState<Record<string, string>>(
    initialBodies ?? Object.fromEntries(optInMessages.map((m) => [m.id, m.body])),
  );
  const [prefix, setPrefix] = useState(false);
  const [badNumber, setBadNumber] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = () => {
    const finish = () => {
      setToast(saveSuccessMessage);
      setTimeout(() => setToast(null), 2500);
    };
    if (onSave) {
      setSaving(true);
      void onSave({ bodies })
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
      emoji="✅"
      title="Opt-In Auto-Responses"
      description="Manage basic settings and default messaging for when contacts subscribe."
      breadcrumb={[{ label: "Opt-In Messages" }]}
      onBack={onBack}
      onSave={save}
      saving={saving}
    >
      <Toast message={toast} />

      <div className="mt-2 space-y-4 max-w-3xl">
        <AutoReplyToggleRow
          title="Message Prefix"
          description='A word or phrase added to the beginning of all outgoing texts so contacts know who the message is from. Messages read prefix: your message here.'
          control={<Toggle on={prefix} onChange={setPrefix} />}
        />
        <AutoReplyToggleRow
          title="Bad Number Deletion"
          description="If consecutive delivery failures are detected for a contact, they can be deleted automatically to protect your sender reputation."
          control={<Toggle on={badNumber} onChange={setBadNumber} />}
        />
      </div>

      <div className="mt-10 max-w-3xl">
        <h2 className="text-[17px] font-semibold text-foreground">Messaging</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Default messages used across the platform and in contact messaging experiences.
        </p>

        <div className="mt-4 space-y-3">
          {optInMessages.map((m) => {
            const isOpen = open === m.id;
            return (
              <AutoReplyAccordion
                key={m.id}
                open={isOpen}
                onToggle={() => setOpen(isOpen ? null : m.id)}
                icon={<MessageSquareText size={17} className="text-indigo-500" />}
                title={m.title}
              >
                <div className="info-note">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  <span>{m.description}</span>
                </div>
                <MessageEditor
                  label={m.title}
                  value={bodies[m.id]}
                  onChange={(v) => setBodies({ ...bodies, [m.id]: v })}
                />
              </AutoReplyAccordion>
            );
          })}
        </div>
      </div>
    </AutoReplySubScreen>
  );
}
