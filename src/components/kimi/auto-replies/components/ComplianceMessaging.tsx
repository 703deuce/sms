import { useState } from "react";
import { ChevronRight, ChevronDown, Lock, Info, ShieldCheck } from "lucide-react";
import { complianceMessages } from "../mock-data";
import MessageEditor from "./MessageEditor";
import Toast from "./Toast";
import Toggle from "./Toggle";

export default function ComplianceMessaging({
  onBack,
  initialOptInKeywords,
  initialOptOutKeywords,
  initialHelpKeywords,
  onSave,
}: {
  onBack: () => void;
  initialOptInKeywords?: string;
  initialOptOutKeywords?: string;
  initialHelpKeywords?: string;
  onSave?: (payload: {
    optInKeywords: string;
    optOutKeywords: string;
    helpKeywords: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>("optinComp");
  const [doubleOptin, setDoubleOptin] = useState(false);
  const [optOutIntel, setOptOutIntel] = useState(true);
  const [optInKeywords, setOptInKeywords] = useState(initialOptInKeywords ?? "START, YES, UNSTOP");
  const [optOutKeywords, setOptOutKeywords] = useState(initialOptOutKeywords ?? "STOP, UNSUBSCRIBE");
  const [helpKeywords, setHelpKeywords] = useState(initialHelpKeywords ?? "HELP, INFO");
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div>
      <Toast message={toast} />
      <p className="ar-breadcrumb">Auto-Replies / Compliance</p>
      <h1 className="ar-title">Compliance Messaging</h1>
      <p className="ar-subtitle max-w-3xl">
        Manage all things related to TCPA compliance. The TCPA and cellular carriers require all
        mobile messaging programs to provide specific verbiage —{" "}
        <span className="font-semibold text-foreground">
          Transovo includes this information for you in all the necessary places.
        </span>
      </p>

      <div className="mt-7 space-y-6 max-w-3xl">
        <div className="ar-toggle-row">
          <div>
            <h3 className="ar-setting-title">Force Double Opt-In</h3>
            <p className="ar-setting-desc">
              Some opt-in methods, such as web forms and website popups, require contacts to double
              opt-in before subscribing. This prevents bad actors from subscribing people without
              their consent.
            </p>
          </div>
          <Toggle on={doubleOptin} onChange={setDoubleOptin} />
        </div>
        <div className="ar-toggle-row">
          <div>
            <h3 className="ar-setting-title">Opt-Out Intelligence</h3>
            <p className="ar-setting-desc">
              Contacts are always opted out whenever they text stop, unsubscribe, remove, cancel,
              end, quit, or opt out to your number. Opt-out intelligence uses AI to evaluate
              informal opt-out language.
            </p>
          </div>
          <Toggle on={optOutIntel} onChange={setOptOutIntel} />
        </div>
      </div>

      <div className="mt-6 space-y-3 max-w-3xl">
        <label className="block text-sm font-medium">Opt-in keywords</label>
        <input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={optInKeywords} onChange={(e) => setOptInKeywords(e.target.value)} />
        <label className="block text-sm font-medium">Opt-out keywords</label>
        <input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={optOutKeywords} onChange={(e) => setOptOutKeywords(e.target.value)} />
        <label className="block text-sm font-medium">Help keywords</label>
        <input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={helpKeywords} onChange={(e) => setHelpKeywords(e.target.value)} />
      </div>

      <div className="space-y-3 mt-8 max-w-3xl">
        {complianceMessages.map((m) => {
          const isOpen = open === m.id;
          return (
            <div key={m.id} className={`accordion-item ${isOpen ? "open" : ""}`}>
              <button
                className="w-full flex items-center justify-between px-5 py-4"
                onClick={() => setOpen(isOpen ? null : m.id)}
              >
                <span className="flex items-center gap-3 text-[14.5px] font-medium text-foreground">
                  <Lock size={16} className="text-indigo-500" />
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
                  <MessageEditor label={m.title} value={m.body} editable={false} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="info-note mt-8 max-w-3xl" style={{ marginBottom: 0 }}>
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>
          Compliance verbiage is not editable. This content is simply here for your reference and is
          included automatically in the required places.
        </span>
      </div>

      <div className="ar-save-row">
        <button
          onClick={() => {
            const finish = () => {
              setToast("Settings saved.");
              setTimeout(() => setToast(null), 2500);
            };
            if (onSave) {
              void onSave({ optInKeywords, optOutKeywords, helpKeywords })
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
