"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { getVoiceFlowBlock } from "@/lib/voice/flow/catalog";
import type { VoiceFlowNode } from "@/lib/voice/flow/types";

export function VoiceNodeConfigPanel({
  node,
  onChange,
  onDelete,
}: {
  node: VoiceFlowNode | null;
  onChange: (patch: { label?: string; config?: Record<string, unknown> }) => void;
  onDelete: () => void;
}) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        Select a node to configure it. Customers never need to edit JSON.
      </div>
    );
  }
  const block = getVoiceFlowBlock(node.data.blockType);
  const cfg = node.data.config || {};

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">{node.data.label}</p>
        <p className="text-[11px] text-muted-foreground">{block?.description}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <Label>Label</Label>
          <Input
            value={node.data.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>

        {node.data.blockType === "greeting" || node.data.blockType === "wait_filler" ? (
          <div>
            <Label>Spoken text</Label>
            <Textarea
              rows={3}
              value={String(cfg.text || "")}
              onChange={(e) => onChange({ config: { ...cfg, text: e.target.value } })}
            />
          </div>
        ) : null}

        {node.data.blockType === "ask_question" ? (
          <>
            <div>
              <Label>Question</Label>
              <Textarea
                rows={2}
                value={String(cfg.question || "")}
                onChange={(e) =>
                  onChange({ config: { ...cfg, question: e.target.value } })
                }
              />
            </div>
            <div>
              <Label>Variable name</Label>
              <Input
                value={String(cfg.variable || "answer")}
                onChange={(e) =>
                  onChange({ config: { ...cfg, variable: e.target.value } })
                }
              />
            </div>
          </>
        ) : null}

        {node.data.blockType === "ring_group" || node.data.blockType === "ring_user" ? (
          <div>
            <Label>Ring seconds</Label>
            <Input
              type="number"
              min={5}
              max={120}
              value={Number(cfg.seconds || 25)}
              onChange={(e) =>
                onChange({ config: { ...cfg, seconds: Number(e.target.value) } })
              }
            />
          </div>
        ) : null}

        {node.data.blockType === "transfer" ||
        node.data.blockType === "escalate_human" ? (
          <div>
            <Label>Named transfer target</Label>
            <Input
              value={String(cfg.targetName || "Agent Handoff")}
              onChange={(e) =>
                onChange({ config: { ...cfg, targetName: e.target.value } })
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Must match a configured destination (e.g. Agent Handoff). Agents cannot invent numbers.
            </p>
          </div>
        ) : null}

        {node.data.blockType === "agent_handoff" ? (
          <div>
            <Label>Specialist assistant name</Label>
            <Input
              value={String(cfg.assistantName || "Billing Specialist")}
              onChange={(e) =>
                onChange({ config: { ...cfg, assistantName: e.target.value } })
              }
            />
          </div>
        ) : null}

        {node.data.blockType === "send_sms" ? (
          <div>
            <Label>SMS template key</Label>
            <Input
              value={String(cfg.template || "booking_link")}
              onChange={(e) =>
                onChange({ config: { ...cfg, template: e.target.value } })
              }
            />
          </div>
        ) : null}

        {node.data.blockType === "end_call" ? (
          <div>
            <Label>Closing statement</Label>
            <Textarea
              rows={2}
              value={String(cfg.closing || "Thanks for calling. Goodbye.")}
              onChange={(e) =>
                onChange({ config: { ...cfg, closing: e.target.value } })
              }
            />
          </div>
        ) : null}

        {node.data.blockType === "conversation" ? (
          <div>
            <Label>Goal</Label>
            <Textarea
              rows={2}
              value={String(cfg.goal || "")}
              onChange={(e) => onChange({ config: { ...cfg, goal: e.target.value } })}
            />
          </div>
        ) : null}

        {node.data.blockType === "tool_call" ? (
          <div>
            <Label>Tool key</Label>
            <Input
              value={String(cfg.toolKey || "")}
              onChange={(e) =>
                onChange({ config: { ...cfg, toolKey: e.target.value } })
              }
              placeholder="search_crm_contacts"
            />
          </div>
        ) : null}

        {block?.toolKey ? (
          <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
            Compiles to tool: <span className="font-medium">{block.toolKey}</span>
          </p>
        ) : null}
      </div>
      <div className="border-t border-border p-3">
        <Button type="button" variant="danger" className="w-full" onClick={onDelete}>
          Delete node
        </Button>
      </div>
    </div>
  );
}
