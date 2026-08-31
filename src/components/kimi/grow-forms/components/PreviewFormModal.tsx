"use client";
import React, { useState } from "react";
import { MessageCircle } from "lucide-react";
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
      {!submitted ? (
        <div style={{ minHeight: 480 }}>
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
        <div style={{ minHeight: 480 }}>
          <BuilderCanvas layout={previewLayout} view="success" selected={null} onSelect={() => {}} />
        </div>
      )}
    </Modal>
  );
}
