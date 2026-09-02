"use client";
import React, { useEffect, useState } from "react";
import { GripVertical, MessageCircle } from "lucide-react";
import { FIELD_LABELS, DEFAULT_DISCLOSURE, type FormFieldKey } from "@/lib/forms/types";
import type { FormBlock, FormLayout } from "@/lib/forms/layout";
import {
  DEFAULT_SUCCESS_HEADLINE,
  DEFAULT_SUCCESS_MESSAGE,
  FORM_DND_BLOCK,
  FORM_DND_PALETTE,
  formCanvasBlocks,
} from "@/lib/forms/layout";
import { blockStyleToCss } from "@/lib/forms/block-styles";

const FIELD_PLACEHOLDERS: Record<FormFieldKey, string> = {
  phone: "Mobile Number",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  dateOfBirth: "Date of birth",
};

function BlockShell({
  id,
  tag,
  selected,
  selectedId,
  onSelect,
  className = "",
  style,
  device,
  children,
}: {
  id: string;
  tag?: string;
  selected: string | null;
  selectedId: string;
  onSelect: (id: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
  device?: "desktop" | "tablet" | "mobile";
  children: React.ReactNode;
}) {
  const isSel = selected === selectedId;
  const hidden =
    (device === "mobile" && style && "display" in style && style.display === "none") ||
    (device === "desktop" && style && "display" in style && style.display === "none");
  if (hidden) return null;

  return (
    <div
      data-tag={tag}
      data-block-id={id}
      className={`relative cursor-pointer rounded transition-shadow ${className}`}
      style={{ ...style, outline: isSel ? "2px solid #6366f1" : undefined, outlineOffset: 3 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selectedId);
      }}
    >
      {isSel && tag ? <span className="tv-block-tag">{tag}</span> : null}
      {children}
    </div>
  );
}

function blockCss(block: FormBlock, device?: "desktop" | "tablet" | "mobile") {
  return blockStyleToCss(block.props?.style, device);
}

function DropZone({
  index,
  active,
  highlighted,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  index: number;
  active: boolean;
  highlighted: boolean;
  onDragOver: (index: number, e: React.DragEvent) => void;
  onDragLeave: (index: number) => void;
  onDrop: (index: number, e: React.DragEvent) => void;
}) {
  if (!active) return null;

  return (
    <div
      className={`tv-drop-zone ${highlighted ? "tv-drop-zone-active" : ""}`}
      onDragOver={(e) => onDragOver(index, e)}
      onDragLeave={() => onDragLeave(index)}
      onDrop={(e) => onDrop(index, e)}
    >
      {highlighted ? <div className="tv-drop-indicator" /> : null}
    </div>
  );
}

