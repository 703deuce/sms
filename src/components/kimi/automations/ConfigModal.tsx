"use client";

import React, { useState, useEffect } from "react";
import { X, Paperclip, SmilePlus, Braces } from "lucide-react";
import type { CanvasNodeData } from "./WorkflowBuilder";
import {
  contactFields,
  conditionOperators,
  teammates,
  creationSources,
  waitLookFor,
  waitUnits,
} from "./palette-data";

interface Props {
  node: CanvasNodeData;
  onClose: () => void;
  onSave: (nodeId: string, subtitle: string) => void;
}

function Field({ label, children, action }: { label: string; children: React.ReactNode; action?: string }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[12px] font-semibold text-foreground">{label}</label>
        {action && <span className="cursor-pointer text-[11px] font-medium text-indigo-600 hover:underline">{action}</span>}
      </div>
      {children}
    </div>
  );
}

const selectCls =
  "h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[12.5px] text-foreground shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const inputCls = selectCls;

export default function ConfigModal({ node, onClose, onSave }: Props) {
  const [sources, setSources] = useState<Record<string, boolean>>({ Keyword: true });
  const [field, setField] = useState("Email");
  const [operator, setOperator] = useState("Has No Value");
  const [msgName, setMsgName] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [assignee, setAssignee] = useState("Chris Jones");
  const [lookForData, setLookForData] = useState("Yes");
  const [lookFor, setLookFor] = useState("An Email");
  const [saveField, setSaveField] = useState("Email");
  const [waitAmount, setWaitAmount] = useState("1");
  const [waitUnit, setWaitUnit] = useState("Days");

  useEffect(() => {
    if (node.id === "n3") { setMsgName("Email Request"); setMsgBody("Reply with your email address to get a special offer in your inbox!"); }
    if (node.id === "n5") { setMsgName("Thanks"); setMsgBody("Thanks! Keep an eye out for an offer heading your way!"); }
  }, [node.id]);

  const descriptions: Record<string, string> = {
    "t-contact-created":
      "This trigger inserts contacts into workflows when a contact is created. Select at least one source below to specify whether or not the contact should be inserted when created from that source.",
    "c-field-matches": "This condition checks whether or not a contact field matches a specific value.",
    "a-send-message": "This action sends text messages to contacts.",
    "a-assign": "This action assigns a contact's inbox conversation to a teammate if the conversation exists.",
    "w-msg-received":
      "This wait holds contacts for a certain amount of time while waiting for them to send a message to your number.",
  };

  const handleSave = () => {
    let subtitle = "Configured";
    if (node.itemId === "t-contact-created") {
      const on = creationSources.filter((s) => sources[s]);
      subtitle = on.length ? `Via ${on[0].toLowerCase()}` : "Not configured";
    } else if (node.itemId === "c-field-matches") {
      subtitle = `${field} ${operator.toLowerCase()}`;
    } else if (node.itemId === "a-send-message") {
      subtitle = msgName || "Not configured";
    } else if (node.itemId === "a-assign") {
      subtitle = assignee;
    } else if (node.itemId === "w-msg-received") {
      subtitle = lookForData === "Yes" ? `Look for ${lookFor.replace(/^An? /, "an ").replace(/^A /, "a ")}` : "Any message";
    }
    onSave(node.id, subtitle);
  };

  const enabledCount = creationSources.filter((s) => sources[s]).length;

  return (
    <div className="overlay-enter fixed inset-0 z-50 flex justify-start bg-black/30 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div
        className="drawer-enter flex h-full w-[480px] flex-col bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div className="pr-4">
            <h2 className="text-[16px] font-bold" style={{ color: "var(--navy, #1e2a5a)" }}>{node.label}</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              {descriptions[node.itemId] || "Configure this step of your automation."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 panel-scroll">
          {node.itemId === "t-contact-created" && (
            <>
              <h3 className="mb-3 text-[13px] font-bold text-foreground">Creation Source</h3>
              <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
                {creationSources.map((s) => (
                  <div key={s} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12.5px] text-foreground">{s}</span>
                    <button
                      onClick={() => setSources((p) => ({ ...p, [s]: !p[s] }))}
                      className={`kimi-toggle ${sources[s] ? "on" : ""}`}
                      aria-pressed={Boolean(sources[s])}
                      aria-label={`Toggle ${s}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {node.itemId === "c-field-matches" && (
            <>
              <Field label="Field" action="Refresh Fields">
                <select className={selectCls} value={field} onChange={(e) => setField(e.target.value)}>
                  {contactFields.map((f) => <option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Condition">
                <select className={selectCls} value={operator} onChange={(e) => setOperator(e.target.value)}>
                  {conditionOperators.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </>
          )}

          {node.itemId === "a-send-message" && (
            <div className="flex gap-5">
              <div className="flex-1">
                <Field label="Message Name">
                  <input className={inputCls} value={msgName} onChange={(e) => setMsgName(e.target.value)} placeholder="Message name" />
                </Field>
                <Field label="Message">
                  <div className="rounded-lg border border-border shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                    <textarea
                      className="h-36 w-full resize-none rounded-t-lg bg-card p-2.5 text-[12.5px] outline-none"
                      value={msgBody}
                      onChange={(e) => setMsgBody(e.target.value)}
                      placeholder="Type your message..."
                    />
                    <div className="flex items-center justify-between border-t border-border px-2.5 py-1.5">
                      <div className="flex gap-2.5 text-muted-foreground">
                        <Paperclip size={14} className="cursor-pointer transition-colors hover:text-foreground" />
                        <SmilePlus size={14} className="cursor-pointer transition-colors hover:text-foreground" />
                        <Braces size={14} className="cursor-pointer transition-colors hover:text-foreground" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">{msgBody.length}/918</span>
                    </div>
                  </div>
                </Field>
              </div>
              <div className="w-[158px] shrink-0">
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Message Preview
                </p>
                <div className="phone-frame mx-auto">
                  <div className="phone-notch" />
                  <div className="phone-screen">
                    {msgBody ? (
                      <div className="sms-bubble">{msgBody}</div>
                    ) : (
                      <p className="mt-8 text-center text-[9px] text-muted-foreground/60">
                        Start typing to preview
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {node.itemId === "a-assign" && (
            <Field label="Assign To" action="Refresh Teammates">
              <select className={selectCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                {teammates.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          )}

          {node.itemId === "w-msg-received" && (
            <>
              <Field label="Look for specific data in the message?">
                <select className={selectCls} value={lookForData} onChange={(e) => setLookForData(e.target.value)}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </Field>
              {lookForData === "Yes" && (
                <>
                  <Field label="Look For...">
                    <select className={selectCls} value={lookFor} onChange={(e) => setLookFor(e.target.value)}>
                      {waitLookFor.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="And save it to the contact field..." action="Refresh Fields">
                    <select className={selectCls} value={saveField} onChange={(e) => setSaveField(e.target.value)}>
                      <option>None</option>
                      {contactFields.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Wait up to...">
                <div className="flex gap-2">
                  <input className={`${inputCls} w-24`} value={waitAmount} onChange={(e) => setWaitAmount(e.target.value)} />
                  <select className={selectCls} value={waitUnit} onChange={(e) => setWaitUnit(e.target.value)}>
                    {waitUnits.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </Field>
            </>
          )}

          {!["t-contact-created", "c-field-matches", "a-send-message", "a-assign", "w-msg-received"].includes(node.itemId) && (
            <p className="rounded-lg bg-muted/60 p-4 text-[12px] leading-relaxed text-muted-foreground">
              This step has no additional settings. Save to mark it as configured.
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="h-9 flex-1 rounded-lg border border-border text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={node.itemId === "t-contact-created" && enabledCount === 0}
            className="h-9 flex-1 rounded-lg bg-indigo-600 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
