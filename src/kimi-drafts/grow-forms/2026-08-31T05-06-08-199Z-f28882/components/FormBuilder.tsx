"use client";

import { useState } from "react";
import {
  ChevronLeft, Eye, Undo2, Redo2, EyeOff, Monitor, Tablet, Smartphone,
  FlaskConical, ChevronDown, LayoutTemplate, ToggleLeft,
} from "lucide-react";
import { builderDefaults } from "../mock-data";
import TemplatesModal from "./TemplatesModal";
import ImageSearchModal from "./ImageSearchModal";
import { RemoveFieldModal } from "./Modals";
import FormCreatedModal from "./FormCreatedModal";
import { SetupPanel, DesignPanel, BehaviorPanel, CustomCodePanel, MessagingPanel, SettingsPanel } from "./BuilderPanels";
import { SavedForm } from "../page";

export type BuilderSection = "setup" | "design" | "behavior" | "code" | "messaging";

export default function FormBuilder({
  formType, onBack, onSave, onPreview, onPreviewEmbedSite, showCreated, onCloseCreated, saved,
}: {
  formType: "landing" | "embed";
  onBack: () => void;
  onSave: (type: "landing" | "embed", name: string, desc: string, urlPath: string) => void;
  onPreview: () => void;
  onPreviewEmbedSite: () => void;
  showCreated: boolean;
  onCloseCreated: () => void;
  saved: SavedForm | null;
}) {
  const d = builderDefaults[formType];
  const [section, setSection] = useState<BuilderSection>("setup");
  const [name, setName] = useState(d.name);
  const [desc, setDesc] = useState(d.description);
  const [pageTitle, setPageTitle] = useState(formType === "landing" ? builderDefaults.landing.pageTitle : "");
  const [urlPath, setUrlPath] = useState(formType === "landing" ? "20percentoff" : "");
  const [canvasView, setCanvasView] = useState<"form" | "success">("form");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [templateApplied, setTemplateApplied] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [emailRemoved, setEmailRemoved] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const [selectedLists, setSelectedLists] = useState<string[]>(["VIP Club Members"]);
  const [testMenu, setTestMenu] = useState(false);

  const isEmbed = formType === "embed";
  const canvasBg = templateApplied || isEmbed ? (bgImage ? "#2f4a37" : isEmbed ? "#0a0a0a" : "#2f4a37") : "#fff";

  const doSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave(formType, name, desc, urlPath);
    }, 900);
  };

  const widthClass = device === "mobile" ? "max-w-[380px]" : device === "tablet" ? "max-w-[560px]" : "max-w-[900px]";

  return (
    <div className="flex h-screen flex-col">
      {/* Builder header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button className="tv-icon-btn" onClick={onBack}><ChevronLeft size={18} /></button>
          <div>
            <div className="text-[11px] text-gray-400">Grow / Web Forms / {name || "Create Form"}</div>
            <div className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
              <LayoutTemplate size={15} className="text-gray-600" /> {name ? "Edit Form" : "Create Form"}
            </div>
          </div>
        </div>
        <button className="tv-btn-ghost flex items-center gap-1.5" onClick={onPreview}><Eye size={14} /> View</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left rail */}
        <div className="tv-scroll w-[320px] shrink-0 overflow-y-auto border-r border-gray-200 bg-[#fafafc] p-4">
          {selectedEl ? (
            <SettingsPanel element={selectedEl} onBack={() => setSelectedEl(null)} />
          ) : (
            <>
              <p className="text-[12px] text-gray-500 mb-3">
                Build forms by dragging elements onto the canvas and configuring their styles.
              </p>
              <div className="space-y-2">
                <div className={`tv-section-row ${section === "setup" ? "active" : ""}`} onClick={() => setSection(section === "setup" ? "design" : "setup")}>
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${section === "setup" ? "bg-indigo-600" : "bg-gray-300"}`} /> Setup</span>
                  <ChevronDown size={14} className={`transition-transform ${section === "setup" ? "" : "-rotate-90"}`} />
                </div>
                {section === "setup" && (
                  <SetupPanel
                    formType={formType} name={name} setName={setName} desc={desc} setDesc={setDesc}
                    pageTitle={pageTitle} setPageTitle={setPageTitle} urlPath={urlPath} setUrlPath={setUrlPath}
                  />
                )}

                <div className={`tv-section-row ${section === "design" ? "active" : ""}`} onClick={() => setSection("design")}>
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${section === "design" ? "bg-indigo-600" : "bg-gray-300"}`} /> Design</span>
                  <ChevronDown size={14} className={`transition-transform ${section === "design" ? "" : "-rotate-90"}`} />
                </div>
                {section === "design" && <DesignPanel onSelectTemplate={() => setShowTemplates(true)} />}

                <div className={`tv-section-row ${section === "behavior" ? "active" : ""}`} onClick={() => setSection("behavior")}>
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${section === "behavior" ? "bg-indigo-600" : "bg-gray-300"}`} /> Behavior</span>
                  <ChevronDown size={14} className={`transition-transform ${section === "behavior" ? "" : "-rotate-90"}`} />
                </div>
                {section === "behavior" && <BehaviorPanel selectedLists={selectedLists} setSelectedLists={setSelectedLists} />}

                <div className={`tv-section-row ${section === "code" ? "active" : ""}`} onClick={() => setSection("code")}>
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${section === "code" ? "bg-indigo-600" : "bg-gray-300"}`} /> Custom Code</span>
                  <ChevronDown size={14} className={`transition-transform ${section === "code" ? "" : "-rotate-90"}`} />
                </div>
                {section === "code" && <CustomCodePanel />}

                <div className={`tv-section-row ${section === "messaging" ? "active" : ""}`} onClick={() => setSection("messaging")}>
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${section === "messaging" ? "bg-indigo-600" : "bg-gray-300"}`} /> Messaging</span>
                  <ChevronDown size={14} className={`transition-transform ${section === "messaging" ? "" : "-rotate-90"}`} />
                </div>
                {section === "messaging" && <MessagingPanel />}
              </div>
            </>
          )}
        </div>

        {/* Canvas */}
        <div className="tv-scroll relative flex flex-1 items-start justify-center overflow-y-auto bg-[#f2f3f6] p-10">
          {!templateApplied && !isEmbed ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <LayoutTemplate size={26} />
              </div>
              <div className="text-[15px] font-bold text-gray-900">Create Form</div>
              <p className="mt-1 max-w-[280px] text-[12px] text-gray-500">
                Drag elements onto this canvas or{" "}
                <button className="text-indigo-600 hover:underline" onClick={() => setShowTemplates(true)}>select a template</button>{" "}
                to design your form.
              </p>
            </div>
          ) : (
            <div className={`w-full ${widthClass} transition-all`}>
              <div
                className="relative overflow-hidden rounded-lg shadow-xl"
                style={{ background: canvasBg, minHeight: 460 }}
              >
                {/* split layout */}
                <div className={`grid ${device === "mobile" ? "grid-cols-1" : isEmbed ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div className={`${isEmbed ? "p-10" : "p-10"} flex flex-col justify-center`}>
                    {canvasView === "form" ? (
                      <>
                        <h2
                          className={`text-center text-[24px] font-bold ${isEmbed ? "text-white" : "text-white"} cursor-pointer rounded px-2 ${selectedEl === "header" ? "ring-2 ring-indigo-400" : ""}`}
                          style={{ fontFamily: isEmbed ? "'Cormorant Garamond', serif" : "inherit" }}
                          onClick={() => setSelectedEl("header")}
                        >
                          {d.heading}
                        </h2>
                        <p className="mt-2 text-center text-[12px] text-white/80">{d.subheading}</p>
                        <div className={`mt-6 grid ${device === "mobile" ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
                          <div className="rounded bg-white/95 px-3 py-2.5 text-[12px] text-gray-400">First Name</div>
                          <div className="rounded bg-white/95 px-3 py-2.5 text-[12px] text-gray-400">Last Name</div>
                        </div>
                        <div className="mt-3 rounded bg-white/95 px-3 py-2.5 text-[12px] text-gray-400">Mobile Number</div>
                        {!emailRemoved && (
                          <div
                            className={`mt-3 cursor-pointer rounded bg-white/95 px-3 py-2.5 text-[12px] text-gray-400 ${selectedEl === "email" ? "ring-2 ring-indigo-400" : ""}`}
                            onClick={() => setSelectedEl("email")}
                          >
                            Email (Optional)
                          </div>
                        )}
                        <button
                          className={`mt-4 w-full rounded py-3 text-[13px] font-semibold tracking-wide ${isEmbed ? "bg-white text-black" : "bg-[#c8b291] text-[#2b2b22]"}`}
                          onClick={() => setSelectedEl("button")}
                        >
                          {d.buttonText}
                        </button>
                        <p className="mt-4 text-[8px] leading-relaxed text-white/50">{builderDefaults.compliance}</p>
                      </>
                    ) : (
                      <div className="py-14 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
                          <Eye size={20} className="text-white/80" />
                        </div>
                        <h2 className="text-[22px] font-bold text-white">Check Your Texts</h2>
                        <p className="mx-auto mt-2 max-w-[300px] text-[12px] text-white/80">
                          We just sent you a message. Reply YES and we'll respond with your promo code.
                        </p>
                      </div>
                    )}
                  </div>
                  {!isEmbed && device !== "mobile" && (
                    <div
                      className="relative min-h-[300px] cursor-pointer"
                      onClick={() => setSelectedEl("column")}
                      style={{
                        background: bgImage
                          ? `linear-gradient(hsl(${bgImage},35%,45%), hsl(${bgImage},45%,30%))`
                          : "linear-gradient(160deg,#3d5c43,#24382a)",
                      }}
                    >
                      <div className="absolute inset-0 opacity-60" style={{
                        backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.15), transparent 40%), radial-gradient(circle at 70% 70%, rgba(0,0,0,.2), transparent 50%)",
                      }} />
                      <div className="absolute bottom-3 left-3 rounded bg-black/40 px-2 py-0.5 text-[10px] text-white/80">
                        {bgImage ? "Café photo" : "Forest photo"} — click to change
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* floating remove-field trigger for demo parity */}
          {selectedEl === "email" && !emailRemoved && (
            <button
              className="absolute bottom-24 right-10 rounded-md bg-red-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg"
              onClick={() => setShowRemove(true)}
            >
              Remove Field
            </button>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 text-[12px] font-semibold text-gray-600" onClick={() => setActive(!active)}>
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? "bg-indigo-600" : "bg-gray-300"}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${active ? "translate-x-4.5 ml-[18px]" : "ml-[3px]"}`} />
            </span>
            Active
          </button>
          <button className="tv-btn-primary !px-6" onClick={doSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
          <button className={`tv-pill-tab ${canvasView === "form" ? "active" : ""}`} onClick={() => setCanvasView("form")}>Form</button>
          <button className={`tv-pill-tab ${canvasView === "success" ? "active" : ""}`} onClick={() => setCanvasView("success")}>Success</button>
        </div>

        <div className="flex items-center gap-1">
          <button className="tv-icon-btn" title="Undo Last Change" onClick={() => setEmailRemoved(false)}><Undo2 size={15} /></button>
          <button className="tv-icon-btn" title="Redo"><Redo2 size={15} /></button>
          <button className="tv-icon-btn" title="Hidden Elements"><EyeOff size={15} /></button>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <div className="relative">
            <button className="tv-icon-btn" title="Preview & Testing" onClick={() => setTestMenu(!testMenu)}>
              <FlaskConical size={15} />
            </button>
            {testMenu && (
              <div className="absolute bottom-9 right-0 z-30 w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Preview & Testing</div>
                <div className="tv-drop-item" onClick={() => { setTestMenu(false); onPreview(); }}><Eye size={14} /> Preview Form</div>
                <div className="tv-drop-item" onClick={() => { setTestMenu(false); isEmbed ? onPreviewEmbedSite() : onPreview(); }}><FlaskConical size={14} /> Test Form</div>
              </div>
            )}
          </div>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <button className={`tv-icon-btn ${device === "desktop" ? "active" : ""}`} onClick={() => setDevice("desktop")}><Monitor size={15} /></button>
          <button className={`tv-icon-btn ${device === "tablet" ? "active" : ""}`} onClick={() => setDevice("tablet")}><Tablet size={15} /></button>
          <button className={`tv-icon-btn ${device === "mobile" ? "active" : ""}`} onClick={() => setDevice("mobile")}><Smartphone size={15} /></button>
        </div>
      </div>

      {/* Modals */}
      {showTemplates && (
        <TemplatesModal
          formType={formType}
          onClose={() => setShowTemplates(false)}
          onApply={() => { setTemplateApplied(true); setShowTemplates(false); }}
        />
      )}
      {showImages && (
        <ImageSearchModal
          onClose={() => setShowImages(false)}
          onSelect={(hue) => { setBgImage(hue); setShowImages(false); }}
        />
      )}
      {showRemove && (
        <RemoveFieldModal
          onCancel={() => setShowRemove(false)}
          onConfirm={() => { setEmailRemoved(true); setShowRemove(false); setSelectedEl(null); }}
        />
      )}
      {selectedEl === "column" && !showImages && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2">
          <button className="tv-btn-primary shadow-lg" onClick={() => setShowImages(true)}>Search Background Images</button>
        </div>
      )}
      {showCreated && saved && <FormCreatedModal saved={saved} onClose={onCloseCreated} onViewForm={onPreview} />}
    </div>
  );
}
