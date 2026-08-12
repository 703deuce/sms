"use client";

import {
  RECENTLY_TESTED,
  TEST_MESSAGES,
  TEST_TECHNIQUES,
  TEST_THINKING_STEPS,
} from "@/lib/realtor/agents-crm-mock";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronUp,
  ClipboardList,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgentPageTabs } from "./agent-page-tabs";

const TABS = ["Test Agent", "Settings", "Techniques", "Evaluations"];

export function TestAgentView() {
  const [tab, setTab] = useState("Test Agent");
  const [technique, setTechnique] = useState("listening");
  const [showSteps, setShowSteps] = useState(true);
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Test Agent</h1>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
          </div>
          <p className="mt-1 max-w-2xl text-[15px] text-[#6b7280]">
            Test your AI agent to ensure it follows your instructions and behaves correctly.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="realtor-btn-outline">
            <ClipboardList className="mr-1.5 h-4 w-4" />
            Agent Logs
          </button>
          <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
            Call Agent
          </button>
        </div>
      </div>

      <AgentPageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Test Agent" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_220px]">
          <div className="space-y-5">
            <div className="realtor-card flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[14px]">
                    You are testing <strong>Front Desk</strong>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-4 text-[12px] text-[#6b7280]">
                    <span>Goal: Setting</span>
                    <span>Role: Real estate lead</span>
                    <span>Persona: Helpful real</span>
                    <span>Topic Policy: In scope</span>
                  </div>
                </div>
              </div>
              <Link href="/realtor/agents/front-desk" className="text-[13px] font-semibold text-[#7c3aed]">
                View Agent Settings
              </Link>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_280px_240px]">
              <div className="realtor-card flex flex-col">
                <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#111827]">Test Conversation</h3>
                    <p className="text-[12px] text-[#6b7280]">Make sure to test various scenarios to ensure the agent handles them.</p>
                  </div>
                  <button type="button" className="flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#111827]">
                    <Trash2 className="h-3.5 w-3.5" /> Clear chat
                  </button>
                </div>
                <div className="flex-1 space-y-4 p-4">
                  {TEST_MESSAGES.map((msg, i) => (
                    <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                      {msg.role === "agent" ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                          <Sparkles className="h-4 w-4" />
                        </span>
                      ) : null}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px]",
                          msg.role === "user"
                            ? "bg-purple-100 text-[#111827]"
                            : "bg-[#f9fafb] text-[#111827]",
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-[#e5e7eb] p-4">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="h-10 flex-1 rounded-lg border border-[#e5e7eb] px-3 text-[13px]"
                  />
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7c3aed] text-white">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="realtor-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#111827]">Agent Thinking process</h3>
                  <label className="flex items-center gap-2 text-[12px] text-[#6b7280]">
                    <input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} className="rounded" />
                    Show steps
                  </label>
                </div>
                <p className="mt-1 text-[12px] text-[#6b7280]">What the AI agent is thinking and doing each step.</p>
                {showSteps ? (
                  <>
                    <ol className="mt-4 space-y-3">
                      {TEST_THINKING_STEPS.map((step) => (
                        <li key={step.id} className="flex gap-3 text-[13px]">
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              step.done
                                ? "bg-emerald-100 text-emerald-700"
                                : step.active
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-[#f3f4f6] text-[#9ca3af]",
                            )}
                          >
                            {step.done ? <Check className="h-3.5 w-3.5" /> : step.id}
                          </span>
                          <div>
                            <p className={cn("font-medium", step.pending && "text-[#9ca3af]")}>{step.label}</p>
                            {step.detail ? <p className="text-[12px] text-[#6b7280]">{step.detail}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-[#7c3aed]">
                      <ChevronUp className="h-4 w-4" /> Show less
                    </button>
                  </>
                ) : null}
              </div>

              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Techniques</h3>
                <p className="mt-1 text-[12px] text-[#6b7280]">Choose a technique to test with your agent.</p>
                <ul className="mt-4 space-y-2">
                  {TEST_TECHNIQUES.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setTechnique(t.id)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left text-[12px] transition",
                          technique === t.id
                            ? "border-[#7c3aed] bg-purple-50"
                            : "border-[#e5e7eb] hover:bg-[#f9fafb]",
                        )}
                      >
                        <p className="font-semibold text-[#111827]">{t.label}</p>
                        <p className="mt-1 text-[#6b7280]">{t.description}</p>
                      </button>
                    </li>
                  ))}
                </ul>
                <Link href="#" className="mt-3 block text-[12px] font-semibold text-[#7c3aed]">See all techniques (12)</Link>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Last Results</h3>
                <div className="mt-4 grid grid-cols-5 gap-3 text-center">
                  {[
                    { label: "Avg call duration", value: "18" },
                    { label: "Successful Transfers", value: "2" },
                    { label: "Leads marked", value: "0" },
                    { label: "Avg sentiment", value: "100%" },
                    { label: "Overall performance", value: "Great", green: true },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className={cn("text-[20px] font-bold", stat.green ? "text-emerald-600" : "text-[#111827]")}>{stat.value}</p>
                      <p className="mt-1 text-[10px] text-[#6b7280]">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Key Factors</h3>
                <ul className="mt-4 space-y-3 text-[13px]">
                  {[
                    ["Overall sentiment", "Great"],
                    ["Handled lead well", "Yes"],
                    ["Overall tone", "Professional"],
                    ["Information accuracy", "High"],
                  ].map(([label, value]) => (
                    <li key={label} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[#374151]">
                        <Check className="h-4 w-4 text-emerald-500" />
                        {label}
                      </span>
                      <span className="font-semibold text-[#111827]">{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="realtor-card p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Recently Tested</h3>
            <ul className="mt-4 space-y-3">
              {RECENTLY_TESTED.map((item) => (
                <li key={item.name} className="border-b border-[#e5e7eb] pb-3 last:border-0">
                  <p className="text-[13px] font-semibold text-[#111827]">{item.name}</p>
                  <p className={cn("text-[12px] font-medium", item.statusClass)}>{item.status}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="realtor-card p-8 text-center text-[#6b7280]">
          <Sparkles className="mx-auto h-8 w-8 text-[#9ca3af]" />
          <p className="mt-3 text-[15px] font-medium text-[#111827]">{tab}</p>
          <p className="mt-1 text-[13px]">Configure {tab.toLowerCase()} for your test sessions.</p>
        </div>
      )}
    </div>
  );
}
