"use client";
import React from "react";
import { MessageCircle } from "lucide-react";
import { FIELD_LABELS, DEFAULT_DISCLOSURE, type FormFieldKey } from "@/lib/forms/types";
import type { FormBlock, FormLayout } from "@/lib/forms/layout";
import { DEFAULT_SUCCESS_HEADLINE, DEFAULT_SUCCESS_MESSAGE } from "@/lib/forms/layout";

const FIELD_PLACEHOLDERS: Record<FormFieldKey, string> = {
  phone: "Mobile Number",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  dateOfBirth: "Date of birth",
};

function selClass(selected: boolean) {
  return selected ? "tv-selected" : "";
}

function BlockShell({
  id,
  tag,
  selected,
  selectedId,
  onSelect,
  className = "",
  children,
}: {
  id: string;
  tag?: string;
  selected: string | null;
  selectedId: string;
  onSelect: (id: string | null) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isSel = selected === selectedId;
  return (
    <div
      data-tag={tag}
      data-block-id={id}
      className={`cursor-pointer rounded transition-shadow ${className} ${selClass(isSel)}`}
      style={{ outline: isSel ? "2px solid #6366f1" : undefined, outlineOffset: 4 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selectedId);
      }}
    >
      {children}
    </div>
  );
}

function renderBlock(
  block: FormBlock,
  selected: string | null,
  onSelect: (id: string | null) => void,
  formType: "landing" | "embed",
) {
  if (block.props?.hidden) return null;

  switch (block.type) {
    case "header":
      return (
        <BlockShell
          key={block.id}
          id={block.id}
          tag="Header"
          selected={selected}
          selectedId={block.id}
          onSelect={onSelect}
          className="text-center text-2xl font-semibold tracking-tight"
        >
          <h2 style={{ fontFamily: "Georgia, serif" }}>{block.props?.content || "Headline"}</h2>
        </BlockShell>
      );
    case "text":
      return (
        <BlockShell
          key={block.id}
          id={block.id}
          tag="Text"
          selected={selected}
          selectedId={block.id}
          onSelect={onSelect}
          className="text-center text-xs leading-relaxed text-slate-300"
        >
          <p>{block.props?.content || ""}</p>
        </BlockShell>
      );
    case "field-row": {
      const keys = block.props?.fieldKeys || ["firstName", "lastName"];
      return (
        <BlockShell
          key={block.id}
          id={block.id}
          tag="Field Row"
          selected={selected}
          selectedId={block.id}
          onSelect={onSelect}
          className="flex gap-2"
        >
          {keys.map((k) => (
            <div key={k} className="tv-input-mock flex-1">
              {block.props?.placeholder || FIELD_PLACEHOLDERS[k] || FIELD_LABELS[k]}
            </div>
          ))}
        </BlockShell>
      );
    }
    case "field": {
      const key = block.props?.fieldKey || "phone";
      return (
        <BlockShell
          key={block.id}
          id={block.id}
          tag="Field"
          selected={selected}
          selectedId={block.id}
          onSelect={onSelect}
          className="tv-input-mock"
        >
          {block.props?.placeholder || FIELD_PLACEHOLDERS[key] || FIELD_LABELS[key]}
        </BlockShell>
      );
    }
    case "button":
      return (
        <BlockShell
          key={block.id}
          id={block.id}
          tag="Button"
          selected={selected}
          selectedId={block.id}
          onSelect={onSelect}
          className={`tv-btn-mock ${formType === "embed" ? "tv-dark-btn text-black" : ""}`}
        >
          {block.props?.content || "Submit"}
        </BlockShell>
      );
    case "compliance":
      return (
        <p key={block.id} className="text-[9px] leading-snug text-slate-400">
          {block.props?.content || DEFAULT_DISCLOSURE}
        </p>
      );
    case "image-column":
      return null;
    default:
      return null;
  }
}

export default function BuilderCanvas({
  layout,
  view,
  selected,
  onSelect,
}: {
  layout: FormLayout;
  view: "form" | "success";
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const formBlocks = layout.blocks.filter((b) => b.type !== "image-column");
  const imageBlock = layout.blocks.find((b) => b.type === "image-column");
  const imageHue = imageBlock?.props?.imageHue ?? layout.imageHue;

  const inner =
    view === "success" ? (
      <div
        className="tv-success-view"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(null);
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
          <MessageCircle size={24} className="text-slate-200" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {layout.successHeadline || DEFAULT_SUCCESS_HEADLINE}
        </h2>
        <p className="max-w-[260px] text-xs leading-relaxed text-slate-300">
          {layout.successMessage || DEFAULT_SUCCESS_MESSAGE}
        </p>
      </div>
    ) : (
      <>{formBlocks.map((b) => renderBlock(b, selected, onSelect, layout.formType))}</>
    );

  if (layout.formType === "embed") {
    return (
      <div className="tv-embed-preview mx-auto w-full max-w-[560px]" onClick={() => onSelect(null)}>
        {inner}
      </div>
    );
  }

  return (
    <div className="tv-landing-preview mx-auto w-full max-w-[720px]" onClick={() => onSelect(null)}>
      <div className="tv-landing-form">{inner}</div>
      {view === "form" && (
        <div
          className="tv-landing-img cursor-pointer"
          data-tag="Column"
          style={{
            background: imageHue ? `linear-gradient(160deg, ${imageHue}, #1f2937)` : undefined,
            outline: selected === imageBlock?.id ? "2px solid #6366f1" : undefined,
            outlineOffset: -2,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (imageBlock) onSelect(imageBlock.id);
          }}
        />
      )}
    </div>
  );
}
