"use client";
import React, { useState } from "react";
import {
  ArrowLeft, Heading1, Type, Image as ImageIcon, TextCursorInput, ChevronsUpDown, MousePointerClick,
  Link2, Star, ScrollText, Square, Columns2, Columns3, AlertCircle, Undo2, Redo2, Eye, EyeOff,
  Monitor, Tablet, Smartphone, FlaskConical, Layout, Code2, Settings2, MessageSquare, ChevronRight,
} from "lucide-react";
import { SectionRow, Field, inputCls, Toggle } from "./ui";
import { contactLists, designElements, formDefaults } from "../mock-data";
import BuilderCanvas from "./BuilderCanvas";
import TemplatesModal from "./TemplatesModal";
import ImageSearchModal from "./ImageSearchModal";
import { FieldSettingsPanel } from "./FieldSettingsPanel";
import RemoveFieldModal from "./RemoveFieldModal";
import FormCreatedModal from "./FormCreatedModal";
import PreviewFormModal from "./PreviewFormModal";

const elementIcons: Record<string, React.ReactNode> = {
  header: <Heading1 size={16} />, text: <Type size={16} />, image: <ImageIcon size={16} />,
  field: <TextCursorInput size={16} />, dropdown: <ChevronsUpDown size={16} />, button: <MousePointerClick size={16} />,
  link: <Link2 size={16} />, icon: <Star size={16} />, compliance: <ScrollText size={16} />,
  container: <Square size={16} />, "two-col": <Columns2 size={16} />, "three-col": <Columns3 size={16} />, error: <AlertCircle size={16} />,
};