function renderBlock(
  block: FormBlock,
  selected: string | null,
  onSelect: (id: string | null) => void,
  formType: "landing" | "embed",
  device?: "desktop" | "tablet" | "mobile",
) {
  if (block.props?.hidden) return null;
  const css = blockCss(block, device);

  switch (block.type) {
    case "header":
      return (
        <BlockShell key={block.id} id={block.id} tag="Header" selected={selected} selectedId={block.id} onSelect={onSelect} className="text-center text-2xl font-semibold tracking-tight" style={css} device={device}>
          <h2 style={{ fontFamily: block.props?.style?.fontFamily || "Georgia, serif", margin: 0, ...css }}>{block.props?.content || "Headline"}</h2>
        </BlockShell>
      );
    case "text":
      return (
        <BlockShell key={block.id} id={block.id} tag="Text" selected={selected} selectedId={block.id} onSelect={onSelect} className="text-center text-xs leading-relaxed text-slate-300" style={css} device={device}>
          <p style={{ margin: 0, ...css }}>{block.props?.content || ""}</p>
        </BlockShell>
      );
    case "link":
      return (
        <BlockShell key={block.id} id={block.id} tag="Link" selected={selected} selectedId={block.id} onSelect={onSelect} className="text-center text-xs" style={css} device={device}>
          <span style={{ ...css, cursor: "pointer" }}>{block.props?.content || "Link"}</span>
        </BlockShell>
      );
    case "error":
      return (
        <BlockShell key={block.id} id={block.id} tag="Error" selected={selected} selectedId={block.id} onSelect={onSelect} className="text-center text-xs text-red-400" style={css} device={device}>
          <p style={{ margin: 0, ...css }}>{block.props?.content || "Error"}</p>
        </BlockShell>
      );
    case "field-row": {
      const keys = block.props?.fieldKeys || ["firstName", "lastName"];
      return (
        <BlockShell key={block.id} id={block.id} tag="Field Row" selected={selected} selectedId={block.id} onSelect={onSelect} className="flex gap-2" style={css} device={device}>
          {keys.map((k) => (
            <div key={k} className="tv-input-mock flex-1" style={css}>
              {block.props?.placeholder || FIELD_PLACEHOLDERS[k] || FIELD_LABELS[k]}
            </div>
          ))}
        </BlockShell>
      );
    }
    case "field": {
      const key = block.props?.fieldKey || "phone";
      return (
        <BlockShell key={block.id} id={block.id} tag="Field" selected={selected} selectedId={block.id} onSelect={onSelect} className="tv-input-mock" style={css} device={device}>
          {block.props?.placeholder || FIELD_PLACEHOLDERS[key] || FIELD_LABELS[key]}
          {block.props?.required ? " *" : ""}
        </BlockShell>
      );
    }
    case "button": {
      const btnStyle: React.CSSProperties = {
        ...css,
        backgroundColor: block.props?.style?.backgroundColor || (formType === "embed" ? "#f8fafc" : "#4f46e5"),
        color: block.props?.style?.color || (formType === "embed" ? "#0f172a" : "#ffffff"),
      };
      return (
        <BlockShell key={block.id} id={block.id} tag="Button" selected={selected} selectedId={block.id} onSelect={onSelect} className={`tv-btn-mock ${formType === "embed" ? "tv-dark-btn text-black" : ""}`} style={btnStyle} device={device}>
          {block.props?.content || "Submit"}
        </BlockShell>
      );
    }
    case "compliance":
      return (
        <BlockShell key={block.id} id={block.id} tag="Compliance" selected={selected} selectedId={block.id} onSelect={onSelect} className="text-[9px] leading-snug text-slate-400" style={css} device={device}>
          <p style={{ margin: 0, ...css }}>{block.props?.content || DEFAULT_DISCLOSURE}</p>
        </BlockShell>
      );
    case "image-column":
      return null;
    default:
      return null;
  }
}

