"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Heading1, Type, Image as ImageIcon, TextCursorInput, ChevronsUpDown, MousePointerClick,
  Link2, Star, ScrollText, Square, Columns2, Columns3, AlertCircle, Undo2, Redo2, Eye, EyeOff,
  Monitor, Tablet, Smartphone, FlaskConical, Layout, ChevronRight,
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
import type { FormLayout, FormBlock } from "@/lib/forms/layout";
import {
  defaultLayoutFromConfig,
  deriveConfigFromLayout,
  ensureEmailField,
  fieldsFromLayout,
  syncLayoutContent,
  updateBlockInLayout,
  updateBlockStyle,
  addPaletteElement,
  insertPaletteElementAt,
  moveFormBlock,
  FORM_DND_PALETTE,
  layoutFromTemplate,
  removeBlockFromLayout,
  setFieldKeyOnBlock,
} from "@/lib/forms/layout";
import { useLayoutHistory } from "@/lib/forms/use-layout-history";
import type { OptInFormConfig } from "@/lib/forms/types";
import type { FormFieldKey } from "@/lib/forms/types";

const elementIcons: Record<string, React.ReactNode> = {
  header: <Heading1 size={16} />, text: <Type size={16} />, image: <ImageIcon size={16} />,
  field: <TextCursorInput size={16} />, dropdown: <ChevronsUpDown size={16} />, button: <MousePointerClick size={16} />,
  link: <Link2 size={16} />, icon: <Star size={16} />, compliance: <ScrollText size={16} />,
  container: <Square size={16} />, "two-col": <Columns2 size={16} />, "three-col": <Columns3 size={16} />, error: <AlertCircle size={16} />,
};

function blockKind(block: FormBlock | undefined): "field" | "column" | "header" | "button" | "text" | "compliance" | "link" | "error" | null {
  if (!block) return null;
  if (block.type === "image-column") return "column";
  if (block.type === "header") return "header";
  if (block.type === "button") return "button";
  if (block.type === "text") return "text";
  if (block.type === "compliance") return "compliance";
  if (block.type === "link") return "link";
  if (block.type === "error") return "error";
  if (block.type === "field" || block.type === "field-row") return "field";
  return null;
}

