"use client";

import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  CONTACT_FIELD_OPTIONS,
  MESSAGE_MATCH_TYPES,
  TEXT_OPERATORS,
} from "@/lib/automations/block-registry";
import type { AutomationCanvasNode } from "@/lib/automations/types";
import { useEffect, useState } from "react";

type ListOption = { id: string; name: string };

export function ParityNodeConfig({
  node,
  onUpdate,
}: {
  node: AutomationCanvasNode;
  onUpdate: (patch: Partial<AutomationCanvasNode["data"]>) => void;
}) {
  const cfg = node.data.config || {};
  const block = node.data.blockType;
  const [lists, setLists] = useState<ListOption[]>([]);

  useEffect(() => {
    fetch("/api/contacts/lists")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setLists((j?.data || []).map((l: { id: string; name: string }) => ({
          id: l.id,
          name: l.name,
        }))),
      )
      .catch(() => undefined);
  }, []);

  function setConfig(patch: Record<string, unknown>) {
    onUpdate({ config: { ...cfg, ...patch } });
  }

  if (block === "message_received" || block === "wait_for_reply") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Message matching</Label>
          <Select
            value={String(cfg.matchType || "any")}
            onChange={(e) => setConfig({ matchType: e.target.value })}
          >
            {MESSAGE_MATCH_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        {!["any", "email", "phone", "url", "number", "yes_no"].includes(
          String(cfg.matchType || "any"),
        ) ? (
          <div>
            <Label>Match value</Label>
            <Input
              value={String(cfg.matchValue || "")}
              onChange={(e) => setConfig({ matchValue: e.target.value })}
            />
          </div>
        ) : null}
        {block === "wait_for_reply" ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Days</Label>
              <Input
                type="number"
                value={Number(cfg.days || 1)}
                onChange={(e) => setConfig({ days: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Hours</Label>
              <Input
                type="number"
                value={Number(cfg.hours || 0)}
                onChange={(e) => setConfig({ hours: Number(e.target.value) })}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (
    block === "add_contact_to_list" ||
    block === "remove_contact_from_list" ||
    block === "condition_contact_on_list" ||
    block === "customer_added_to_list" ||
    block === "customer_removed_from_list"
  ) {
    const selected = Array.isArray(cfg.listIds) ? (cfg.listIds as string[]) : [];
    return (
      <div className="space-y-3">
        {(block === "customer_added_to_list" || block === "customer_removed_from_list") && (
          <div>
            <Label>List scope</Label>
            <Select
              value={String(cfg.listMode || "any")}
              onChange={(e) => setConfig({ listMode: e.target.value })}
            >
              <option value="any">Any list</option>
              <option value="specific">Specific list(s)</option>
            </Select>
          </div>
        )}
        {block === "condition_contact_on_list" && (
          <div>
            <Label>Match</Label>
            <Select
              value={String(cfg.matchMode || "any")}
              onChange={(e) => setConfig({ matchMode: e.target.value })}
            >
              <option value="any">Any selected list</option>
              <option value="all">All selected lists</option>
              <option value="none">None of selected lists</option>
            </Select>
          </div>
        )}
        <div>
          <Label>Lists</Label>
          <select
            multiple
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={selected}
            onChange={(e) => {
              const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
              const names = ids.map((id) => lists.find((l) => l.id === id)?.name || id);
              setConfig({ listIds: ids, listNames: names });
            }}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (block === "customer_field_changed" || block === "wait_for_customer_field_change") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Field</Label>
          <Select
            value={String(cfg.field || "company")}
            onChange={(e) => setConfig({ field: e.target.value })}
          >
            {CONTACT_FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        {block === "customer_field_changed" ? (
          <div>
            <Label>Change type</Label>
            <Select
              value={String(cfg.changeType || "any")}
              onChange={(e) => setConfig({ changeType: e.target.value })}
            >
              <option value="any">Any change</option>
              <option value="becomes">Changes to</option>
              <option value="changes_from">Changes from</option>
              <option value="becomes_empty">Becomes empty</option>
              <option value="becomes_non_empty">Becomes non-empty</option>
            </Select>
          </div>
        ) : (
          <div>
            <Label>Operator</Label>
            <Select
              value={String(cfg.operator || "is")}
              onChange={(e) => setConfig({ operator: e.target.value })}
            >
              {TEXT_OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label>Value</Label>
          <Input
            value={String(cfg.newValue ?? cfg.value ?? "")}
            onChange={(e) =>
              setConfig(
                block === "customer_field_changed"
                  ? { newValue: e.target.value }
                  : { value: e.target.value },
              )
            }
          />
        </div>
      </div>
    );
  }

  if (block === "split_traffic") {
    const pathCount = Number(cfg.pathCount || 2);
    return (
      <div className="space-y-3">
        <div>
          <Label>Number of paths (2–6)</Label>
          <Input
            type="number"
            min={2}
            max={6}
            value={pathCount}
            onChange={(e) =>
              setConfig({ pathCount: Math.min(6, Math.max(2, Number(e.target.value))) })
            }
          />
        </div>
        <div>
          <Label>Distribution</Label>
          <Select
            value={String(cfg.distribution || "even")}
            onChange={(e) => setConfig({ distribution: e.target.value })}
          >
            <option value="even">Even split</option>
            <option value="custom">Custom percentages</option>
          </Select>
        </div>
        {cfg.distribution === "custom" ? (
          <div className="space-y-2">
            {Array.from({ length: pathCount }).map((_, i) => (
              <div key={i}>
                <Label>Path {String.fromCharCode(65 + i)} %</Label>
                <Input
                  type="number"
                  value={
                    Array.isArray(cfg.percentages)
                      ? Number((cfg.percentages as number[])[i] || 0)
                      : 0
                  }
                  onChange={(e) => {
                    const percentages = Array.isArray(cfg.percentages)
                      ? [...(cfg.percentages as number[])]
                      : Array(pathCount).fill(0);
                    percentages[i] = Number(e.target.value);
                    setConfig({ percentages });
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (block.startsWith("inbox_") || block.includes("inbox_conversation")) {
    return (
      <div className="space-y-3">
        {block.includes("status") && (
          <div>
            <Label>Status</Label>
            <Select
              value={String(cfg.status || cfg.toStatus || "OPEN")}
              onChange={(e) => setConfig({ status: e.target.value, toStatus: e.target.value })}
            >
              <option value="OPEN">Open</option>
              <option value="PENDING">Pending</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>
        )}
        {(block.includes("tag") || block === "condition_inbox_tags") && (
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={
                Array.isArray(cfg.tags) ? (cfg.tags as string[]).join(", ") : String(cfg.tag || "")
              }
              onChange={(e) =>
                setConfig({
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        )}
        {block === "create_inbox_conversation_note" && (
          <div>
            <Label>Note</Label>
            <Textarea
              value={String(cfg.body || "")}
              onChange={(e) => setConfig({ body: e.target.value })}
              rows={4}
            />
          </div>
        )}
        {block === "mark_inbox_conversation_read" && (
          <div>
            <Label>Read state</Label>
            <Select
              value={String(cfg.readState || "read")}
              onChange={(e) => setConfig({ readState: e.target.value })}
            >
              <option value="read">Read</option>
              <option value="unread">Unread</option>
            </Select>
          </div>
        )}
      </div>
    );
  }

  if (block === "set_contact_opt_in_status") {
    return (
      <div>
        <Label>Target status</Label>
        <Select
          value={String(cfg.targetStatus || "UNSUBSCRIBED")}
          onChange={(e) => setConfig({ targetStatus: e.target.value })}
        >
          <option value="SUBSCRIBED">Subscribed</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
          <option value="BLOCKED">Blocked</option>
          <option value="INVALID">Invalid</option>
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">
          Workflows cannot manufacture consent. Subscribed requires existing consent evidence.
        </p>
      </div>
    );
  }

  if (block === "end_automation") {
    return (
      <div>
        <Label>Eject reason / label</Label>
        <Select
          value={String(cfg.ejectReason || "completed")}
          onChange={(e) => setConfig({ ejectReason: e.target.value })}
        >
          <option value="completed">Completed</option>
          <option value="not_eligible">Not eligible</option>
          <option value="no_response">No response</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="custom">Custom</option>
        </Select>
        {cfg.ejectReason === "custom" ? (
          <Input
            className="mt-2"
            placeholder="Custom reason"
            value={String(cfg.reason || "")}
            onChange={(e) => setConfig({ reason: e.target.value })}
          />
        ) : null}
      </div>
    );
  }

  if (block === "general_link_clicked" || block === "wait_for_link_click") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Link</Label>
          <Select
            value={String(cfg.linkMode || "any")}
            onChange={(e) => setConfig({ linkMode: e.target.value })}
          >
            <option value="any">Any tracked link</option>
            <option value="specific">Specific tracked link</option>
            <option value="review">Review link</option>
          </Select>
        </div>
        {block === "wait_for_link_click" ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Days</Label>
              <Input
                type="number"
                value={Number(cfg.days || 1)}
                onChange={(e) => setConfig({ days: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Hours</Label>
              <Input
                type="number"
                value={Number(cfg.hours || 0)}
                onChange={(e) => setConfig({ hours: Number(e.target.value) })}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (block === "condition_business_hours") {
    return (
      <div>
        <Label>Check</Label>
        <Select
          value={String(cfg.checkType || "during")}
          onChange={(e) => setConfig({ checkType: e.target.value })}
        >
          <option value="during">During business hours</option>
          <option value="outside">Outside business hours</option>
        </Select>
      </div>
    );
  }

  if (block === "delete_contact") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-destructive">Destructive action</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.confirm === true}
            onChange={(e) => setConfig({ confirm: e.target.checked })}
          />
          I understand this permanently deletes the contact
        </label>
        <Input
          placeholder="Optional deletion reason"
          value={String(cfg.reason || "")}
          onChange={(e) => setConfig({ reason: e.target.value })}
        />
      </div>
    );
  }

  return null;
}
