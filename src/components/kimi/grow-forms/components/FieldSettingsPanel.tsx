"use client";
import React, { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { contactFields } from "../mock-data";
import type { BlockStyle } from "@/lib/forms/block-styles";
import type { FormFieldKey } from "@/lib/forms/types";
import { fieldKeyFromLabel, labelFromFieldKey } from "@/lib/forms/layout";

const categories = ["Text", "Size & Spacing", "Border", "Background", "Shadow", "Opacity", "Visibility", "Custom CSS"] as const;

const panelInput =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground transition-shadow focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25";

function PanelGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2.5 p-3">{children}</div>
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-muted-foreground">{children}</label>;
}

function ToggleBtn({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-indigo-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function FieldSettingsPanel({
  kind,
  onBack,
  placeholder,
  setPlaceholder,
  contentValue,
  onContentChange,
  fieldKey,
  onFieldKeyChange,
  required,
  onRequiredChange,
  defaultValue,
  onDefaultValueChange,
  inputMode,
  onInputModeChange,
  style,
  onStyleChange,
  onOpenImages,
  onRemove,
}: {
  kind: "field" | "column" | "header" | "button" | "text" | "compliance" | "link" | "error";
  onBack: () => void;
  placeholder: string;
  setPlaceholder: (v: string) => void;
  contentValue?: string;
  onContentChange?: (v: string) => void;
  fieldKey?: FormFieldKey;
  onFieldKeyChange?: (key: FormFieldKey) => void;
  required?: boolean;
  onRequiredChange?: (v: boolean) => void;
  defaultValue?: string;
  onDefaultValueChange?: (v: string) => void;
  inputMode?: string;
  onInputModeChange?: (v: "standard" | "email" | "phone" | "numeric") => void;
  style?: BlockStyle;
  onStyleChange?: (patch: Partial<BlockStyle>) => void;
  onOpenImages: () => void;
  onRemove: () => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>("Text");
  const title =
    kind === "column"
      ? "Column Settings"
      : kind === "header"
        ? "Header Settings"
        : kind === "button"
          ? "Button Settings"
          : kind === "compliance"
            ? "Compliance Settings"
            : kind === "link"
              ? "Link Settings"
              : kind === "error"
                ? "Error Settings"
                : kind === "text"
                  ? "Text Settings"
                  : "Field Settings";

  const patchStyle = (p: Partial<BlockStyle>) => onStyleChange?.(p);

  const renderCategory = (cat: string) => {
    switch (cat) {
      case "Text":
        return (
          <>
            {(kind === "header" || kind === "button" || kind === "text" || kind === "compliance" || kind === "link" || kind === "error") && (
              <div>
                <PanelLabel>Content</PanelLabel>
                <input value={contentValue ?? ""} onChange={(e) => onContentChange?.(e.target.value)} className={panelInput} />
              </div>
            )}
            <div>
              <PanelLabel>Font</PanelLabel>
              <select
                className={panelInput}
                value={style?.fontFamily || "inherit"}
                onChange={(e) => patchStyle({ fontFamily: e.target.value === "inherit" ? undefined : e.target.value })}
              >
                <option value="inherit">Default</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="DM Sans, sans-serif">DM Sans</option>
                <option value="Cormorant Garamond, serif">Cormorant Garamond</option>
              </select>
            </div>
            <div>
              <PanelLabel>Text Color</PanelLabel>
              <input type="color" value={style?.color || "#ffffff"} onChange={(e) => patchStyle({ color: e.target.value })} className="h-8 w-full cursor-pointer rounded border border-border" />
            </div>
            <div>
              <PanelLabel>Text Size ({style?.fontSize ?? 14}px)</PanelLabel>
              <input type="range" min={8} max={48} value={style?.fontSize ?? 14} onChange={(e) => patchStyle({ fontSize: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => patchStyle({ fontWeight: style?.fontWeight === "bold" ? "normal" : "bold" })} className={`flex-1 rounded border py-1 text-xs font-bold ${style?.fontWeight === "bold" ? "border-indigo-500 bg-indigo-50" : "border-border"}`}>B</button>
              <button type="button" onClick={() => patchStyle({ fontStyle: style?.fontStyle === "italic" ? "normal" : "italic" })} className={`flex-1 rounded border py-1 text-xs italic ${style?.fontStyle === "italic" ? "border-indigo-500 bg-indigo-50" : "border-border"}`}>I</button>
              <button type="button" onClick={() => patchStyle({ textDecoration: style?.textDecoration === "underline" ? undefined : "underline" })} className={`flex-1 rounded border py-1 text-xs underline ${style?.textDecoration === "underline" ? "border-indigo-500 bg-indigo-50" : "border-border"}`}>U</button>
            </div>
            <div>
              <PanelLabel>Alignment</PanelLabel>
              <select className={panelInput} value={style?.textAlign || "center"} onChange={(e) => patchStyle({ textAlign: e.target.value as BlockStyle["textAlign"] })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </>
        );
      case "Size & Spacing":
        return (
          <>
            <div>
              <PanelLabel>Padding ({style?.padding ?? 0}px)</PanelLabel>
              <input type="range" min={0} max={48} value={style?.padding ?? 0} onChange={(e) => patchStyle({ padding: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <PanelLabel>Margin ({style?.margin ?? 0}px)</PanelLabel>
              <input type="range" min={0} max={48} value={style?.margin ?? 0} onChange={(e) => patchStyle({ margin: Number(e.target.value) })} className="w-full" />
            </div>
          </>
        );
      case "Border":
        return (
          <>
            <div>
              <PanelLabel>Border Width ({style?.borderWidth ?? 0}px)</PanelLabel>
              <input type="range" min={0} max={8} value={style?.borderWidth ?? 0} onChange={(e) => patchStyle({ borderWidth: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <PanelLabel>Border Color</PanelLabel>
              <input type="color" value={style?.borderColor || "#e2e8f0"} onChange={(e) => patchStyle({ borderColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border border-border" />
            </div>
            <div>
              <PanelLabel>Border Radius ({style?.borderRadius ?? 0}px)</PanelLabel>
              <input type="range" min={0} max={24} value={style?.borderRadius ?? 0} onChange={(e) => patchStyle({ borderRadius: Number(e.target.value) })} className="w-full" />
            </div>
          </>
        );
      case "Background":
        return (
          <>
            <div>
              <PanelLabel>Background Color</PanelLabel>
              <input type="color" value={style?.backgroundColor || "#000000"} onChange={(e) => patchStyle({ backgroundColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border border-border" />
            </div>
            {kind === "column" && (
              <>
                <div>
                  <PanelLabel>Background Image</PanelLabel>
                  <button onClick={onOpenImages} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                    <Search size={12} /> Search
                  </button>
                </div>
                <div>
                  <PanelLabel>Image Size</PanelLabel>
                  <select className={panelInput} value={style?.backgroundImageSize || "cover"} onChange={(e) => patchStyle({ backgroundImageSize: e.target.value as "cover" | "contain" })}>
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                  </select>
                </div>
                <div>
                  <PanelLabel>Position X ({style?.backgroundImagePositionX ?? 50}%)</PanelLabel>
                  <input type="range" min={0} max={100} value={style?.backgroundImagePositionX ?? 50} onChange={(e) => patchStyle({ backgroundImagePositionX: Number(e.target.value) })} className="w-full" />
                </div>
                <div>
                  <PanelLabel>Position Y ({style?.backgroundImagePositionY ?? 50}%)</PanelLabel>
                  <input type="range" min={0} max={100} value={style?.backgroundImagePositionY ?? 50} onChange={(e) => patchStyle({ backgroundImagePositionY: Number(e.target.value) })} className="w-full" />
                </div>
              </>
            )}
          </>
        );
      case "Shadow":
        return (
          <div>
            <PanelLabel>Box Shadow</PanelLabel>
            <select className={panelInput} value={style?.boxShadow || "none"} onChange={(e) => patchStyle({ boxShadow: e.target.value === "none" ? undefined : e.target.value })}>
              <option value="none">None</option>
              <option value="0 1px 3px rgba(0,0,0,0.12)">Small</option>
              <option value="0 4px 12px rgba(0,0,0,0.15)">Medium</option>
              <option value="0 8px 24px rgba(0,0,0,0.2)">Large</option>
            </select>
          </div>
        );
      case "Opacity":
        return (
          <div>
            <PanelLabel>Opacity ({style?.opacity ?? 100}%)</PanelLabel>
            <input type="range" min={10} max={100} value={style?.opacity ?? 100} onChange={(e) => patchStyle({ opacity: Number(e.target.value) })} className="w-full" />
          </div>
        );
      case "Visibility":
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Hidden on Mobile</span>
              <ToggleBtn on={style?.hiddenOnMobile ?? false} onChange={(v) => patchStyle({ hiddenOnMobile: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Hidden on Desktop</span>
              <ToggleBtn on={style?.hiddenOnDesktop ?? false} onChange={(v) => patchStyle({ hiddenOnDesktop: v })} />
            </div>
          </>
        );
      case "Custom CSS":
        return (
          <div>
            <PanelLabel>Custom CSS (block)</PanelLabel>
            <textarea className={`${panelInput} font-mono text-xs`} rows={3} value={style?.customCss || ""} onChange={(e) => patchStyle({ customCss: e.target.value })} placeholder="color: red;" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline">
        <ArrowLeft size={12} /> Back
      </button>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Expand each settings category to customize this element. Changes appear on the canvas immediately.
      </p>

      {kind === "field" && (
        <PanelGroup title="Field">
          <div>
            <PanelLabel>Contact Field</PanelLabel>
            <select
              className={panelInput}
              value={fieldKey ? labelFromFieldKey(fieldKey) : "Email"}
              onChange={(e) => {
                const key = fieldKeyFromLabel(e.target.value);
                if (key) onFieldKeyChange?.(key);
              }}
            >
              {contactFields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <PanelLabel>Placeholder Text</PanelLabel>
            <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className={panelInput} />
          </div>
          <div>
            <PanelLabel>Default Value</PanelLabel>
            <input value={defaultValue || ""} onChange={(e) => onDefaultValueChange?.(e.target.value)} className={panelInput} />
          </div>
          <div>
            <PanelLabel>Keyboard On Mobile</PanelLabel>
            <select className={panelInput} value={inputMode || "standard"} onChange={(e) => onInputModeChange?.(e.target.value as "standard" | "email" | "phone" | "numeric")}>
              <option value="standard">Standard</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="numeric">Numeric</option>
            </select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-medium text-muted-foreground">Required</span>
            <ToggleBtn on={required ?? false} onChange={(v) => onRequiredChange?.(v)} />
          </div>
        </PanelGroup>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {categories.map((c) => (
          <div key={c}>
            <button
              type="button"
              onClick={() => setOpenCat(openCat === c ? null : c)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              {c}
              {openCat === c ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />}
            </button>
            {openCat === c && <div className="border-t border-border bg-muted/20 px-3 py-3">{renderCategory(c)}</div>}
          </div>
        ))}
      </div>

      {kind === "field" && (
        <button onClick={onRemove} className="w-full rounded-md border border-red-200 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
          Remove Field
        </button>
      )}
    </div>
  );
}