function FormBlocksCanvas({
  layout,
  selected,
  onSelect,
  device,
  onInsertPalette,
  onMoveBlock,
}: {
  layout: FormLayout;
  selected: string | null;
  onSelect: (id: string | null) => void;
  device?: "desktop" | "tablet" | "mobile";
  onInsertPalette?: (elementId: string, index: number) => void;
  onMoveBlock?: (blockId: string, index: number) => void;
}) {
  const formBlocks = formCanvasBlocks(layout);
  const [dragActive, setDragActive] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

  const endDrag = () => {
    setDragActive(false);
    setDropIndex(null);
    setDraggingBlockId(null);
  };

  useEffect(() => {
    const onWindowDragEnd = () => endDrag();
    window.addEventListener("dragend", onWindowDragEnd);
    return () => window.removeEventListener("dragend", onWindowDragEnd);
  }, []);

  const hasDndPayload = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(FORM_DND_PALETTE) || e.dataTransfer.types.includes(FORM_DND_BLOCK);

  const handleDragOver = (index: number, e: React.DragEvent) => {
    if (!hasDndPayload(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(FORM_DND_BLOCK) ? "move" : "copy";
    setDragActive(true);
    setDropIndex(index);
  };

  const handleDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const paletteId = e.dataTransfer.getData(FORM_DND_PALETTE);
    const blockId = e.dataTransfer.getData(FORM_DND_BLOCK);
    if (paletteId) {
      onInsertPalette?.(paletteId, index);
    } else if (blockId) {
      onMoveBlock?.(blockId, index);
    }
    endDrag();
  };

  return (
    <div
      className="tv-canvas-blocks"
      onDragEnter={(e) => {
        if (hasDndPayload(e)) setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) endDrag();
      }}
    >
      {formBlocks.map((block, index) => {
        const node = renderBlock(block, selected, onSelect, layout.formType, device);
        if (!node) return null;

        return (
          <React.Fragment key={block.id}>
            <DropZone
              index={index}
              active={dragActive}
              highlighted={dropIndex === index}
              onDragOver={handleDragOver}
              onDragLeave={(i) => setDropIndex((prev) => (prev === i ? null : prev))}
              onDrop={handleDrop}
            />
            <div className={`tv-block-row group ${draggingBlockId === block.id ? "tv-block-row-dragging" : ""}`}>
              <button
                type="button"
                className="tv-block-drag-handle"
                draggable
                aria-label={`Drag ${block.type} block`}
                onDragStart={(e) => {
                  e.dataTransfer.setData(FORM_DND_BLOCK, block.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingBlockId(block.id);
                  setDragActive(true);
                }}
                onDragEnd={endDrag}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical size={12} />
              </button>
              <div className="min-w-0 flex-1">{node}</div>
            </div>
          </React.Fragment>
        );
      })}
      <DropZone
        index={formBlocks.length}
        active={dragActive}
        highlighted={dropIndex === formBlocks.length}
        onDragOver={handleDragOver}
        onDragLeave={(i) => setDropIndex((prev) => (prev === i ? null : prev))}
        onDrop={handleDrop}
      />
    </div>
  );
}

export default function BuilderCanvas({
  layout,
  view,
  selected,
  onSelect,
  device = "desktop",
  onInsertPalette,
  onMoveBlock,
}: {
  layout: FormLayout;
  view: "form" | "success";
  selected: string | null;
  onSelect: (id: string | null) => void;
  device?: "desktop" | "tablet" | "mobile";
  onInsertPalette?: (elementId: string, index: number) => void;
  onMoveBlock?: (blockId: string, index: number) => void;
}) {
  const imageBlock = layout.blocks.find((b) => b.type === "image-column");
  const imageHue = imageBlock?.props?.imageHue ?? layout.imageHue;
  const colStyle = blockCss(imageBlock || { id: "col", type: "image-column" }, device);

  const inner =
    view === "success" ? (
      <div className="tv-success-view" onClick={(e) => { e.stopPropagation(); onSelect(null); }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
          <MessageCircle size={24} className="text-slate-200" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{layout.successHeadline || DEFAULT_SUCCESS_HEADLINE}</h2>
        <p className="max-w-[260px] text-xs leading-relaxed text-slate-300">{layout.successMessage || DEFAULT_SUCCESS_MESSAGE}</p>
      </div>
    ) : (
      <FormBlocksCanvas
        layout={layout}
        selected={selected}
        onSelect={onSelect}
        device={device}
        onInsertPalette={onInsertPalette}
        onMoveBlock={onMoveBlock}
      />
    );

  if (layout.formType === "embed") {
    return (
      <div className="tv-embed-preview mx-auto w-full max-w-[560px]" onClick={() => onSelect(null)}>
        {inner}
      </div>
    );
  }

  const imgPosX = imageBlock?.props?.style?.backgroundImagePositionX ?? 50;
  const imgPosY = imageBlock?.props?.style?.backgroundImagePositionY ?? 50;
  const imgSize = imageBlock?.props?.style?.backgroundImageSize || "cover";

  return (
    <div className="tv-landing-preview mx-auto w-full max-w-[720px]" onClick={() => onSelect(null)}>
      <div className="tv-landing-form">{inner}</div>
      {view === "form" && (
        <div
          className="tv-landing-img cursor-pointer"
          data-tag="Column"
          style={{
            background: imageHue ? `linear-gradient(160deg, ${imageHue}, #1f2937)` : imageBlock?.props?.style?.backgroundColor || undefined,
            backgroundSize: imgSize,
            backgroundPosition: `${imgPosX}% ${imgPosY}%`,
            ...colStyle,
            outline: selected === imageBlock?.id ? "2px solid #6366f1" : undefined,
            outlineOffset: -2,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (imageBlock) onSelect(imageBlock.id);
          }}
        >
          {selected === imageBlock?.id ? <span className="tv-block-tag" style={{ top: 8, left: 8 }}>Column</span> : null}
        </div>
      )}
    </div>
  );
}
