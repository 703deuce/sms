"use client";

import type { MctbSmsCollectFieldDef } from "@/lib/mctb/lead-recovery/types";
import { FieldRow } from "@/newui-transplant/components/app/kit";
import { OpusTableShell } from "@/components/solutions/appointment-receptionist/wizard-opus-ui";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { Input } from "@/newui-transplant/components/ui/input";
import { Switch } from "@/newui-transplant/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { newCustomSmsCollectField } from "@/lib/mctb/ai-recovery/collect-field-schema";

export function LrCollectFieldsOpus({
  fields,
  onChange,
  allowDynamic,
  onAllowDynamicChange,
}: {
  fields: MctbSmsCollectFieldDef[];
  onChange: (next: MctbSmsCollectFieldDef[]) => void;
  allowDynamic: boolean;
  onAllowDynamicChange: (value: boolean) => void;
}) {
  function moveField(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= fields.length) return;
    const copy = [...fields];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    onChange(copy.map((f, i) => ({ ...f, sortOrder: i + 1 })));
  }

  function patchRow(index: number, patch: Partial<MctbSmsCollectFieldDef>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  return (
    <div className="space-y-4">
      <FieldRow
        label="Allow other clarifying questions"
        description="When needed, the agent can ask a one-off question that is not listed below (for example a detail the customer mentioned)."
      >
        <Switch
          checked={allowDynamic}
          onCheckedChange={onAllowDynamicChange}
          aria-label="Allow dynamic clarifying questions"
        />
      </FieldRow>

      <OpusTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">On</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Question to ask</TableHead>
              <TableHead className="w-20">Required</TableHead>
              <TableHead className="w-28 text-right">Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell>
                  <Checkbox
                    checked={field.enabled}
                    onCheckedChange={() => patchRow(index, { enabled: !field.enabled })}
                    aria-label={`Enable ${field.label}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={field.label}
                    disabled={field.source === "builtin"}
                    onChange={(e) => patchRow(index, { label: e.target.value })}
                    aria-label={`Label for ${field.label}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={field.prompt}
                    onChange={(e) => patchRow(index, { prompt: e.target.value })}
                    aria-label={`Question for ${field.label}`}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={field.required}
                    onCheckedChange={() => patchRow(index, { required: !field.required })}
                    aria-label={`Required ${field.label}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === 0}
                      onClick={() => moveField(index, -1)}
                      aria-label={`Move ${field.label} up`}
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === fields.length - 1}
                      onClick={() => moveField(index, 1)}
                      aria-label={`Move ${field.label} down`}
                    >
                      <ChevronDown />
                    </Button>
                    {field.source === "custom" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onChange(fields.filter((_, i) => i !== index))}
                        aria-label={`Remove ${field.label}`}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </OpusTableShell>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const label = "Custom question";
          onChange([
            ...fields,
            newCustomSmsCollectField(label, fields.length + 1),
          ]);
        }}
      >
        <Plus className="mr-1 size-4" aria-hidden />
        Add custom question
      </Button>
    </div>
  );
}
