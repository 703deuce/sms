"use client";

import { Button } from "@/components/ui/button";
import type { RealtorIntentConfig } from "@/lib/realtor/types";
import {
  addCustomIntentField,
  mergeIntentFieldToggles,
  updateIntentFieldToggle,
} from "@/lib/realtor/field-editor";
import type { RealEstateIntent } from "@/lib/voice/real-estate/types";
import { useState } from "react";

type Props = {
  intent: RealEstateIntent;
  title: string;
  config: RealtorIntentConfig;
  onChange: (next: RealtorIntentConfig) => void;
  showOutcome?: boolean;
};

const OUTCOMES = [
  { value: "book", label: "Book appointment" },
  { value: "transfer", label: "Transfer" },
  { value: "notify", label: "Notify realtor" },
  { value: "message", label: "Take message" },
] as const;

export function IntentFieldEditor({ intent, title, config, onChange, showOutcome = true }: Props) {
  const fields = mergeIntentFieldToggles(intent, config);
  const [customId, setCustomId] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        {showOutcome ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">When qualified:</span>
            <select
              className="rounded-md border px-2 py-1"
              value={config.qualifiedOutcome}
              onChange={(e) =>
                onChange({
                  ...config,
                  qualifiedOutcome: e.target.value as RealtorIntentConfig["qualifiedOutcome"],
                })
              }
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">On</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Required</th>
              <th className="px-3 py-2">Question</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.fieldId} className="border-t">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={(e) =>
                      onChange(updateIntentFieldToggle(config, field.fieldId, { enabled: e.target.checked }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full min-w-[120px] rounded border px-2 py-1"
                    value={field.label || field.fieldId}
                    onChange={(e) =>
                      onChange(updateIntentFieldToggle(config, field.fieldId, { label: e.target.value }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={!field.enabled}
                    onChange={(e) =>
                      onChange(
                        updateIntentFieldToggle(config, field.fieldId, { required: e.target.checked }),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full min-w-[200px] rounded border px-2 py-1"
                    placeholder="Spoken question (optional)"
                    value={field.question || ""}
                    onChange={(e) =>
                      onChange(
                        updateIntentFieldToggle(config, field.fieldId, { question: e.target.value }),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="custom_field_id"
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
        />
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="Label (e.g. Garage required)"
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!customId.trim()) return;
            onChange(addCustomIntentField(config, { fieldId: customId, label: customLabel || customId }));
            setCustomId("");
            setCustomLabel("");
          }}
        >
          Add custom field
        </Button>
      </div>
    </div>
  );
}
