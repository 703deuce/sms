import { useState } from "react";
import { ChevronRight, ChevronDown, Lock, Info, ShieldCheck } from "lucide-react";
import { complianceMessages } from "../mock-data";
import MessageEditor from "./MessageEditor";
import Toast from "./Toast";
import Toggle from "./Toggle";

export default function ComplianceMessaging({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<string | null>("optinComp");
  const [doubleOptin, setDoubleOptin] = useState(false);
  const [optOutIntel, setOptOutIntel] = useState(true);
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
            setToast("Settings saved.");
            setTimeout(() => setToast(null), 2500);
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
