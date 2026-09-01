import { useState } from "react";
import { ChevronDown, ChevronRight, Settings2, UserCheck } from "lucide-react";
import { Keyword } from "../mock-data";
import { AutoReplySubScreen } from "./AutoReplySubScreen";
import MessageEditor from "./MessageEditor";
import PhonePreview from "./PhonePreview";
import Toast from "./Toast";

export default function KeywordEdit({
  keyword,
  onBack,
  onSaved,
}: {
  keyword: Keyword;
  onBack: () => void;
  onSaved: (k: Keyword) => void;
}) {
  const [kw, setKw] = useState(keyword.keyword);
  const [desc, setDesc] = useState(keyword.description);
  const [auto, setAuto] = useState(keyword.autoResponse);
  const [setupOpen, setSetupOpen] = useState(true);
  const [behaviorOpen, setBehaviorOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    onSaved({ ...keyword, keyword: kw, description: desc, autoResponse: auto });
    setToast("Keyword saved.");
    setTimeout(() => {
      setToast(null);
      onBack();
    }, 900);
  };

  const title = keyword.id === "new" ? "Create Keyword" : "Edit Keyword";

  return (
    <AutoReplySubScreen
      emoji="🏷️"
      title={title}
      description="Edit your keyword and associated contact behavior."
      breadcrumb={[
        { label: "Keywords", onClick: onBack },
        { label: kw || "New Keyword" },
      ]}
      onBack={onBack}
      onSave={save}
      saveLabel="Save Keyword"
    >
      <Toast message={toast} />

      <div className="mt-2 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_340px]">
        <div className="max-w-2xl space-y-4">
          <div className={`accordion-item ${setupOpen ? "open" : ""}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4"
              onClick={() => setSetupOpen(!setupOpen)}
            >
              <span className="flex items-center gap-3 text-[14.5px] font-semibold text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[12px] font-bold text-white">
                  1
                </span>
                <Settings2 size={16} className="text-indigo-500" />
                Setup
              </span>
              {setupOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            {setupOpen && (
              <div className="space-y-4 border-t border-border px-5 pb-6 pt-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-foreground">Keyword</label>
                  <input
                    className="field-input"
                    value={kw}
                    onChange={(e) => setKw(e.target.value)}
                    placeholder="e.g. BlackFriday"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                    Description
                  </label>
                  <input
                    className="field-input"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Internal note about this keyword"
                  />
                </div>
                <MessageEditor label="Auto Response" value={auto} onChange={setAuto} />
                <p className="text-[12px] text-muted-foreground">
                  Overrides the default opt-in message for contacts who join via this keyword.
                </p>
              </div>
            )}
          </div>

          <div className={`accordion-item ${behaviorOpen ? "open" : ""}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4"
              onClick={() => setBehaviorOpen(!behaviorOpen)}
            >
              <span className="flex items-center gap-3 text-[14.5px] font-semibold text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[12px] font-bold text-slate-600">
                  2
                </span>
                <UserCheck size={16} className="text-indigo-500" />
                Contact Behavior
              </span>
              {behaviorOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            {behaviorOpen && (
              <div className="space-y-4 border-t border-border px-5 pb-6 pt-4">
                <label className="flex items-center gap-3 text-[14px] text-foreground">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-600" />
                  Create a contact when this keyword is texted
                </label>
                <label className="flex items-center gap-3 text-[14px] text-foreground">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-600" />
                  Subscribe the contact to messaging
                </label>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                    Add to List (optional)
                  </label>
                  <select className="field-input">
                    <option>No list</option>
                    <option>VIP Subscribers</option>
                    <option>Retail Locations</option>
                    <option>Black Friday 2024</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <PhonePreview keyword={kw || "KEYWORD"} message={auto} />
        </div>
      </div>
    </AutoReplySubScreen>
  );
}
