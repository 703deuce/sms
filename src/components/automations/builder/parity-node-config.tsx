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
type SegmentOption = { id: string; name: string };
type TeamOption = { id: string; name: string };
type FlowOption = { id: string; name: string };
type NumberOption = { id: string; number: string };
type TagOption = { id: string; name: string };

function DurationFields({
  cfg,
  setConfig,
}: {
  cfg: Record<string, unknown>;
  setConfig: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label>Weeks</Label>
        <Input
          type="number"
          value={Number(cfg.weeks || 0)}
          onChange={(e) => setConfig({ weeks: Number(e.target.value) })}
        />
      </div>
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
      <div>
        <Label>Minutes</Label>
        <Input
          type="number"
          value={Number(cfg.minutes || 0)}
          onChange={(e) => setConfig({ minutes: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

export function ParityNodeConfig({
  node,
  onUpdate,
  flowId,
}: {
  node: AutomationCanvasNode;
  onUpdate: (patch: Partial<AutomationCanvasNode["data"]>) => void;
  flowId?: string;
}) {
  const cfg = node.data.config || {};
  const block = node.data.blockType;
  const [lists, setLists] = useState<ListOption[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [team, setTeam] = useState<TeamOption[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [numbers, setNumbers] = useState<NumberOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);

  useEffect(() => {
    fetch("/api/contacts/lists")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setLists((j?.data || []).map((l: ListOption) => l)))
      .catch(() => undefined);
    fetch("/api/contacts/segments")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSegments((j?.data || []).map((s: SegmentOption) => s)))
      .catch(() => undefined);
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setTeam(
          (j?.data || []).map((m: { id: string; name: string }) => ({
            id: m.id,
            name: m.name,
          })),
        ),
      )
      .catch(() => undefined);
    fetch("/api/automations")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setFlows(
          (j?.data || [])
            .filter((f: { id: string }) => f.id !== flowId)
            .map((f: FlowOption) => f),
        ),
      )
      .catch(() => undefined);
    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setNumbers(
          (j?.data || []).map((n: { id: string; e164?: string; number?: string }) => ({
            id: n.id,
            number: n.e164 || n.number || "",
          })),
        ),
      )
      .catch(() => undefined);
    fetch("/api/contacts/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setTags((j?.data || []).map((t: TagOption) => t)))
      .catch(() => undefined);
  }, [flowId]);

  function setConfig(patch: Record<string, unknown>) {
    onUpdate({ config: { ...cfg, ...patch } });
  }

  if (block === "message_received") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Receiving number</Label>
          <Select
            value={String(cfg.receivingNumberMode || "any")}
            onChange={(e) => setConfig({ receivingNumberMode: e.target.value })}
          >
            <option value="any">Any eligible number</option>
            <option value="specific">Specific number(s)</option>
          </Select>
        </div>
        {cfg.receivingNumberMode === "specific" ? (
          <select
            multiple
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={
              Array.isArray(cfg.receivingNumberIds)
                ? (cfg.receivingNumberIds as string[])
                : []
            }
            onChange={(e) =>
              setConfig({
                receivingNumberIds: Array.from(e.target.selectedOptions).map((o) => o.value),
              })
            }
          >
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.number}
              </option>
            ))}
          </select>
        ) : null}
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
      </div>
    );
  }

  if (block === "wait_for_reply") {
    return (
      <div className="space-y-3">
        <div>
          <Label>What to look for</Label>
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
        <DurationFields cfg={cfg} setConfig={setConfig} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.saveDetectedData === true}
            onChange={(e) => setConfig({ saveDetectedData: e.target.checked })}
          />
          Save detected data
        </label>
      </div>
    );
  }

  if (
    block === "wait_for_link_click" ||
    block === "wait_for_workflow_message_click" ||
    block === "general_link_clicked" ||
    block === "condition_general_link_clicked" ||
    block === "condition_workflow_message_clicked"
  ) {
    return (
      <div className="space-y-3">
        {block === "wait_for_workflow_message_click" ||
        block === "condition_workflow_message_clicked" ? (
          <div>
            <Label>Prior Send SMS node</Label>
            <Input
              placeholder="Node ID from canvas"
              value={String(cfg.sendSmsNodeId || "")}
              onChange={(e) => setConfig({ sendSmsNodeId: e.target.value })}
            />
          </div>
        ) : null}
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
        {block.startsWith("wait_") ? <DurationFields cfg={cfg} setConfig={setConfig} /> : null}
        {block.startsWith("condition_") ? (
          <div>
            <Label>Timeframe</Label>
            <Select
              value={String(cfg.timeframe || "ever")}
              onChange={(e) => setConfig({ timeframe: e.target.value })}
            >
              <option value="ever">Ever</option>
              <option value="since_workflow_started">Since workflow started</option>
              <option value="within_last">Within last X days</option>
            </Select>
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
          <>
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
            {block === "customer_added_to_list" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.firstOnly !== false}
                  onChange={(e) => setConfig({ firstOnly: e.target.checked })}
                />
                First addition only
              </label>
            ) : null}
          </>
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

  if (block === "condition_contact_segment") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Segment</Label>
          <Select
            value={String(cfg.segmentId || "")}
            onChange={(e) => {
              const seg = segments.find((s) => s.id === e.target.value);
              setConfig({ segmentId: e.target.value, segmentName: seg?.name || "" });
            }}
          >
            <option value="">Select segment</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Match</Label>
          <Select
            value={String(cfg.matchMode || "any")}
            onChange={(e) => setConfig({ matchMode: e.target.value })}
          >
            <option value="any">Matches segment</option>
          </Select>
        </div>
      </div>
    );
  }

  if (block === "condition_customer_field") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Field</Label>
          <Select
            value={String(cfg.field || "email")}
            onChange={(e) => setConfig({ field: e.target.value })}
          >
            {CONTACT_FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Operator</Label>
          <Select
            value={String(cfg.operator || "has_no_value")}
            onChange={(e) => setConfig({ operator: e.target.value })}
          >
            {TEXT_OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        {!["has_no_value", "has_value"].includes(String(cfg.operator || "")) && (
          <div>
            <Label>Value</Label>
            <Input
              value={String(cfg.value ?? "")}
              onChange={(e) => setConfig({ value: e.target.value })}
            />
          </div>
        )}
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
            <option value="dateOfBirth">Birthday (custom)</option>
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
          <>
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
            <DurationFields cfg={cfg} setConfig={setConfig} />
          </>
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

  if (block === "contact_birthday") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Birthday field</Label>
          <Select
            value={String(cfg.birthdayField || "dateOfBirth")}
            onChange={(e) => setConfig({ birthdayField: e.target.value })}
          >
            <option value="dateOfBirth">Date of birth (custom field)</option>
            <option value="birthday">Birthday (custom field)</option>
          </Select>
        </div>
        <div>
          <Label>Time of day</Label>
          <Input
            type="time"
            value={String(cfg.timeOfDay || "09:00")}
            onChange={(e) => setConfig({ timeOfDay: e.target.value })}
          />
        </div>
        <div>
          <Label>Timezone</Label>
          <Select
            value={String(cfg.timezoneMode || "business")}
            onChange={(e) => setConfig({ timezoneMode: e.target.value })}
          >
            <option value="business">Business timezone</option>
            <option value="contact">Contact timezone</option>
            <option value="specified">Specified</option>
          </Select>
        </div>
      </div>
    );
  }

  if (block === "popup_submitted") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Popup</Label>
          <Select
            value={String(cfg.popupMode || "any")}
            onChange={(e) => setConfig({ popupMode: e.target.value })}
          >
            <option value="any">Any popup</option>
            <option value="specific">Specific popup</option>
          </Select>
        </div>
        <div>
          <Label>Contact type</Label>
          <Select
            value={String(cfg.contactType || "either")}
            onChange={(e) => setConfig({ contactType: e.target.value })}
          >
            <option value="either">Either</option>
            <option value="new">New contact</option>
            <option value="existing">Existing contact</option>
          </Select>
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

  if (
    block.startsWith("inbox_") ||
    block.includes("inbox_conversation") ||
    block.startsWith("condition_inbox")
  ) {
    return (
      <div className="space-y-3">
        {(block.includes("assign") || block === "condition_inbox_assignee") && (
          <div>
            <Label>Assignee</Label>
            <Select
              value={String(cfg.assigneeId || cfg.assigneeMode || "anyone")}
              onChange={(e) => {
                if (e.target.value === "anyone" || e.target.value === "unassigned") {
                  setConfig({ assigneeMode: e.target.value, assigneeId: "" });
                } else {
                  const member = team.find((t) => t.id === e.target.value);
                  setConfig({
                    assigneeMode: "teammate",
                    assigneeId: e.target.value,
                    assigneeName: member?.name || "",
                  });
                }
              }}
            >
              <option value="anyone">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {(block.includes("status") || block === "condition_inbox_status") && (
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
            <Label>Conversation tags</Label>
            <select
              multiple
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={Array.isArray(cfg.tags) ? (cfg.tags as string[]) : []}
              onChange={(e) =>
                setConfig({
                  tags: Array.from(e.target.selectedOptions).map((o) => o.value),
                })
              }
            >
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
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
        {block === "assign_inbox_conversation" && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.onlyIfUnassigned === true}
                onChange={(e) => setConfig({ onlyIfUnassigned: e.target.checked })}
              />
              Only assign if currently unassigned
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.reassignAllowed !== false}
                onChange={(e) => setConfig({ reassignAllowed: e.target.checked })}
              />
              Reassign allowed
            </label>
          </>
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

  if (block === "condition_sms_opt_in_status") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Mode</Label>
          <Select
            value={String(cfg.mode || "compare")}
            onChange={(e) => setConfig({ mode: e.target.value })}
          >
            <option value="compare">Compare to selected status</option>
            <option value="branch">Branch by current status</option>
          </Select>
        </div>
        {cfg.mode !== "branch" ? (
          <>
            <div>
              <Label>Status</Label>
              <Select
                value={String(cfg.compareStatus || "SUBSCRIBED")}
                onChange={(e) => setConfig({ compareStatus: e.target.value })}
              >
                <option value="SUBSCRIBED">Subscribed</option>
                <option value="UNSUBSCRIBED">Unsubscribed</option>
                <option value="BLOCKED">Blocked</option>
              </Select>
            </div>
            <div>
              <Label>Match</Label>
              <Select
                value={String(cfg.match || "is")}
                onChange={(e) => setConfig({ match: e.target.value })}
              >
                <option value="is">Is</option>
                <option value="is_not">Is not</option>
              </Select>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (block === "condition_workflow_status") {
    return (
      <div>
        <Label>Automation</Label>
        <Select
          value={String(cfg.flowId || "")}
          onChange={(e) => {
            const f = flows.find((x) => x.id === e.target.value);
            setConfig({ flowId: e.target.value, flowName: f?.name || "" });
          }}
        >
          <option value="">Select automation</option>
          {flows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
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

  if (block === "condition_business_hours") {
    return (
      <div className="space-y-3">
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
        <div>
          <Label>Timezone</Label>
          <Select
            value={String(cfg.timezoneMode || "business")}
            onChange={(e) => setConfig({ timezoneMode: e.target.value })}
          >
            <option value="business">Business</option>
            <option value="contact">Contact</option>
            <option value="specified">Specified</option>
          </Select>
        </div>
      </div>
    );
  }

  if (block === "send_sms" || block === "send_review_request") {
    const bodyLen = String(cfg.body || "").length;
    const segments = Math.max(1, Math.ceil(bodyLen / 160));
    return (
      <div className="space-y-3">
        <div>
          <Label>Internal message name</Label>
          <Input
            value={String(cfg.messageName || "")}
            onChange={(e) => setConfig({ messageName: e.target.value })}
            placeholder="e.g. Welcome message"
          />
        </div>
        <div>
          <Label>From number</Label>
          <Select
            value={String(cfg.fromNumber || "")}
            onChange={(e) => setConfig({ fromNumber: e.target.value })}
          >
            <option value="">Default sending number</option>
            {numbers.map((n) => (
              <option key={n.id} value={n.number}>
                {n.number}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="sms-body">Message body</Label>
          <Textarea
            id="sms-body"
            rows={5}
            value={String(cfg.body || "")}
            onChange={(e) => setConfig({ body: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {bodyLen} characters · ~{segments} segment(s)
          </p>
        </div>
        {block === "send_sms" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(cfg.stopOnReply)}
              onChange={(e) => setConfig({ stopOnReply: e.target.checked })}
            />
            Stop on reply
          </label>
        )}
      </div>
    );
  }

  if (block === "update_customer") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Contact field</Label>
          <Select
            value={String(cfg.field || "firstName")}
            onChange={(e) => setConfig({ field: e.target.value })}
          >
            {CONTACT_FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>New value</Label>
          <Input
            value={String(cfg.value ?? "")}
            onChange={(e) => setConfig({ value: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (block === "customer_added") {
    const sources = [
      "CSV Import",
      "Manual Creation",
      "Keyword",
      "Inbox",
      "Website Popup/Form",
      "API",
    ];
    const selected = Array.isArray(cfg.sources) ? (cfg.sources as string[]) : sources;
    return (
      <div className="space-y-2">
        <Label>Creation sources</Label>
        {sources.map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(s)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, s]
                  : selected.filter((x) => x !== s);
                setConfig({ sources: next });
              }}
            />
            {s}
          </label>
        ))}
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
