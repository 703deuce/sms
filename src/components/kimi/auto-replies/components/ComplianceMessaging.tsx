import { useState } from "react";
import { Info, Lock, ShieldCheck } from "lucide-react";
import { complianceMessages } from "../mock-data";
import {
  AutoReplyAccordion,
  AutoReplySubScreen,
  AutoReplyToggleRow,
} from "./AutoReplySubScreen";
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
  const [saving, setSaving] = useState(false);

  const save = () => {
    const finish = () => {
      setToast("Settings saved.");
      setTimeout(() => setToast(null), 2500);
    };
    if (onSave) {
      setSaving(true);
      void onSave({ optInKeywords, optOutKeywords, helpKeywords })
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
      emoji="🛡️"
      title="Compliance Messaging"
      description="TCPA-required verbiage and keyword settings. Transovo includes compliance copy in all the necessary places."
      breadcrumb={[{ label: "Compliance" }]}
      onBack={onBack}
      onSave={save}
      saving={saving}
    >
      <Toast message={toast} />

      <div className="mt-2 space-y-4 max-w-3xl">
        <AutoReplyToggleRow
          title="Force Double Opt-In"
          description="Require double opt-in for web forms and popups so bad actors can't subscribe people without consent."
          control={<Toggle on={doubleOptin} onChange={setDoubleOptin} />}
        />
        <AutoReplyToggleRow
          title="Opt-Out Intelligence"
          description="Contacts are opted out on STOP, UNSUBSCRIBE, and similar keywords. AI also catches informal opt-out language."
          control={<Toggle on={optOutIntel} onChange={setOptOutIntel} />}
        />
      </div>

      <div className="mt-8 max-w-3xl rounded-[12px] border border-border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-[14px] font-semibold text-foreground">Keyword triggers</h3>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Opt-in keywords</label>
          <input
            className="field-input"
            value={optInKeywords}
            onChange={(e) => setOptInKeywords(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Opt-out keywords</label>
          <input
            className="field-input"
            value={optOutKeywords}
            onChange={(e) => setOptOutKeywords(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Help keywords</label>
          <input
            className="field-input"
            value={helpKeywords}
            onChange={(e) => setHelpKeywords(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-8 space-y-3 max-w-3xl">
        {complianceMessages.map((m) => {
          const isOpen = open === m.id;
          return (
            <AutoReplyAccordion
              key={m.id}
              open={isOpen}
              onToggle={() => setOpen(isOpen ? null : m.id)}
              icon={<Lock size={16} className="text-indigo-500" />}
              title={m.title}
            >
              <div className="info-note">
                <Info size={15} className="mt-0.5 shrink-0" />
                <span>{m.description}</span>
              </div>
              <MessageEditor label={m.title} value={m.body} editable={false} />
            </AutoReplyAccordion>
          );
        })}
      </div>

      <div className="info-note mt-8 max-w-3xl" style={{ marginBottom: 0 }}>
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>
          Compliance verbiage is not editable. This content is included automatically in the
          required places.
        </span>
      </div>
    </AutoReplySubScreen>
  );
}
