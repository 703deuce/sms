"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/metric";
import { cn } from "@/lib/utils";
import {
  CheckSquare,
  Clock,
  Expand,
  GitBranch,
  MessageSquare,
  Play,
  Plus,
  Save,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  UserMinus,
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

const addSteps = [
  { label: "Send SMS", icon: MessageSquare },
  { label: "Send MMS", icon: MessageSquare },
  { label: "Add to list", icon: UserPlus },
  { label: "Remove from list", icon: UserMinus },
  { label: "Add tag", icon: Tag },
  { label: "Assign to user", icon: Users },
  { label: "Wait", icon: Clock },
];

type NodeType = "trigger" | "wait" | "condition" | "send" | "skip" | "end";

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
    trigger: "border-emerald-300 bg-emerald-50",
    wait: "border-amber-300 bg-amber-50",
    condition: "border-violet-300 bg-violet-50",
    send: "border-sky-300 bg-sky-50",
    skip: "border-slate-300 bg-slate-50",
    end: "border-emerald-200 bg-emerald-50/60",
  };
  const iconTone: Record<NodeType, string> = {
    trigger: "text-emerald-600",
    wait: "text-amber-600",
    condition: "text-violet-600",
    send: "text-sky-600",
    skip: "text-slate-500",
    end: "text-emerald-600",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full max-w-[240px] rounded-[12px] border-2 px-4 py-3 text-left transition hover:shadow-sm",
        colors[type],
        selected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", iconTone[type])} />
        <span className="text-[13px] font-bold text-foreground">{label}</span>
      </div>
      {detail ? (
        <p className="mt-1 pl-6 text-[12px] text-muted-foreground">{detail}</p>
      ) : null}
    </button>
  );
}

function Connector() {
  return (
    <div className="relative flex h-10 flex-col items-center justify-center">
      <div className="h-full w-px bg-border" />
      <button
        type="button"
        className="absolute flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:border-primary hover:text-primary"
        aria-label="Add step"
      >
        <Plus className="h-3 w-3" />
      </button>
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
    <div className="text-[13px]">
      <SectionHeader
        icon={Zap}
        iconTone="bg-emerald-50 text-emerald-600"
        title="New automation"
        description="Design a visual SMS flow with triggers, delays, conditions, and message steps."
        actions={
          <>
            <Link href="/automations">
              <Button variant="outline" className="rounded-[10px]">
                Cancel
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-[10px] border-primary text-primary hover:bg-emerald-50"
            >
              <Save className="h-4 w-4" />
              Save draft
            </Button>
            <Button className="rounded-[10px]">
              <Zap className="h-4 w-4" />
              Activate
            </Button>
          </>
        }
      />

      <div className="mb-5 max-w-md">
        <Label htmlFor="flow-name">Flow name</Label>
        <Input
          id="flow-name"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="mt-1.5 h-10 rounded-[10px]"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="rounded-[12px] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold text-foreground">Flow canvas</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Click a node to configure it in the panel on the right.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:bg-muted"
                aria-label="Fullscreen"
              >
                <Expand className="h-3.5 w-3.5" />
              </button>
              <select className="h-8 rounded-[8px] border border-border bg-card px-2 text-[12px]">
                <option>100%</option>
                <option>75%</option>
                <option>125%</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col items-center pb-2">
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

            <FlowNode
              type="condition"
              label="Condition"
              detail={`If ${selectedCondition.toLowerCase()}`}
              selected={selectedNode === "condition"}
              onClick={() => setSelectedNode("condition")}
              icon={GitBranch}
            />

            <div className="mt-1 flex w-full max-w-lg gap-6">
              <div className="flex flex-1 flex-col items-center">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Yes
                </p>
                <div className="mb-1 h-4 w-px bg-border" />
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
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  No
                </p>
                <div className="mb-1 h-4 w-px bg-border" />
                <FlowNode
                  type="skip"
                  label="Skip"
                  detail="End without sending"
                  selected={selectedNode === "skip"}
                  onClick={() => setSelectedNode("skip")}
                  icon={CheckSquare}
                />
              </div>
            </div>

            <Connector />
            <FlowNode
              type="end"
              label="End"
              detail="Flow complete"
              selected={selectedNode === "end"}
              onClick={() => setSelectedNode("end")}
              icon={Play}
            />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[12px] p-4">
            <h2 className="text-[14px] font-bold text-foreground">Node settings</h2>
            <div className="mt-4 space-y-4">
              {selectedNode === "trigger" && (
                <>
                  <div>
                    <Label htmlFor="trigger">Trigger type</Label>
                    <div className="relative mt-1.5">
                      <Zap className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-600" />
                      <Select
                        id="trigger"
                        value={selectedTrigger}
                        onChange={(e) => setSelectedTrigger(e.target.value)}
                        className="h-10 rounded-[10px] pl-9"
                      >
                        {triggers.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="list">Target list</Label>
                    <div className="relative mt-1.5">
                      <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Select id="list" defaultValue="Leads" className="h-10 rounded-[10px] pl-9">
                        <option>Leads</option>
                        <option>Customers</option>
                        <option>VIP</option>
                      </Select>
                    </div>
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
                    className="mt-1.5 h-10 rounded-[10px]"
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
                    className="mt-1.5 h-10 rounded-[10px]"
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
                    <Select id="template" defaultValue="" className="mt-1.5 h-10 rounded-[10px]">
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
                      className="mt-1.5 rounded-[10px]"
                    />
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Use {"{{first_name}}"}, {"{{business_name}}"}, and other merge fields.
                    </p>
                  </div>
                </>
              )}

              {(selectedNode === "skip" || selectedNode === "end") && (
                <p className="text-[13px] text-muted-foreground">
                  End nodes mark where a contact exits the flow. No additional configuration
                  required.
                </p>
              )}
            </div>
          </Card>

          <Card className="rounded-[12px] p-4">
            <h2 className="text-[14px] font-bold text-foreground">Add step</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {addSteps.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-left text-[12px] font-medium hover:border-primary/40 hover:bg-muted/40"
                >
                  <action.icon className="h-3.5 w-3.5 text-primary" />
                  {action.label}
                </button>
              ))}
            </div>
          </Card>

          <div className="flex items-start gap-2.5 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12px] text-emerald-900">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>Drag nodes on the canvas to reorder steps or add new ones.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
