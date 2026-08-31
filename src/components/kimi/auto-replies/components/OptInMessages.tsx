import { useState } from "react";
import { ChevronRight, ChevronDown, MessageSquareText, Info } from "lucide-react";
import { optInMessages } from "../mock-data";
import MessageEditor from "./MessageEditor";
import Toggle from "./Toggle";
import Toast from "./Toast";

export default function OptInMessages({
  onBack,
  initialBodies,
  onSave,
}: {
  onBack: () => void;
  initialBodies?: Record<string, string>;
  onSave?: (payload: { bodies: Record<string, string> }) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>("optin");
  const [bodies, setBodies] = useState<Record<string, string>>(
    initialBodies ?? Object.fromEntries(optInMessages.map((m) => [m.id, m.body])),
  );
  const [prefix, setPrefix] = useState(false);
  const [badNumber, setBadNumber] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    if (onSave) {
      void onSave({ bodies })
        .then(() => {
          setToast("Settings saved.");
          setTimeout(() => setToast(null), 2500);
        })
        .catch(() => {
          setToast("Save failed.");
          setTimeout(() => setToast(null), 2500);
        });
      return;
    }
    setToast("Settings saved.");
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div>
      <Toast message={toast} />
      <p className="ar-breadcrumb">Auto-Replies / Opt-In Messages</p>
      <h1 className="ar-title">Opt-In Auto-Responses</h1>
      <p className="ar-subtitle">Manage basic settings and default messaging.</p>

      {/* Toggles */}
      <div className="mt-7 space-y-6 max-w-3xl">
        <div className="ar-toggle-row">
          <div>
            <h3 className="ar-setting-title">Message Prefix</h3>
            <p className="ar-setting-desc">
              This is a word or phrase added to the beginning of all outgoing text messages to help
              contacts easily identify who the message is from. Your messages would read{" "}
              <span className="font-semibold text-foreground">prefix: your message here</span>.
            </p>
          </div>
          <Toggle on={prefix} onChange={setPrefix} />
        </div>
        <div className="ar-toggle-row">
          <div>
            <h3 className="ar-setting-title">Bad Number Deletion</h3>
            <p className="ar-setting-desc">
              Our system is constantly monitoring message delivery. If patterns of consecutive
              message failures to individual contacts are recognized, they can be deleted
              automatically.
            </p>
          </div>
          <Toggle on={badNumber} onChange={setBadNumber} />
        </div>
      </div>

      {/* Messaging accordions */}
      <h2 className="text-[17px] font-semibold text-foreground mt-10">Messaging</h2>
      <p className="text-[13px] text-muted-foreground mt-1 max-w-3xl">
        Here is where you can set default messaging that will be used in various places throughout
        the platform and in contact messaging experiences.
      </p>

      <div className="space-y-3 mt-4 max-w-3xl">
        {optInMessages.map((m) => {
          const isOpen = open === m.id;
          return (
            <div key={m.id} className={`accordion-item ${isOpen ? "open" : ""}`}>
              <button
                className="w-full flex items-center justify-between px-5 py-4"
                onClick={() => setOpen(isOpen ? null : m.id)}
              >
                <span className="flex items-center gap-3 text-[14.5px] font-medium text-foreground">
                  <MessageSquareText size={17} className="text-indigo-500" />
                  {m.title}
                </span>
                {isOpen ? (
                  <ChevronDown size={17} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={17} className="text-muted-foreground" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5">
                  <div className="info-note">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    <span>{m.description}</span>
                  </div>
                  <MessageEditor
                    label={m.title}
                    value={bodies[m.id]}
                    onChange={(v) => setBodies({ ...bodies, [m.id]: v })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="ar-save-row">
        <button onClick={save} className="ar-btn-primary">
          Save
        </button>
        <button onClick={onBack} className="ar-btn-secondary">
          Back
        </button>
      </div>
    </div>
  );
}
