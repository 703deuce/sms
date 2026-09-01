"use client";
import React, { useState } from "react";
import { Modal } from "./ui";
import BuilderCanvas from "./BuilderCanvas";
import type { FormLayout } from "@/lib/forms/layout";

export default function PreviewFormModal({
  open,
  onClose,
  layout,
}: {
  open: boolean;
  onClose: () => void;
  layout: FormLayout;
}) {
  const [submitted, setSubmitted] = useState(false);
  const previewLayout: FormLayout = submitted
    ? { ...layout, blocks: [] }
    : layout;

  return (
    <Modal open={open} onClose={() => { setSubmitted(false); onClose(); }} width={860}>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between pr-8">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
              {submitted ? "Success View" : "Form Preview"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {submitted
                ? "This is what subscribers see after submitting."
                : "Submit the form to preview the success view."}
            </p>
          </div>
          {!submitted && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              Live Preview
            </span>
          )}
        </div>
        {!submitted ? (
          <div style={{ minHeight: 440 }}>
            <BuilderCanvas layout={layout} view="form" selected={null} onSelect={() => {}} />
            <div className="mt-4 flex justify-center">
              <button
                className="tv-btn-mock"
                onClick={() => setSubmitted(true)}
              >
                {layout.blocks.find((b) => b.type === "button")?.props?.content || "Submit"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ minHeight: 440 }}>
            <BuilderCanvas layout={previewLayout} view="success" selected={null} onSelect={() => {}} />
          </div>
        )}
      </div>
    </Modal>
  );
}
