"use client";

import { useState } from "react";
import {
  ChevronLeft, ChevronDown, ChevronRight, Search, Heading1, Type, Image as ImageIcon,
  TextCursorInput, ListFilter, MousePointerClick, Link2, Star, ShieldCheck,
  Columns2, Columns3, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { contactLists, contactFieldOptions, fonts, builderDefaults } from "../mock-data";

const elementTiles = [
  { icon: Heading1, name: "Header" },
  { icon: Type, name: "Text" },
  { icon: ImageIcon, name: "Image" },
  { icon: TextCursorInput, name: "Field" },
  { icon: ListFilter, name: "Dropdown" },
  { icon: MousePointerClick, name: "Button" },
  { icon: Link2, name: "Link" },
  { icon: Star, name: "Icon" },
  { icon: ShieldCheck, name: "Compliance Statement" },
  { icon: Columns2, name: "Two Columns" },
  { icon: Columns3, name: "Three Columns" },
  { icon: AlertCircle, name: "Error Text" },
];

export function SetupPanel({
  formType, name, setName, desc, setDesc, pageTitle, setPageTitle, urlPath, setUrlPath,
}: any) {
  const isEmbed = formType === "embed";
  return (
    <div className="tv-card space-y-4 p-4">
      <div>
        <span className="tv-label">Form Type</span>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "landing", name: "Landing Page", desc: "Create a standalone web page for this form." },
            { key: "embed", name: "Website Embed", desc: "Embed this form directly into a page on your website." },
          ].map((t) => (
            <div
              key={t.key}
              className={`relative rounded-lg border p-3 ${formType === t.key ? "border-indigo-500 bg-indigo-50/50" : "border-gray-200 bg-white"}`}
            >
              {formType === t.key && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <CheckCircle2 size={12} />
                </span>
              )}
              <div className="text-[12px] font-bold text-gray-900">{t.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-gray-500">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <span className="tv-label">Name</span>
        <input className="tv-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <span className="tv-label">Description</span>
        <textarea className="tv-input min-h-[64px] resize-none" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      {!isEmbed && (
        <>
          <div>
            <span className="tv-label">Page Title</span>
            <input className="tv-input" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} placeholder="Sign Up | Brand Name" />
          </div>
          <div>
            <span className="tv-label">Custom URL Path</span>
            <input className="tv-input" value={urlPath} onChange={(e) => setUrlPath(e.target.value)} placeholder="brand-name/sign-up" />
          </div>
          <div>
            <span className="tv-label">Final Page URL</span>
            <div className="rounded-md bg-gray-50 px-3 py-2 text-[12px] text-gray-400 border border-gray-100">
              https://tvforms.co/{urlPath || "…"}
            </div>
          </div>
        </>
      )}
      {isEmbed && (
        <div>
          <span className="tv-label">Embed Code</span>
          <div className="rounded-md bg-gray-50 px-3 py-3 text-[12px] italic text-gray-400 border border-gray-100">
            Generated on Save
          </div>
        </div>
      )}
    </div>
  );
}

