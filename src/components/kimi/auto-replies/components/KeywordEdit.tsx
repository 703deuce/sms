import { useState } from "react";
import { ChevronDown, ChevronRight, Settings2, UserCheck } from "lucide-react";
import { Keyword } from "../mock-data";
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

  return (
    <div>
      <Toast message={toast} />
      <p className="ar-breadcrumb">Auto-Replies / Keywords / {kw || "New Keyword"}</p>
      <h1 className="ar-title">{keyword.id === "new" ? "Create Keyword" : "Edit Keyword"}</h1>
      <p className="ar-subtitle">Edit your keyword and associated settings.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 mt-7 items-start">
        <div className="space-y-4 max-w-2xl">
          {/* Setup accordion */}
          <div className={`accordion-item ${setupOpen ? "open" : ""}`}>
            <button
              className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setSetupOpen(!setupOpen)}
            >
              <span className="flex items-center gap-3 text-[14.5px] font-semibold text-foreground">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[12px] flex items-center justify-center font-bold">
                  1
                </span>
                <Settings2 size={16} className="text-indigo-500" />
                Setup
              </span>
              {setupOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            {setupOpen && (
              <div className="px-5 pb-6 space-y-4">
                <div>
                  <label className="text-[13px] font-medium text-foreground block mb-1.5">
                    Keyword
                  </label>
                  <input
                    className="field-input"
                    value={kw}
                    onChange={(e) => setKw(e.target.value)}
                    placeholder="e.g. BlackFriday"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-foreground block mb-1.5">
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
                  This overrides the default Opt-in Message for contacts who join via this keyword.
                </p>
              </div>
            )}
          </div>

          {/* Contact Behavior accordion */}
          <div className={`accordion-item ${behaviorOpen ? "open" : ""}`}>
            <button
              className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setBehaviorOpen(!behaviorOpen)}
            >
              <span className="flex items-center gap-3 text-[14.5px] font-semibold text-foreground">
                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[12px] flex items-center justify-center font-bold">
                  2
                </span>
                <UserCheck size={16} className="text-indigo-500" />
                Contact Behavior
              </span>
              {behaviorOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            {behaviorOpen && (
              <div className="px-5 pb-6 space-y-4">
                <label className="flex items-center gap-3 text-[14px] text-foreground">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-600" />
                  Create a contact when this keyword is texted
                </label>
                <label className="flex items-center gap-3 text-[14px] text-foreground">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-600" />
                  Subscribe the contact to messaging
                </label>
                <div>
                  <label className="text-[13px] font-medium text-foreground block mb-1.5">
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

          <div className="ar-save-row" style={{ marginTop: 8 }}>
            <button onClick={save} className="ar-btn-primary">
              Save
            </button>
            <button onClick={onBack} className="ar-btn-secondary">
              Cancel
            </button>
          </div>
        </div>

        <div className="hidden lg:block">
          <PhonePreview keyword={kw || "KEYWORD"} message={auto} />
        </div>
      </div>
    </div>
  );
}
