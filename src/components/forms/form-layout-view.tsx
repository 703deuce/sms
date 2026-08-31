"use client";

import { FIELD_LABELS, DEFAULT_DISCLOSURE, type FormFieldKey } from "@/lib/forms/types";
import type { FormLayout } from "@/lib/forms/layout";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  layout: FormLayout;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  primaryColor: string;
  submitting?: boolean;
  disabled?: boolean;
};

export function FormLayoutView({
  layout,
  values,
  onChange,
  primaryColor,
  submitting,
  disabled,
}: Props) {
  const formBlocks = layout.blocks.filter((b) => b.type !== "image-column");

  return (
    <div className="space-y-4">
      {formBlocks.map((block) => {
        if (block.props?.hidden) return null;
        switch (block.type) {
          case "header":
            return (
              <h1 key={block.id} className="text-2xl font-semibold tracking-tight text-center">
                {block.props?.content}
              </h1>
            );
          case "text":
            return (
              <p key={block.id} className="text-sm text-muted-foreground text-center">
                {block.props?.content}
              </p>
            );
          case "field-row": {
            const keys = block.props?.fieldKeys || ["firstName", "lastName"];
            return (
              <div key={block.id} className="grid grid-cols-2 gap-3">
                {keys.map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={k}>{FIELD_LABELS[k]}</Label>
                    <Input
                      id={k}
                      value={values[k] || ""}
                      onChange={(e) => onChange(k, e.target.value)}
                      required={k === "phone"}
                    />
                  </div>
                ))}
              </div>
            );
          }
          case "field": {
            const key = (block.props?.fieldKey || "phone") as FormFieldKey;
            return (
              <div key={block.id} className="space-y-1.5">
                <Label htmlFor={key}>{block.props?.placeholder || FIELD_LABELS[key]}</Label>
                <Input
                  id={key}
                  type={key === "email" ? "email" : key === "phone" ? "tel" : key === "dateOfBirth" ? "date" : "text"}
                  value={values[key] || ""}
                  onChange={(e) => onChange(key, e.target.value)}
                  required={key === "phone"}
                />
              </div>
            );
          }
          case "button": {
            const label = block.props?.content || "Subscribe";
            return (
              <Button
                key={block.id}
                type="submit"
                className="w-full"
                style={{ backgroundColor: primaryColor }}
                disabled={submitting || disabled}
              >
                {submitting ? "Submitting…" : label}
              </Button>
            );
          }
          case "compliance":
            return (
              <p key={block.id} className="text-xs text-muted-foreground leading-relaxed">
                {block.props?.content || DEFAULT_DISCLOSURE}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
