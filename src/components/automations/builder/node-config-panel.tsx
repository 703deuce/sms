"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { MERGE_VARIABLES } from "@/lib/automations/catalog";
import type { AutomationCanvasNode } from "@/lib/automations/types";
import { X } from "lucide-react";

const CONDITION_FIELDS = [
  { value: "review_received", label: "Review received" },
  { value: "customer_replied", label: "Customer replied" },
  { value: "link_clicked", label: "Link clicked" },
  { value: "tag_has", label: "Has tag" },
];

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "exists", label: "Exists" },
  { value: "not_exists", label: "Does not exist" },
];

export function NodeConfigPanel({
  node,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
}: {
  node: AutomationCanvasNode;
  onUpdate: (patch: Partial<AutomationCanvasNode["data"]>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const cfg = node.data.config || {};
  const block = node.data.blockType;

  function insertVariable(key: string) {
    if (block !== "send_sms" && block !== "send_review_request") return;
    const body = String(cfg.body || "") + key;
    onUpdate({ config: { ...cfg, body } });
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{node.data.label}</p>
          <p className="text-xs text-muted-foreground">Configure this step</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(block === "send_sms" || block === "send_review_request") && (
          <>
            <div>
              <Label htmlFor="sms-body">Message body</Label>
              <Textarea
                id="sms-body"
                rows={5}
                value={String(cfg.body || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, body: e.target.value } })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {String(cfg.body || "").length} chars · ~
                {Math.ceil(String(cfg.body || "").length / 160) || 1} segment(s)
              </p>
            </div>
            <div>
              <Label className="text-xs">Insert variable</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {MERGE_VARIABLES.map((v) => (
                  <Button key={v.key} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertVariable(v.key)}>
                    {v.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="stop-on-reply"
                checked={Boolean(cfg.stopOnReply)}
                onChange={(e) => onUpdate({ config: { ...cfg, stopOnReply: e.target.checked } })}
              />
              <Label htmlFor="stop-on-reply" className="text-sm">Stop on reply</Label>
            </div>
          </>
        )}

        {block === "wait" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Days</Label>
              <Input
                type="number"
                min={0}
                value={Number(cfg.days || 0)}
                onChange={(e) => onUpdate({ config: { ...cfg, days: Number(e.target.value) } })}
              />
            </div>
            <div>
              <Label>Hours</Label>
              <Input
                type="number"
                min={0}
                value={Number(cfg.hours || 0)}
                onChange={(e) => onUpdate({ config: { ...cfg, hours: Number(e.target.value) } })}
              />
            </div>
            <div>
              <Label>Minutes</Label>
              <Input
                type="number"
                min={0}
                value={Number(cfg.minutes || 0)}
                onChange={(e) => onUpdate({ config: { ...cfg, minutes: Number(e.target.value) } })}
              />
            </div>
          </div>
        )}

        {block === "condition" && (
          <>
            <div>
              <Label>Field</Label>
              <Select
                value={String(cfg.field || "review_received")}
                onChange={(e) => onUpdate({ config: { ...cfg, field: e.target.value } })}
              >
                {CONDITION_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Operator</Label>
              <Select
                value={String(cfg.operator || "equals")}
                onChange={(e) => onUpdate({ config: { ...cfg, operator: e.target.value } })}
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                value={String(cfg.value ?? "true")}
                onChange={(e) => onUpdate({ config: { ...cfg, value: e.target.value } })}
              />
            </div>
          </>
        )}

        {(block === "add_tag" || block === "remove_tag") && (
          <div>
            <Label>Tag name</Label>
            <Input
              value={String(cfg.tag || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value } })}
            />
          </div>
        )}

        {block === "end_automation" && (
          <p className="text-sm text-muted-foreground">
            Customers exit the automation at this step. No further configuration needed.
          </p>
        )}

        {(block === "customer_added" || block === "manual_enrollment" || block === "tag_added" || block === "form_submitted") && (
          <p className="text-sm text-muted-foreground">
            This trigger starts the workflow when the matching event occurs in your account.
          </p>
        )}
      </div>

      <div className="border-t border-border p-3 flex gap-2">
        {node.type !== "trigger" && (
          <>
            <Button variant="outline" size="sm" onClick={onDuplicate}>Duplicate</Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-600">Delete</Button>
          </>
        )}
      </div>
    </div>
  );
}
