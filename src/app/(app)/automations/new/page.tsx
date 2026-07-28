"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowLeft,
  Clock,
  GitBranch,
  MessageSquare,
  Play,
  Square,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const triggers = [
  "Contact joins list",
  "Incoming message keyword",
  "No reply after X hours",
  "Birthday",
  "Appointment date",
  "Tag added",
  "Form submission",
  "Manual enrollment",
];

const waitOptions = ["1 hour", "4 hours", "24 hours", "48 hours", "3 days", "7 days"];
const conditions = [
  "Replied to previous message",
  "Has tag",
  "On list",
  "Custom field equals",
  "Link clicked",
];

const actions = [
  "Send SMS",
  "Send MMS",
  "Add to list",
  "Remove from list",
  "Add tag",
  "Assign to user",
  "Wait",
];

type NodeType = "trigger" | "wait" | "condition" | "send" | "end";

function FlowNode({
  type,
  label,
  detail,
  selected,
  onClick,
  icon: Icon,
}: {
  type: NodeType;
  label: string;
  detail?: string;
  selected?: boolean;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const colors: Record<NodeType, string> = {
    trigger: "border-primary bg-primary/5",
    wait: "border-amber-300 bg-amber-50",
    condition: "border-violet-300 bg-violet-50",
    send: "border-sky-300 bg-sky-50",
    end: "border-border bg-muted/40",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full max-w-xs rounded-xl border-2 px-4 py-3 text-left transition hover:shadow-md",
        colors[type],
        selected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      {detail ? (
        <p className="mt-1 pl-6 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </button>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="h-6 w-px bg-border" />
      <ArrowDown className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export default function NewAutomationPage() {
  const [flowName, setFlowName] = useState("Untitled flow");
  const [selectedTrigger, setSelectedTrigger] = useState(triggers[0]);
  const [selectedWait, setSelectedWait] = useState(waitOptions[2]);
  const [selectedCondition, setSelectedCondition] = useState(conditions[0]);
  const [messageBody, setMessageBody] = useState(
    "Hi {{first_name}}, thanks for connecting with {{business_name}}! Reply HELP for support.",
  );
  const [selectedNode, setSelectedNode] = useState<NodeType>("trigger");

  return (
    <div>
      <PageHeader
        title="New automation"
        description="Design a visual SMS flow with triggers, delays, conditions, and message steps."
        actions={
          <>
            <Link href="/automations">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
            <Button>Save draft</Button>
            <Button variant="outline">Activate</Button>
          </>
        }
      />

      <div className="mb-6">
        <Label htmlFor="flow-name">Flow name</Label>
        <Input
          id="flow-name"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardTitle>Flow canvas</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Click a node to configure it in the panel on the right.
            </p>

            <div className="mt-8 flex flex-col items-center pb-4">
              <FlowNode
                type="trigger"
                label="Trigger"
                detail={selectedTrigger}
                selected={selectedNode === "trigger"}
                onClick={() => setSelectedNode("trigger")}
                icon={Zap}
              />
              <Connector />

              <FlowNode
                type="wait"
                label="Wait"
                detail={selectedWait}
                selected={selectedNode === "wait"}
                onClick={() => setSelectedNode("wait")}
                icon={Clock}
              />
              <Connector />

              <div className="flex w-full max-w-md gap-4">
                <div className="flex flex-1 flex-col items-center">
                  <FlowNode
                    type="condition"
                    label="Condition"
                    detail={`If ${selectedCondition.toLowerCase()}`}
                    selected={selectedNode === "condition"}
                    onClick={() => setSelectedNode("condition")}
                    icon={GitBranch}
                  />
                  <Connector />
                  <FlowNode
                    type="send"
                    label="Send SMS"
                    detail="Yes branch"
                    selected={selectedNode === "send"}
                    onClick={() => setSelectedNode("send")}
                    icon={MessageSquare}
                  />
                </div>
                <div className="flex flex-1 flex-col items-center">
                  <div className="mt-8 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    No branch
                  </div>
                  <Connector />
                  <FlowNode
                    type="end"
                    label="Skip"
                    detail="End without sending"
                    selected={selectedNode === "end"}
                    onClick={() => setSelectedNode("end")}
                    icon={Square}
                  />
                </div>
              </div>

              <Connector />
              <FlowNode type="end" label="End" detail="Flow complete" icon={Play} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Node settings</CardTitle>
            <div className="mt-4 space-y-4">
              {selectedNode === "trigger" && (
                <>
                  <div>
                    <Label htmlFor="trigger">Trigger type</Label>
                    <Select
                      id="trigger"
                      value={selectedTrigger}
                      onChange={(e) => setSelectedTrigger(e.target.value)}
                    >
                      {triggers.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="list">Target list</Label>
                    <Select id="list" defaultValue="Leads">
                      <option>Leads</option>
                      <option>Customers</option>
                      <option>VIP</option>
                    </Select>
                  </div>
                </>
              )}

              {selectedNode === "wait" && (
                <div>
                  <Label htmlFor="wait">Wait duration</Label>
                  <Select
                    id="wait"
                    value={selectedWait}
                    onChange={(e) => setSelectedWait(e.target.value)}
                  >
                    {waitOptions.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {selectedNode === "condition" && (
                <div>
                  <Label htmlFor="condition">Condition</Label>
                  <Select
                    id="condition"
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                  >
                    {conditions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {selectedNode === "send" && (
                <>
                  <div>
                    <Label htmlFor="template">Template</Label>
                    <Select id="template" defaultValue="">
                      <option value="">Custom message</option>
                      <option>Welcome SMS</option>
                      <option>Appointment reminder</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="body">Message body</Label>
                    <Textarea
                      id="body"
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use {"{{first_name}}"}, {"{{business_name}}"}, and other merge fields.
                    </p>
                  </div>
                </>
              )}

              {selectedNode === "end" && (
                <p className="text-sm text-muted-foreground">
                  End nodes mark where a contact exits the flow. No additional configuration
                  required.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Add step</CardTitle>
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button key={action} variant="outline" size="sm">
                  {action}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
