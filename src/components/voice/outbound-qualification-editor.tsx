"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createDefaultQualificationDefinition } from "@/lib/voice/outbound/default-qualification-definition";
import type { QualificationDefinition, QualificationFieldDefinition } from "@/lib/voice/outbound/types";
import { useMemo } from "react";

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values?: string[]): string {
  return (values || []).join("\n");
}

type Props = {
  businessName: string;
  value: QualificationDefinition | null;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (value: QualificationDefinition) => void;
};

export function OutboundQualificationEditor({
  businessName,
  value,
  enabled,
  onEnabledChange,
  onChange,
}: Props) {
  const qual = useMemo(
    () => value || createDefaultQualificationDefinition({ businessName }),
    [value, businessName],
  );

  function patch(partial: Partial<QualificationDefinition>) {
    onChange({ ...qual, ...partial });
  }

  function patchBusiness(partial: Partial<NonNullable<QualificationDefinition["business"]>>) {
    patch({
      business: {
        name: qual.business?.name || qual.businessName,
        description: qual.business?.description || "",
        ...qual.business,
        ...partial,
      },
    });
  }

  function patchCampaign(partial: Partial<NonNullable<QualificationDefinition["campaign"]>>) {
    patch({
      campaign: {
        type: qual.campaign?.type || "new_lead_follow_up",
        reasonForContact: qual.campaign?.reasonForContact || qual.reasonForContact,
        callerExplanation: qual.campaign?.callerExplanation || qual.reasonForContact,
        ...qual.campaign,
        ...partial,
      },
    });
  }

  function updateField(index: number, partial: Partial<QualificationFieldDefinition>) {
    const fields = [...qual.fields];
    fields[index] = { ...fields[index], ...partial };
    patch({ fields });
  }

  function addField() {
    const id = `field_${qual.fields.length + 1}`;
    patch({
      fields: [
        ...qual.fields,
        {
          field_id: id,
          label: "New field",
          type: "text",
          required: false,
          collection_instruction: "Describe what to collect.",
        },
      ],
    });
  }

  function removeField(index: number) {
    patch({ fields: qual.fields.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Enable LiveKit outbound lead qualification
      </label>

      {!enabled ? (
        <p className="text-sm text-muted-foreground">
          Turn this on to configure a warm outbound qualification agent powered by the voice runtime.
        </p>
      ) : (
        <>
          <Card className="space-y-3 p-4">
            <CardTitle className="text-base">Identity & scripts</CardTitle>
            <div>
              <Label>Business name</Label>
              <Input value={qual.businessName} onChange={(e) => patch({ businessName: e.target.value })} />
            </div>
            <div>
              <Label>Agent display name</Label>
              <Input
                value={qual.agentDisplayName || ""}
                onChange={(e) => patch({ agentDisplayName: e.target.value })}
              />
            </div>
            <div>
              <Label>Reason for contact</Label>
              <Textarea
                rows={2}
                value={qual.reasonForContact}
                onChange={(e) => patch({ reasonForContact: e.target.value })}
              />
            </div>
            <div>
              <Label>Intro template</Label>
              <Textarea
                rows={3}
                value={qual.introTemplate || ""}
                onChange={(e) => patch({ introTemplate: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Variables: {"{leadName}"}, {"{businessName}"}, {"{reason}"}, {"{agentDisplayName}"}
              </p>
            </div>
            <div>
              <Label>Close template</Label>
              <Textarea
                rows={2}
                value={qual.closeTemplate || ""}
                onChange={(e) => patch({ closeTemplate: e.target.value })}
              />
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <CardTitle className="text-base">Business context</CardTitle>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={qual.business?.description || ""}
                onChange={(e) => patchBusiness({ description: e.target.value })}
              />
            </div>
            <div>
              <Label>Services (one per line)</Label>
              <Textarea
                rows={3}
                value={listToLines(qual.business?.services)}
                onChange={(e) => patchBusiness({ services: linesToList(e.target.value) })}
              />
            </div>
            <div>
              <Label>Service areas (one per line)</Label>
              <Textarea
                rows={3}
                value={listToLines(qual.business?.serviceAreas)}
                onChange={(e) => patchBusiness({ serviceAreas: linesToList(e.target.value) })}
              />
            </div>
            <div>
              <Label>Knowledge notes (one per line)</Label>
              <Textarea
                rows={4}
                value={listToLines(qual.business?.knowledgeNotes)}
                onChange={(e) => patchBusiness({ knowledgeNotes: linesToList(e.target.value) })}
              />
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <CardTitle className="text-base">Campaign</CardTitle>
            <div>
              <Label>Campaign type</Label>
              <Input
                value={qual.campaign?.type || ""}
                onChange={(e) => patchCampaign({ type: e.target.value })}
              />
            </div>
            <div>
              <Label>Caller explanation</Label>
              <Textarea
                rows={2}
                value={qual.campaign?.callerExplanation || ""}
                onChange={(e) => patchCampaign({ callerExplanation: e.target.value })}
              />
            </div>
            <div>
              <Label>Established intent (optional)</Label>
              <Input
                value={qual.campaign?.establishedIntent || ""}
                onChange={(e) => patchCampaign({ establishedIntent: e.target.value })}
              />
            </div>
            <div>
              <Label>Skip field ids (comma-separated)</Label>
              <Input
                value={(qual.campaign?.skipFieldIds || []).join(", ")}
                onChange={(e) =>
                  patchCampaign({
                    skipFieldIds: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Qualification fields</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                Add field
              </Button>
            </div>
            {qual.fields.map((field, index) => (
              <div key={`${field.field_id}-${index}`} className="space-y-2 rounded-lg border border-border p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label>Field id</Label>
                    <Input
                      value={field.field_id}
                      onChange={(e) => updateField(index, { field_id: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Label</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Collection instruction</Label>
                  <Textarea
                    rows={2}
                    value={field.collection_instruction}
                    onChange={(e) => updateField(index, { collection_instruction: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                  />
                  Required
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeField(index)}>
                  Remove field
                </Button>
              </div>
            ))}
          </Card>

          <Card className="space-y-3 p-4">
            <CardTitle className="text-base">Guardrails</CardTitle>
            <div>
              <Label>Authority boundaries (one per line)</Label>
              <Textarea
                rows={4}
                value={listToLines(qual.authorityBoundaries)}
                onChange={(e) => patch({ authorityBoundaries: linesToList(e.target.value) })}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