export default function FormBuilder({
  onExit, onTestForm, onEmbedSite, formId, formName, contactListNames, initialListName, initialDoubleOptIn, initialActive, onSave, onSaveError,
}: {
  onExit: () => void;
  onTestForm: () => void;
  onEmbedSite: () => void;
  formId?: string;
  formName?: string;
  contactListNames?: string[];
  initialListName?: string;
  initialDoubleOptIn?: boolean;
  initialActive?: boolean;
  onSave?: (payload: {
    formId: string;
    name: string;
    listName?: string;
    doubleOptIn: boolean;
    status: string;
  }) => Promise<void>;
  onSaveError?: (message: string) => void;
}) {
  const listOptions = (contactListNames?.length ? contactListNames : contactLists.map((l) => l.name)).map(
    (name, idx) => ({ id: `l${idx}`, name }),
  );
  const [formType, setFormType] = useState<"landing" | "embed">("landing");
  const [openSection, setOpenSection] = useState(1);
  const [view, setView] = useState<"form" | "success">("form");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [active, setActive] = useState(initialActive ?? true);
  const [selected, setSelected] = useState<string | null>(null);
  const [imageHue, setImageHue] = useState<string | null>(null);
  const [emailRemoved, setEmailRemoved] = useState(false);
  const [emailPlaceholder, setEmailPlaceholder] = useState("Email");
  const [chosenLists, setChosenLists] = useState<string[]>(initialListName ? [initialListName] : []);
  const [saving, setSaving] = useState(false);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [createdOpen, setCreatedOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMenu, setPreviewMenu] = useState(false);
  const [hiddenPanel, setHiddenPanel] = useState(false);

  const [name, setName] = useState(formName || (formType === "landing" ? "20 % Off" : "Embed - 20% Off"));
  const [doubleOptIn, setDoubleOptIn] = useState(
    initialDoubleOptIn != null ? String(initialDoubleOptIn) : formDefaults.doubleOptIn,
  );
  const [optIn, setOptIn] = useState(formDefaults.optIn);

  const handleSave = () => {
    if (onSave && formId) {
      setSaving(true);
      void onSave({
        formId,
        name,
        listName: chosenLists[0],
        doubleOptIn: Boolean(String(doubleOptIn).trim()),
        status: active ? "active" : "inactive",
      })
        .then(() => {
          setSaving(false);
          setCreatedOpen(true);
        })
        .catch((err) => {
          setSaving(false);
          onSaveError?.(err instanceof Error ? err.message : "Could not save form");
        });
      return;
    }
    setSaving(true);
    setTimeout(() => { setSaving(false); setCreatedOpen(true); }, 900);
  };

  const pickTemplate = (id: string) => {
    setTemplatesOpen(false);
    if (id.startsWith("e")) setFormType("embed");
    if (id === "t1") setImageHue(null);
  };

  const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? 520 : 380;

  return (
    <div className="tv-forms flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left config panel */}
      <div className="w-[320px] flex-none border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <button onClick={onExit} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"><ArrowLeft size={12} /> Grow / Forms / Create Form</button>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Layout size={16} className="text-indigo-600" /> Create Form</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Build forms by dragging elements onto the canvas and configuring their styles.</p>
        </div>
        <div className="flex-1 overflow-auto tv-scroll p-3 space-y-2">
          {selected ? (
            <FieldSettingsPanel
              kind={selected === "column" ? "column" : selected === "header" ? "header" : selected === "button" ? "button" : "field"}
              onBack={() => setSelected(null)}
              placeholder={emailPlaceholder}
              setPlaceholder={setEmailPlaceholder}
              onOpenImages={() => setImagesOpen(true)}
              onRemove={() => setRemoveOpen(true)}
            />
          ) : (
            <>
              <SectionRow num={1} title="Setup" open={openSection === 1} onToggle={() => setOpenSection(1)}>
                <Field label="Form type">
                  <div className="grid grid-cols-2 gap-2">
                    {([["landing", "Landing Page", "Create a standalone web page for this form."], ["embed", "Website Embed", "Embed this form directly into a page on your website."]] as const).map(([k, l, d]) => (
                      <button key={k} onClick={() => setFormType(k)} className={`text-left border rounded-lg p-2.5 relative ${formType === k ? "border-indigo-500 ring-1 ring-indigo-500/40 bg-indigo-50/50" : "border-border hover:border-slate-300"}`}>
                        {formType === k && <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center">✓</span>}
                        <div className="text-xs font-medium text-foreground">{l}</div>
                        <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{d}</div>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Description"><textarea className={inputCls} rows={2} defaultValue={formType === "landing" ? "Sharing on Instagram" : "Embedded on Contact Page"} /></Field>
                {formType === "landing" ? (
                  <>
                    <Field label="Page Title"><input className={inputCls} defaultValue={formDefaults.pageTitle} /></Field>
                    <Field label="Custom URL Path"><input className={inputCls} defaultValue={formDefaults.urlPath} /></Field>
                    <Field label="Final Page URL"><input className={inputCls} disabled value="https://forms.transovo.io/20percentoff" /></Field>
                  </>
                ) : (
                  <Field label="Embed Code"><textarea className={inputCls} rows={2} disabled placeholder="Generated on Save" /></Field>
                )}
              </SectionRow>

              <SectionRow num={2} title="Design" open={openSection === 2} onToggle={() => setOpenSection(2)}>
                <p className="text-[11px] text-muted-foreground">Design your form using a pre-built template or create your own from scratch. Drag elements below onto the canvas and configure their styles to customize your design.</p>
                <button onClick={() => setTemplatesOpen(true)} className="w-full border border-dashed border-indigo-400 text-indigo-600 rounded-lg py-2.5 text-xs font-medium hover:bg-indigo-50">✦ Select a Template</button>
                <div className="grid grid-cols-3 gap-2">
                  {designElements.map((el) => (
                    <div key={el.id} className="tv-element-tile">{elementIcons[el.id]}<span className="text-center leading-tight">{el.label}</span></div>
                  ))}
                </div>
              </SectionRow>

              <SectionRow num={3} title="Behavior" open={openSection === 3} onToggle={() => setOpenSection(3)}>
                <Field label="Contact Behavior" hint="This setting determines whether your form will create new contacts or update existing ones.">
                  <select className={inputCls}><option>Creates Contacts</option><option>Updates Contacts</option></select>
                </Field>
                <Field label="Contact Lists" hint="When your form is submitted, you can optionally add contacts to one or more of your lists.">
                  <div className="border border-border rounded-md">
                    <input className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none" placeholder="Search" />
                    {listOptions.map((l) => (
                      <button key={l.id} onClick={() => setChosenLists((c) => c.includes(l.name) ? c.filter((x) => x !== l.name) : [...c, l.name])}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-muted ${chosenLists.includes(l.name) ? "text-indigo-600 font-medium" : "text-foreground"}`}>
                        ☰ {l.name} {chosenLists.includes(l.name) && "✓"}
                      </button>
                    ))}
                  </div>
                  {chosenLists.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {chosenLists.map((l) => <span key={l} className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-2 py-0.5 flex items-center gap-1">{l} <button onClick={() => setChosenLists((c) => c.filter((x) => x !== l))}>×</button></span>)}
                    </div>
                  )}
                </Field>
              </SectionRow>

              <SectionRow num={4} title="Custom Code" open={openSection === 4} onToggle={() => setOpenSection(4)}>
                <Field label="CSS" hint="Insert css code into your form to further customize the design.">
                  <textarea className={`${inputCls} font-mono text-xs`} rows={3} />
                </Field>
                <Field label="Javascript" hint="Insert javascript code that will be executed on load. Use this to add analytics and other tracking pixels.">
                  <textarea className={`${inputCls} font-mono text-xs`} rows={3} />
                </Field>
              </SectionRow>

              <SectionRow num={5} title="Messaging" open={openSection === 5} onToggle={() => setOpenSection(5)}>
                <Field label="Double Opt-In Message" hint="After someone provides their mobile number, they'll receive this message asking them to confirm before being subscribed.">
                  <div className="relative">
                    <textarea className={inputCls} rows={3} value={doubleOptIn} onChange={(e) => setDoubleOptIn(e.target.value)} />
                    <span className="absolute top-1 right-1.5 text-[10px] text-muted-foreground">{doubleOptIn.length}/918</span>
                  </div>
                </Field>
                <Field label="Opt-In Message" hint="After someone replies with the word YES, they'll receive this message confirming that they've been successfully subscribed.">
                  <div className="relative">
                    <textarea className={inputCls} rows={3} value={optIn} onChange={(e) => setOptIn(e.target.value)} />
                    <span className="absolute top-1 right-1.5 text-[10px] text-muted-foreground">{optIn.length}/918</span>
                  </div>
                </Field>
              </SectionRow>
            </>
          )}
        </div>
        <div className="p-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Toggle on={active} onChange={setActive} /> Active
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-2 rounded-md">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
        <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setView("form")} className={`px-3 py-1.5 rounded-md ${view === "form" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>Form</button>
            <button onClick={() => setView("success")} className={`px-3 py-1.5 rounded-md ${view === "success" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>Success</button>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <button className="p-1.5 hover:bg-muted rounded" title="Undo Last Change"><Undo2 size={15} /></button>
            <button className="p-1.5 hover:bg-muted rounded"><Redo2 size={15} /></button>
            <div className="relative">
              <button className="p-1.5 hover:bg-muted rounded" onClick={() => setHiddenPanel(!hiddenPanel)}>{hiddenPanel ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              {hiddenPanel && (
                <div className="absolute right-0 top-8 bg-card border border-border rounded-lg shadow-lg w-52 py-1 z-20 tv-pop text-xs">
                  <div className="px-3 py-1 text-[10px] text-muted-foreground">HIDDEN ON MOBILE</div>
                  <div className="px-3 py-1.5 flex items-center gap-2">▦ Column <span className="ml-auto w-8 h-4 rounded-full bg-indigo-600 relative"><span className="absolute top-0.5 right-0.5 w-3 h-3 bg-white rounded-full" /></span></div>
                  <div className="px-3 py-1 text-[10px] text-muted-foreground">HIDDEN WHEN EMPTY</div>
                  <div className="px-3 py-1.5 flex items-center gap-2">⊙ Error Text <span className="ml-auto w-8 h-4 rounded-full bg-indigo-600 relative"><span className="absolute top-0.5 right-0.5 w-3 h-3 bg-white rounded-full" /></span></div>
                </div>
              )}
            </div>
            <span className="w-px h-4 bg-border mx-1" />
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([k, I]) => (
              <button key={k} onClick={() => setDevice(k)} className={`p-1.5 rounded ${device === k ? "bg-indigo-100 text-indigo-600" : "hover:bg-muted"}`}><I size={15} /></button>
            ))}
            <span className="w-px h-4 bg-border mx-1" />
            <div className="relative">
              <button onClick={() => setPreviewMenu(!previewMenu)} className="p-1.5 hover:bg-muted rounded" title="Preview & Testing"><FlaskConical size={15} /></button>
              {previewMenu && (
                <div className="absolute right-0 top-8 bg-card border border-border rounded-lg shadow-lg w-44 py-1 z-20 tv-pop text-xs">
                  <div className="px-3 py-1 text-[10px] text-muted-foreground">PREVIEW & TESTING</div>
                  <button className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { setPreviewMenu(false); setPreviewOpen(true); }}>🔗 Preview Form</button>
                  <button className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { setPreviewMenu(false); onTestForm(); }}>🧪 Test Form</button>
                  {formType === "embed" && <button className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { setPreviewMenu(false); onEmbedSite(); }}>🌐 Embed on Website</button>}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto tv-scroll flex items-start justify-center p-8">
          <div style={{ width: deviceWidth, transition: "width .25s" }} className="tv-fade">
            <BuilderCanvas
              formType={formType} view={view} imageHue={imageHue} emailRemoved={emailRemoved}
              emailPlaceholder={emailPlaceholder} selected={selected} onSelect={setSelected}
            />
          </div>
        </div>
      </div>

      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} onPick={pickTemplate} />
      <ImageSearchModal open={imagesOpen} onClose={() => setImagesOpen(false)} onPick={(hue) => { setImageHue(hue); setImagesOpen(false); }} />
      <RemoveFieldModal open={removeOpen} onClose={() => setRemoveOpen(false)} onConfirm={() => { setEmailRemoved(true); setRemoveOpen(false); setSelected(null); }} />
      <FormCreatedModal open={createdOpen} onClose={() => setCreatedOpen(false)} type={formType} url="https://forms.transovo.io/20percentoff" embedCode='<script async src="https://static.transovo.io/forms/scripts/embed/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9"></script>' />
      <PreviewFormModal open={previewOpen} onClose={() => setPreviewOpen(false)} imageHue={imageHue} emailRemoved={emailRemoved} emailPlaceholder={emailPlaceholder} />
    </div>
  );
}
