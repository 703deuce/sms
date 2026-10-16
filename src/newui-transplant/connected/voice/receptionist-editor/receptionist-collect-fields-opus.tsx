"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  isCollectFieldEnabled,
  patchCollectFieldEnabled,
  patchCollectFieldRequired,
  requiredCollectFieldIds,
} from "@/lib/solutions/appointment-receptionist/collect-fields-ui";
import { FieldRow } from "@/newui-transplant/components/app/kit";
import { OpusTableShell } from "@/components/solutions/appointment-receptionist/wizard-opus-ui";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
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

export function ReceptionistCollectFieldsOpus({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const selected =
    state.appointmentTypes.find((t) => t.id === state.selectedAppointmentTypeId) ||
    state.appointmentTypes[0];

  function syncRequiredFieldsOnType(
    fields: AppointmentReceptionistWizardState["collectFields"],
  ) {
    if (!selected) return;
    const ids = requiredCollectFieldIds(fields);
    patch({
      appointmentTypes: state.appointmentTypes.map((t) =>
        t.id === selected.id ? { ...t, requiredFields: ids } : t,
      ),
    });
  }

  function moveField(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= state.collectFields.length) return;
    const copy = [...state.collectFields];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    patch({ collectFields: copy });
  }

  return (
    <div className="space-y-4">
      <FieldRow
        label="Qualify callers before booking"
        description="Use ZIP or custom rules when enabled."
      >
        <Switch
          checked={state.qualificationEnabled === true}
          onCheckedChange={(on) =>
            patch({
              qualificationEnabled: on,
              capabilities: on
                ? [...new Set([...state.capabilities, "qualify_callers"])]
                : state.capabilities.filter((c) => c !== "qualify_callers"),
            })
          }
          aria-label="Qualify callers before booking"
        />
      </FieldRow>

      <OpusTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">On</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="w-24">Required</TableHead>
              <TableHead className="w-28 text-right">Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.collectFields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell>
                  <Checkbox
                    checked={isCollectFieldEnabled(field)}
                    onCheckedChange={(checked) => {
                      const next = patchCollectFieldEnabled(
                        state.collectFields,
                        index,
                        checked === true,
                      );
                      patch({ collectFields: next });
                      syncRequiredFieldsOnType(next);
                    }}
                    aria-label={`Enable ${field.label}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={field.label}
                    onChange={(e) => {
                      const next = state.collectFields.map((f, i) =>
                        i === index ? { ...f, label: e.target.value } : f,
                      );
                      patch({ collectFields: next });
                    }}
                    aria-label="Field label"
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={Boolean(field.required)}
                    onCheckedChange={(checked) => {
                      const next = patchCollectFieldRequired(
                        state.collectFields,
                        index,
                        checked === true,
                      );
                      patch({ collectFields: next });
                      syncRequiredFieldsOnType(next);
                    }}
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
                      disabled={index === state.collectFields.length - 1}
                      onClick={() => moveField(index, 1)}
                      aria-label={`Move ${field.label} down`}
                    >
                      <ChevronDown />
                    </Button>
                    {!["full_name", "phone", "service"].includes(field.id) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          patch({
                            collectFields: state.collectFields.filter((_, i) => i !== index),
                          });
                        }}
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

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="receptionist-new-collect-field-opus">New field label</Label>
          <Input id="receptionist-new-collect-field-opus" placeholder="e.g. ZIP code" className="mt-1" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const input = document.getElementById(
              "receptionist-new-collect-field-opus",
            ) as HTMLInputElement | null;
            const label = input?.value.trim();
            if (!label || !input) return;
            const id = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
            patch({
              collectFields: [
                ...state.collectFields,
                { id, label, required: true, enabled: true },
              ],
            });
            input.value = "";
          }}
        >
          <Plus />
          Add field
        </Button>
      </div>
    </div>
  );
}