export function DesignPanel({ onSelectTemplate }: { onSelectTemplate: () => void }) {
  return (
    <div className="tv-card p-4">
      <div className="text-[12px] font-bold text-gray-900">Form Design</div>
      <p className="mt-1 text-[11px] leading-snug text-gray-500">
        Design your form using a pre-built template or create your own from scratch. Drag elements below onto the canvas and configure their styles to customize your design.
      </p>
      <button
        className="mt-3 flex w-full items-center justify-between rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 px-3 py-2.5 text-[12px] font-semibold text-indigo-600 hover:bg-indigo-50"
        onClick={onSelectTemplate}
      >
        Select a Template <ListFilter size={13} />
      </button>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {elementTiles.map((el) => (
          <div key={el.name} className="tv-el-tile">
            <el.icon size={16} />
            <span className="text-center leading-tight">{el.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BehaviorPanel({ selectedLists, setSelectedLists }: { selectedLists: string[]; setSelectedLists: (l: string[]) => void }) {
  const [q, setQ] = useState("");
  const toggle = (l: string) =>
    setSelectedLists(selectedLists.includes(l) ? selectedLists.filter((x) => x !== l) : [...selectedLists, l]);
  return (
    <div className="tv-card space-y-4 p-4">
      <div>
        <span className="tv-label">Contact Behavior</span>
        <p className="mb-1.5 text-[11px] text-gray-500">This setting determines whether your form will create new contacts or update existing ones.</p>
        <select className="tv-input">
          <option>Creates Contacts</option>
          <option>Updates Contacts</option>
        </select>
      </div>
      <div>
        <span className="tv-label">Contact Lists</span>
        <p className="mb-1.5 text-[11px] text-gray-500">When your form is submitted, you can optionally add contacts to one or more of your lists.</p>
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="tv-input !pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedLists.map((l) => (
            <span key={l} className="flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
              {l} <X size={11} className="cursor-pointer" onClick={() => toggle(l)} />
            </span>
          ))}
        </div>
        <div className="rounded-lg border border-gray-200">
          {contactLists.filter((l) => l.toLowerCase().includes(q.toLowerCase())).map((l) => (
            <label key={l} className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-2 text-[12px] text-gray-700 last:border-0 hover:bg-gray-50">
              <input type="checkbox" checked={selectedLists.includes(l)} onChange={() => toggle(l)} className="accent-indigo-600" />
              {l}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CustomCodePanel() {
  return (
    <div className="tv-card space-y-4 p-4">
      <div>
        <span className="tv-label">CSS</span>
        <p className="mb-1.5 text-[11px] text-gray-500">Insert CSS code into your form to further customize the design.</p>
        <textarea className="tv-input min-h-[90px] resize-none font-mono !text-[11px]" placeholder=".form-header { ... }" />
      </div>
      <div>
        <span className="tv-label">Javascript</span>
        <p className="mb-1.5 text-[11px] text-gray-500">Insert javascript code that will be executed on load. You can use this to add analytics and other tracking pixels to your form.</p>
        <textarea className="tv-input min-h-[90px] resize-none font-mono !text-[11px]" placeholder="window.addEventListener('load', ...)" />
      </div>
    </div>
  );
}

function MessageBox({ title, help, defaultValue }: { title: string; help: string; defaultValue: string }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div>
      <span className="tv-label">{title}</span>
      <p className="mb-1.5 text-[11px] text-gray-500">{help}</p>
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-3 pt-2 text-right text-[10px] text-gray-400">{val.length}/918</div>
        <textarea className="w-full resize-none px-3 pb-2 text-[12px] outline-none min-h-[72px]" value={val} onChange={(e) => setVal(e.target.value)} />
        <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-1.5 text-gray-400">
          <Type size={12} /><Star size={12} /><Link2 size={12} />
        </div>
      </div>
    </div>
  );
}

export function MessagingPanel() {
  return (
    <div className="tv-card space-y-4 p-4">
      <MessageBox
        title="Double Opt-In Message"
        help="After someone provides their mobile number, they'll receive this message asking them to confirm before being subscribed. They'll have to reply with the word YES in order to complete the subscription process."
        defaultValue={builderDefaults.doubleOptIn}
      />
      <MessageBox
        title="Opt-In Message"
        help="After someone replies with the word YES, they'll receive this message confirming that they've been successfully subscribed."
        defaultValue={builderDefaults.optIn}
      />
    </div>
  );
}

const settingsGroups: Record<string, string[]> = {
  header: ["Text", "Size & Spacing", "Border", "Background", "Shadow", "Opacity", "Visibility", "Custom CSS"],
  email: ["Field", "Text", "Size & Spacing", "Border", "Background", "Shadow", "Opacity", "Visibility", "Custom CSS"],
  button: ["Click Behavior", "Text", "Size & Spacing", "Border", "Background", "Shadow", "Opacity", "Visibility", "Custom CSS"],
  column: ["Size & Spacing", "Alignment", "Border", "Background", "Shadow", "Opacity", "Visibility", "Custom CSS"],
};

export function SettingsPanel({ element, onBack }: { element: string; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(element === "column" ? "Background" : "Text");
  const [font, setFont] = useState("Cormorant Garamond");
  const [fontSize, setFontSize] = useState(45);
  const [placeholder, setPlaceholder] = useState("Email (Optional)");
  const groups = settingsGroups[element] || settingsGroups.header;
  const title = element === "email" ? "Field Settings" : element === "button" ? "Button Settings" : element === "column" ? "Column Settings" : "Header Settings";

  return (
    <div>
      <button className="mb-3 flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-900" onClick={onBack}>
        <ChevronLeft size={14} /> Back
      </button>
      <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
      <p className="mt-0.5 mb-3 text-[11px] text-gray-500">
        Below are all of the settings for this element. Expand each settings category to reveal all of its available options.
      </p>
      <div className="space-y-1.5">
        {groups.map((g) => (
          <div key={g} className="tv-accordion">
            <div className="tv-accordion-head" onClick={() => setOpen(open === g ? null : g)}>
              {g}
              {open === g ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            {open === g && (
              <div className="border-t border-gray-100 p-3 space-y-3">
                {g === "Text" && (
                  <>
                    <textarea className="tv-input min-h-[56px] resize-none" defaultValue={element === "button" ? "Join Now" : "Want 20% Off?"} />
                    <div>
                      <span className="tv-label">Font</span>
                      <select className="tv-input" value={font} onChange={(e) => setFont(e.target.value)}>
                        {fonts.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="tv-label">Text Size — {fontSize}px</span>
                      <input type="range" min={10} max={90} value={fontSize} onChange={(e) => setFontSize(+e.target.value)} className="w-full accent-indigo-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="tv-label">Text Weight</span>
                        <select className="tv-input"><option>Bold</option><option>Regular</option><option>Light</option></select>
                      </div>
                      <div>
                        <span className="tv-label">Text Alignment</span>
                        <select className="tv-input"><option>Center</option><option>Left</option><option>Right</option></select>
                      </div>
                    </div>
                  </>
                )}
                {g === "Field" && (
                  <>
                    <div>
                      <span className="tv-label">Contact Field</span>
                      <select className="tv-input" defaultValue="Email">
                        {contactFieldOptions.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="tv-label">Placeholder Text</span>
                      <input className="tv-input" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
                    </div>
                    <div>
                      <span className="tv-label">Default Value</span>
                      <input className="tv-input" />
                    </div>
                    <div>
                      <span className="tv-label">Keyboard On Mobile</span>
                      <select className="tv-input"><option>Standard</option><option>Email</option><option>Numeric</option></select>
                    </div>
                    <label className="flex items-center justify-between text-[12px] font-semibold text-gray-700">
                      Required
                      <input type="checkbox" className="accent-indigo-600" />
                    </label>
                  </>
                )}
                {g === "Background" && (
                  <>
                    <div>
                      <span className="tv-label">Background Color</span>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded border border-gray-200" style={{ background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/12px 12px" }} />
                        <span className="text-[11px] text-gray-400">Transparent</span>
                      </div>
                    </div>
                    <div>
                      <span className="tv-label">Background Image</span>
                      <button className="tv-btn-ghost !py-1.5 flex items-center gap-1.5"><Search size={12} /> Search</button>
                    </div>
                    <div>
                      <span className="tv-label">Background Image Size</span>
                      <select className="tv-input"><option>Cover</option><option>Contain</option><option>Auto</option></select>
                    </div>
                    <div>
                      <span className="tv-label">Background Image Position - Vertical</span>
                      <input type="range" defaultValue={50} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <span className="tv-label">Background Image Position - Horizontal</span>
                      <input type="range" defaultValue={50} className="w-full accent-indigo-600" />
                    </div>
                  </>
                )}
                {g === "Click Behavior" && (
                  <div>
                    <span className="tv-label">On Click</span>
                    <select className="tv-input"><option>Submit Form</option><option>Open URL</option><option>Close Popup</option></select>
                  </div>
                )}
                {!["Text", "Field", "Background", "Click Behavior"].includes(g) && (
                  <p className="text-[11px] text-gray-400">Adjust {g.toLowerCase()} values for this element.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
