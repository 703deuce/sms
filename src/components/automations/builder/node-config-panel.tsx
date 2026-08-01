"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  MERGE_VARIABLES,
  isConditionBlock,
} from "@/lib/automations/catalog";
import type { AutomationCanvasNode } from "@/lib/automations/types";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

type TagOption = { id: string; name: string };
type NumberOption = { id: string; number: string };
type FlowOption = { id: string; name: string };
type ContactOption = { id: string; firstName?: string | null; lastName?: string | null; phone: string };

export function NodeConfigPanel({
  flowId,
  node,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
  onTestSms,
}: {
  flowId: string;
  node: AutomationCanvasNode;
  onUpdate: (patch: Partial<AutomationCanvasNode["data"]>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
  onTestSms?: (body: string, contactId: string, nodeId: string, fromNumber?: string) => Promise<void>;
}) {
  const cfg = node.data.config || {};
  const block = node.data.blockType;

  const [tags, setTags] = useState<TagOption[]>([]);
  const [numbers, setNumbers] = useState<NumberOption[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [testContactId, setTestContactId] = useState("");
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    fetch("/api/contacts/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setTags((j?.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))))
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
    fetch("/api/automations")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setFlows((j?.data || []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))),
      )
      .catch(() => undefined);
    fetch("/api/contacts?status=subscribed")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setContacts(j?.data || []))
      .catch(() => undefined);
  }, []);

  function insertVariable(key: string) {
    if (block !== "send_sms" && block !== "send_review_request" && block !== "send_email") return;
    const field = block === "send_email" ? "body" : "body";
    const current = String(cfg[field] || "");
    onUpdate({ config: { ...cfg, [field]: current + key } });
  }

  async function sendTestSms() {
    if (!onTestSms || !testContactId) return;
    setTestSending(true);
    try {
      await onTestSms(
        String(cfg.body || ""),
        testContactId,
        node.id,
        cfg.fromNumber ? String(cfg.fromNumber) : undefined,
      );
    } finally {
      setTestSending(false);
    }
  }

  const bodyLen = String(cfg.body || "").length;
  const segments = Math.ceil(bodyLen / 160) || 1;

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{node.data.label}</p>
          <p className="text-xs text-muted-foreground">Configure this step</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted lg:hidden" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(block === "send_sms" || block === "send_review_request") && (
          <>
            <div>
              <Label>From number</Label>
              <Select
                value={String(cfg.fromNumber || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, fromNumber: e.target.value } })}
              >
                <option value="">Default sending number</option>
                {numbers.map((n) => (
                  <option key={n.id} value={n.number}>{n.number}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sms-body">Message body</Label>
              <Textarea
                id="sms-body"
                rows={5}
                value={String(cfg.body || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, body: e.target.value } })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {bodyLen} characters · ~{segments} segment(s)
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
            {onTestSms && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label>Test message</Label>
                <Select value={testContactId} onChange={(e) => setTestContactId(e.target.value)}>
                  <option value="">Select test contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} — {c.phone}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" disabled={!testContactId || testSending} onClick={sendTestSms}>
                  {testSending ? "Sending…" : "Send test SMS"}
                </Button>
              </div>
            )}
          </>
        )}

        {block === "send_email" && (
          <>
            <div>
              <Label>From name</Label>
              <Input
                value={String(cfg.fromName || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, fromName: e.target.value } })}
              />
            </div>
            <div>
              <Label>Reply-to</Label>
              <Input
                type="email"
                value={String(cfg.replyTo || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, replyTo: e.target.value } })}
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={String(cfg.subject || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, subject: e.target.value } })}
              />
            </div>
            <div>
              <Label>Email body</Label>
              <Textarea
                rows={6}
                value={String(cfg.body || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, body: e.target.value } })}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {MERGE_VARIABLES.map((v) => (
                <Button key={v.key} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertVariable(v.key)}>
                  {v.label}
                </Button>
              ))}
            </div>
          </>
        )}

        {block === "wait" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Weeks</Label>
                <Input type="number" min={0} value={Number(cfg.weeks || 0)} onChange={(e) => onUpdate({ config: { ...cfg, weeks: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Days</Label>
                <Input type="number" min={0} value={Number(cfg.days || 0)} onChange={(e) => onUpdate({ config: { ...cfg, days: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Hours</Label>
                <Input type="number" min={0} value={Number(cfg.hours || 0)} onChange={(e) => onUpdate({ config: { ...cfg, hours: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input type="number" min={0} value={Number(cfg.minutes || 0)} onChange={(e) => onUpdate({ config: { ...cfg, minutes: Number(e.target.value) } })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.respectBusinessHours)}
                onChange={(e) => onUpdate({ config: { ...cfg, respectBusinessHours: e.target.checked } })}
              />
              <Label className="text-sm">Respect business hours</Label>
            </div>
          </>
        )}

        {block === "wait_until_datetime" && (
          <>
            <div>
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={String(cfg.runAt || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, runAt: e.target.value } })}
              />
            </div>
            <div>
              <Label>Or time of day</Label>
              <Input
                type="time"
                value={String(cfg.timeOfDay || "09:00")}
                onChange={(e) => onUpdate({ config: { ...cfg, timeOfDay: e.target.value } })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.respectBusinessHours)}
                onChange={(e) => onUpdate({ config: { ...cfg, respectBusinessHours: e.target.checked } })}
              />
              <Label className="text-sm">Respect business hours</Label>
            </div>
          </>
        )}

        {isConditionBlock(block) && (
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
                {CONDITION_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                value={String(cfg.value ?? "")}
                onChange={(e) => onUpdate({ config: { ...cfg, value: e.target.value } })}
              />
            </div>
            {block === "condition_tag" && (
              <div>
                <Label>Tag</Label>
                <Select
                  value={String(cfg.tag || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value, field: "tag_has" } })}
                >
                  <option value="">Select tag</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </>
        )}

        {(block === "add_tag" || block === "remove_tag" || block === "tag_added") && (
          <div>
            <Label>Tag</Label>
            <Select
              value={String(cfg.tag || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value } })}
            >
              <option value="">Select or type below</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </Select>
            <Input
              className="mt-2"
              placeholder="Or enter tag name"
              value={String(cfg.tag || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value } })}
            />
          </div>
        )}

        {block === "form_submitted" && (
          <div>
            <Label>Form slug (optional filter)</Label>
            <Input
              value={String(cfg.formSlug || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, formSlug: e.target.value } })}
              placeholder="Leave empty for any form"
            />
          </div>
        )}

        {block.startsWith("integration_") && block !== "integration_action" && (
          <>
            <div>
              <Label>Provider (optional filter)</Label>
              <Select
                value={String(cfg.provider || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, provider: e.target.value } })}
              >
                <option value="">Any connected app</option>
                <option value="calendly">Calendly</option>
                <option value="mailchimp">Mailchimp</option>
                <option value="typeform">Typeform</option>
                <option value="activecampaign">ActiveCampaign</option>
                <option value="woocommerce">WooCommerce</option>
                <option value="jotform">Jotform</option>
                <option value="close">Close</option>
                <option value="freshdesk">Freshdesk</option>
                <option value="klaviyo">Klaviyo</option>
                <option value="highlevel">HighLevel</option>
              </Select>
            </div>
            {(block === "integration_tag_added" || block === "integration_tag_removed") && (
              <div>
                <Label>Tag filter</Label>
                <Input
                  value={String(cfg.tag || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value } })}
                  placeholder="Optional exact tag"
                />
              </div>
            )}
            {block === "integration_form_submitted" && (
              <div>
                <Label>Form ID / name filter</Label>
                <Input
                  value={String(cfg.formSlug || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, formSlug: e.target.value } })}
                  placeholder="Optional form id or name"
                />
              </div>
            )}
            {block === "integration_order_updated" && (
              <div>
                <Label>Order status filter</Label>
                <Input
                  value={String(cfg.orderStatus || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, orderStatus: e.target.value } })}
                  placeholder="e.g. completed"
                />
              </div>
            )}
            {block === "integration_appointment_scheduled" && (
              <div>
                <Label>Event type filter</Label>
                <Input
                  value={String(cfg.eventTypeName || "")}
                  onChange={(e) =>
                    onUpdate({ config: { ...cfg, eventTypeName: e.target.value } })
                  }
                  placeholder="Optional event type name"
                />
              </div>
            )}
          </>
        )}

        {block === "integration_action" && (
          <>
            <div>
              <Label>Provider</Label>
              <Select
                value={String(cfg.provider || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, provider: e.target.value } })}
              >
                <option value="">Select provider</option>
                <option value="activecampaign">ActiveCampaign</option>
                <option value="mailchimp">Mailchimp</option>
                <option value="highlevel">HighLevel</option>
                <option value="close">Close</option>
                <option value="freshdesk">Freshdesk</option>
                <option value="klaviyo">Klaviyo</option>
                <option value="woocommerce">WooCommerce</option>
              </Select>
            </div>
            <div>
              <Label>Action</Label>
              <Select
                value={String(cfg.actionId || "contact.upsert")}
                onChange={(e) => onUpdate({ config: { ...cfg, actionId: e.target.value } })}
              >
                <option value="contact.upsert">Create/update contact</option>
                <option value="contact.add_tag">Add tag</option>
                <option value="contact.remove_tag">Remove tag</option>
                <option value="contact.add_to_list">Add to list</option>
                <option value="deal.upsert">Create/update deal</option>
                <option value="task.create">Create task</option>
                <option value="note.create">Create note</option>
                <option value="ticket.create">Create ticket</option>
                <option value="ticket.add_private_note">Add private ticket note</option>
                <option value="order.add_note">Add order note</option>
              </Select>
            </div>
            <div>
              <Label>Params JSON</Label>
              <Input
                value={String(cfg.paramsJson || "{}")}
                onChange={(e) => onUpdate({ config: { ...cfg, paramsJson: e.target.value } })}
                placeholder='{"tag":"Hot Lead"}'
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Contact phone/email/name are merged automatically. Do not put secrets here.
              </p>
            </div>
          </>
        )}

        {block === "scheduled_datetime" && (
          <>
            <div>
              <Label>Run at</Label>
              <Input
                type="datetime-local"
                value={String(cfg.runAt || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, runAt: e.target.value } })}
              />
            </div>
            <div>
              <Label>Enroll</Label>
              <Select
                value={String(cfg.enrollScope || "all_subscribed")}
                onChange={(e) => onUpdate({ config: { ...cfg, enrollScope: e.target.value } })}
              >
                <option value="all_subscribed">All subscribed contacts</option>
              </Select>
            </div>
          </>
        )}

        {(block === "enroll_in_automation" || block === "remove_from_automation") && (
          <div>
            <Label>Automation</Label>
            <Select
              value={String(cfg.flowId || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, flowId: e.target.value } })}
            >
              <option value="">Select automation</option>
              {flows.filter((f) => f.id !== flowId).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>
        )}

        {block === "send_webhook" && (
          <>
            <div>
              <Label>URL</Label>
              <Input
                value={String(cfg.url || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, url: e.target.value } })}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={String(cfg.method || "POST")}
                onChange={(e) => onUpdate({ config: { ...cfg, method: e.target.value } })}
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </Select>
            </div>
          </>
        )}

        {block === "update_customer" && (
          <>
            <div>
              <Label>Field</Label>
              <Select
                value={String(cfg.field || "company")}
                onChange={(e) => onUpdate({ config: { ...cfg, field: e.target.value } })}
              >
                <option value="company">Company</option>
                <option value="firstName">First name</option>
                <option value="lastName">Last name</option>
                <option value="email">Email</option>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                value={String(cfg.value ?? "")}
                onChange={(e) => onUpdate({ config: { ...cfg, value: e.target.value } })}
              />
            </div>
          </>
        )}

        {block === "create_task" && (
          <>
            <div>
              <Label>Task title</Label>
              <Input
                value={String(cfg.title || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, title: e.target.value } })}
              />
            </div>
            <div>
              <Label>Due in (days)</Label>
              <Input
                type="number"
                min={0}
                value={Number(cfg.dueInDays || 1)}
                onChange={(e) => onUpdate({ config: { ...cfg, dueInDays: Number(e.target.value) } })}
              />
            </div>
          </>
        )}

        {block === "send_internal_notification" && (
          <div>
            <Label>Message</Label>
            <Textarea
              rows={3}
              value={String(cfg.message || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, message: e.target.value } })}
            />
          </div>
        )}

        {block === "end_automation" && (
          <p className="text-sm text-muted-foreground">
            Customers exit the automation at this step.
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