export default function FormBuilder({
  onExit, onTestForm, onEmbedSite, formId, formName, contactListNames,
  initialListName, initialDoubleOptIn, initialActive,
  initialHeadline, initialSubheadline, initialButtonLabel, initialFields,
  initialOptInMessage, initialDoubleOptInMessage, initialLayout,
  initialDescription, initialUrlPath, initialCustomCss, initialCustomJs,
  initialSuccessHeadline, initialSuccessMessage, initialContactMode,
  onSave, onSaveError,
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
  initialHeadline?: string;
  initialSubheadline?: string;
  initialButtonLabel?: string;
  initialFields?: string[];
  initialOptInMessage?: string;
  initialDoubleOptInMessage?: string;
  initialLayout?: FormLayout | null;
  initialDescription?: string;
  initialUrlPath?: string;
  initialCustomCss?: string;
  initialCustomJs?: string;
  initialSuccessHeadline?: string;
  initialSuccessMessage?: string;
  initialContactMode?: "create" | "update";
  onSave?: (payload: {
    formId: string;
    name: string;
    listName?: string;
    doubleOptIn: boolean;
    status: string;
    headline?: string;
    subheadline?: string;
    buttonLabel?: string;
    fields?: string[];
    optInMessage?: string;
    doubleOptInMessage?: string;
    layout?: FormLayout;
    description?: string;
    urlPath?: string;
    customCss?: string;
    customJs?: string;
    successHeadline?: string;
    successMessage?: string;
    contactMode?: "create" | "update";
  }) => Promise<void>;
  onSaveError?: (message: string) => void;
}) {
  const seedConfig: OptInFormConfig = {
    headline: initialHeadline,
    subheadline: initialSubheadline,
    buttonLabel: initialButtonLabel,
    fields: (initialFields as OptInFormConfig["fields"]) || ["firstName", "phone"],
    optInMessage: initialOptInMessage,
    doubleOptInMessage: initialDoubleOptInMessage,
  };

  const listOptions = (contactListNames?.length ? contactListNames : contactLists.map((l) => l.name)).map(
    (name, idx) => ({ id: `l${idx}`, name }),
  );

  const { layout, setLayout, undo, redo, canUndo, canRedo, resetHistory } = useLayoutHistory(
    initialLayout || defaultLayoutFromConfig(seedConfig, "landing"),
  );
  const [openSection, setOpenSection] = useState(1);
  const [view, setView] = useState<"form" | "success">("form");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [active, setActive] = useState(initialActive ?? true);
  const [selected, setSelected] = useState<string | null>(null);
  const [chosenLists, setChosenLists] = useState<string[]>(initialListName ? [initialListName] : []);
  const [saving, setSaving] = useState(false);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [createdOpen, setCreatedOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMenu, setPreviewMenu] = useState(false);
  const [savedUrl, setSavedUrl] = useState("");
  const [savedEmbed, setSavedEmbed] = useState("");
  const [hiddenPanel, setHiddenPanel] = useState(false);

  const [name, setName] = useState(formName || formDefaults.name);
  const [description, setDescription] = useState(initialDescription || formDefaults.description);
  const [urlPath, setUrlPath] = useState(initialUrlPath || formDefaults.urlPath);
  const [contactMode, setContactMode] = useState<"create" | "update">(
    initialContactMode || layout.contactMode || "create",
  );
  const [customCss, setCustomCss] = useState(initialCustomCss || layout.customCss || "");
  const [customJs, setCustomJs] = useState(initialCustomJs || layout.customJs || "");
  const [successHeadline, setSuccessHeadline] = useState(
    initialSuccessHeadline || layout.successHeadline || "Check Your Texts",
  );
  const [successMessage, setSuccessMessage] = useState(
    initialSuccessMessage || layout.successMessage || formDefaults.optIn,
  );
  const [doubleOptInEnabled, setDoubleOptInEnabled] = useState(initialDoubleOptIn ?? false);
  const [doubleOptIn, setDoubleOptIn] = useState(
    initialDoubleOptInMessage || formDefaults.doubleOptIn,
  );
  const [optIn, setOptIn] = useState(initialOptInMessage || formDefaults.optIn);

  const derived = useMemo(() => deriveConfigFromLayout(layout), [layout]);
  const headline = derived.headline || "";
  const subheadline = derived.subheadline || "";
  const buttonLabel = derived.buttonLabel || "Join Now";
  const emailBlock = layout.blocks.find((b) => b.type === "field" && b.props?.fieldKey === "email");
  const emailRemoved = emailBlock?.props?.hidden === true;

  useEffect(() => {
    if (initialLayout) resetHistory(initialLayout);
  }, [initialLayout, resetHistory]);

  const selectedBlock = layout.blocks.find((b) => b.id === selected);
  const panelKind = blockKind(selectedBlock);

  const handleSave = () => {
    const finalLayout: FormLayout = {
      ...layout,
      description,
      urlPath,
      customCss,
      customJs,
      successHeadline,
      successMessage,
      contactMode,
    };
    const flat = deriveConfigFromLayout(finalLayout);
    const fields = fieldsFromLayout(finalLayout);

    if (onSave && formId) {
      setSaving(true);
      void onSave({
        formId,
        name,
        listName: chosenLists[0],
        doubleOptIn: doubleOptInEnabled,
        status: active ? "active" : "inactive",
        headline: flat.headline,
        subheadline: flat.subheadline,
        buttonLabel: flat.buttonLabel,
        fields,
        optInMessage: optIn,
        doubleOptInMessage: doubleOptIn,
        layout: finalLayout,
        description,
        urlPath,
        customCss,
        customJs,
        successHeadline,
        successMessage,
        contactMode,
      })
        .then(() => {
          setSaving(false);
          setSavedUrl(urlPath ? `https://forms.transovo.io/${urlPath}` : "");
          setSavedEmbed(`<script async src="https://static.transovo.io/forms/scripts/embed/${formId}"></script>`);
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
    const next = layoutFromTemplate(id, layout);
    resetHistory(next);
  };

  const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? 520 : 380;

  return (
    <div className="tv-forms flex h-[calc(100vh-64px)] overflow-hidden">
      <div className={`w-[320px] flex-none border-r border-border bg-card flex flex-col ${hiddenPanel ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="p-4 border-b border-border">
          <button onClick={onExit} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"><ArrowLeft size={12} /> Grow / Forms / Create Form</button>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Layout size={16} className="text-indigo-600" /> Create Form</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Build forms by configuring elements on the canvas.</p>
        </div>
        <div className="flex-1 overflow-auto tv-scroll p-3 space-y-2">
          {selected && panelKind ? (
            <FieldSettingsPanel
              kind={panelKind}
              onBack={() => setSelected(null)}
              placeholder={selectedBlock?.props?.placeholder || "Email"}
              setPlaceholder={(v) => {
                if (!selected) return;
                setLayout((prev) => updateBlockInLayout(prev, selected, { placeholder: v }));
              }}
              contentValue={selectedBlock?.props?.content || ""}
              onContentChange={(v) => {
                if (!selected) return;
                setLayout((prev) => updateBlockInLayout(prev, selected, { content: v }));
              }}
              fieldKey={selectedBlock?.props?.fieldKey}
              onFieldKeyChange={(key: FormFieldKey) => {
                if (!selected) return;
                setLayout((prev) => setFieldKeyOnBlock(prev, selected, key));
              }}
              required={selectedBlock?.props?.required}
              onRequiredChange={(v) => {
                if (!selected) return;
                setLayout((prev) => updateBlockInLayout(prev, selected, { required: v }));
              }}
              defaultValue={selectedBlock?.props?.defaultValue}
              onDefaultValueChange={(v) => {
                if (!selected) return;
                setLayout((prev) => updateBlockInLayout(prev, selected, { defaultValue: v }));
              }}
              inputMode={selectedBlock?.props?.inputMode}
              onInputModeChange={(v) => {
                if (!selected) return;
                setLayout((prev) => updateBlockInLayout(prev, selected, { inputMode: v }));
              }}
              style={selectedBlock?.props?.style}
              onStyleChange={(patch) => {
                if (!selected) return;
                setLayout((prev) => updateBlockStyle(prev, selected, patch));
              }}
              onOpenImages={() => setImagesOpen(true)}
              onRemove={() => {
                if (!selected) return;
                setRemoveOpen(true);
              }}
            />
          ) : (
            <>
              <SectionRow num={1} title="Setup" open={openSection === 1} onToggle={() => setOpenSection(1)}>
                <Field label="Form type">
                  <div className="grid grid-cols-2 gap-2">
                    {([["landing", "Landing Page", "Create a standalone web page for this form."], ["embed", "Website Embed", "Embed this form directly into a page on your website."]] as const).map(([k, l, d]) => (
                      <button key={k} onClick={() => setLayout((prev) => syncLayoutContent(prev, { formType: k }))} className={`text-left border rounded-lg p-2.5 relative ${layout.formType === k ? "border-indigo-500 ring-1 ring-indigo-500/40 bg-indigo-50/50" : "border-border hover:border-slate-300"}`}>
                        {layout.formType === k && <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center">✓</span>}
                        <div className="text-xs font-medium text-foreground">{l}</div>
                        <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{d}</div>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Description"><textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
                {layout.formType === "landing" ? (
                  <>
                    <Field label="Page Title">
                      <input
                        className={inputCls}
                        value={headline}
                        onChange={(e) => setLayout((prev) => syncLayoutContent(prev, { headline: e.target.value }))}
                      />
                    </Field>
                    <Field label="Custom URL Path"><input className={inputCls} value={urlPath} onChange={(e) => setUrlPath(e.target.value)} /></Field>
                  </>
                ) : (
                  <Field label="Embed Code"><textarea className={inputCls} rows={2} disabled placeholder="Generated on Save" /></Field>
                )}
              </SectionRow>

              <SectionRow num={2} title="Design" open={openSection === 2} onToggle={() => setOpenSection(2)}>
                <p className="text-[11px] text-muted-foreground">Drag elements onto the canvas to place them, or click to add. Drag block handles to reorder.</p>
                <button onClick={() => setTemplatesOpen(true)} className="w-full border border-dashed border-indigo-400 text-indigo-600 rounded-lg py-2.5 text-xs font-medium hover:bg-indigo-50">✦ Select a Template</button>
                <div className="grid grid-cols-3 gap-2">
                  {designElements.map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      className="tv-element-tile"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(FORM_DND_PALETTE, el.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => {
                        if (el.id === "field") {
                          setLayout((prev) => ensureEmailField(prev, true));
                        } else {
                          setLayout((prev) => addPaletteElement(prev, el.id));
                        }
                      }}
                    >
                      {elementIcons[el.id]}<span className="text-center leading-tight">{el.label}</span>
                    </button>
                  ))}
                </div>
              </SectionRow>

              <SectionRow num={3} title="Behavior" open={openSection === 3} onToggle={() => setOpenSection(3)}>
                <Field label="Contact Behavior" hint="This setting determines whether your form will create new contacts or update existing ones.">
                  <select className={inputCls} value={contactMode} onChange={(e) => setContactMode(e.target.value as "create" | "update")}>
                    <option value="create">Creates Contacts</option>
                    <option value="update">Updates Contacts</option>
                  </select>
                </Field>
                <Field label="Contact Lists" hint="When your form is submitted, contacts can be added to a list.">
                  <div className="border border-border rounded-md">
                    {listOptions.map((l) => (
                      <button key={l.id} onClick={() => setChosenLists((c) => c.includes(l.name) ? c.filter((x) => x !== l.name) : [...c, l.name])}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-muted ${chosenLists.includes(l.name) ? "text-indigo-600 font-medium" : "text-foreground"}`}>
                        ☰ {l.name} {chosenLists.includes(l.name) && "✓"}
                      </button>
                    ))}
                  </div>
                </Field>
              </SectionRow>

              <SectionRow num={4} title="Custom Code" open={openSection === 4} onToggle={() => setOpenSection(4)}>
                <Field label="CSS" hint="Insert css code into your form to further customize the design.">
                  <textarea className={`${inputCls} font-mono text-xs`} rows={3} value={customCss} onChange={(e) => setCustomCss(e.target.value)} />
                </Field>
                <Field label="Javascript" hint="Insert javascript code that will be executed on load.">
                  <textarea className={`${inputCls} font-mono text-xs`} rows={3} value={customJs} onChange={(e) => setCustomJs(e.target.value)} />
                </Field>
              </SectionRow>

              <SectionRow num={5} title="Messaging" open={openSection === 5} onToggle={() => setOpenSection(5)}>
                <Field label="Double Opt-In" hint="Require contacts to confirm with YES before subscribing.">
                  <Toggle on={doubleOptInEnabled} onChange={setDoubleOptInEnabled} />
                </Field>
                <Field label="Double Opt-In Message">
                  <textarea className={inputCls} rows={3} value={doubleOptIn} onChange={(e) => setDoubleOptIn(e.target.value)} />
                </Field>
                <Field label="Opt-In Message">
                  <textarea className={inputCls} rows={3} value={optIn} onChange={(e) => setOptIn(e.target.value)} />
                </Field>
              </SectionRow>

              <SectionRow num={6} title="Success Page" open={openSection === 6} onToggle={() => setOpenSection(6)}>
                <Field label="Success Headline">
                  <input className={inputCls} value={successHeadline} onChange={(e) => setSuccessHeadline(e.target.value)} />
                </Field>
                <Field label="Success Message">
                  <textarea className={inputCls} rows={3} value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
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

      <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
        <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setView("form")} className={`px-3 py-1.5 rounded-md ${view === "form" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>Form</button>
            <button onClick={() => setView("success")} className={`px-3 py-1.5 rounded-md ${view === "success" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>Success</button>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <button onClick={undo} disabled={!canUndo} className="p-1.5 hover:bg-muted rounded disabled:opacity-30" title="Undo"><Undo2 size={15} /></button>
            <button onClick={redo} disabled={!canRedo} className="p-1.5 hover:bg-muted rounded disabled:opacity-30" title="Redo"><Redo2 size={15} /></button>
            <div className="relative">
              <button className="p-1.5 hover:bg-muted rounded" onClick={() => setHiddenPanel(!hiddenPanel)}>{hiddenPanel ? <EyeOff size={15} /> : <Eye size={15} />}</button>
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
                  <button className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { setPreviewMenu(false); setPreviewOpen(true); }}>🔗 Preview Form</button>
                  <button className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { setPreviewMenu(false); onTestForm(); }}>🧪 Test Form</button>
                  {layout.formType === "embed" && <button className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { setPreviewMenu(false); onEmbedSite(); }}>🌐 Embed on Website</button>}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto tv-scroll flex items-start justify-center p-8">
          <div style={{ width: deviceWidth, transition: "width .25s" }} className="tv-fade">
            <BuilderCanvas
              layout={layout}
              view={view}
              selected={selected}
              onSelect={setSelected}
              device={device}
              onInsertPalette={(elementId, index) => {
                if (elementId === "field") {
                  setLayout((prev) => {
                    const withEmail = ensureEmailField(prev, true);
                    const emailBlock = withEmail.blocks.find(
                      (b) => b.type === "field" && b.props?.fieldKey === "email" && !b.props?.hidden,
                    );
                    if (!emailBlock) return withEmail;
                    return moveFormBlock(withEmail, emailBlock.id, index);
                  });
                  return;
                }
                setLayout((prev) => insertPaletteElementAt(prev, elementId, index));
              }}
              onMoveBlock={(blockId, index) => {
                setLayout((prev) => moveFormBlock(prev, blockId, index));
              }}
            />
          </div>
        </div>
      </div>

      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} onPick={pickTemplate} />
      <ImageSearchModal open={imagesOpen} onClose={() => setImagesOpen(false)} onPick={(hue) => { setLayout((prev) => syncLayoutContent(prev, { imageHue: hue })); setImagesOpen(false); }} />
      <RemoveFieldModal open={removeOpen} onClose={() => setRemoveOpen(false)} onConfirm={() => {
        if (!selected) return;
        setLayout((prev) => removeBlockFromLayout(prev, selected));
        setRemoveOpen(false);
        setSelected(null);
      }} />
      <FormCreatedModal open={createdOpen} onClose={() => setCreatedOpen(false)} type={layout.formType} url={savedUrl || `https://forms.transovo.io/${urlPath}`} embedCode={savedEmbed || `<script async src="https://static.transovo.io/forms/scripts/embed/${formId || "draft"}"></script>`} />
      <PreviewFormModal open={previewOpen} onClose={() => setPreviewOpen(false)} layout={layout} />
    </div>
  );
}
