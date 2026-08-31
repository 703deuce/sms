"use client";

import { useState } from "react";
import { Megaphone, Smile, Image, Paperclip, ChevronDown, Users } from "lucide-react";
import { Segment } from "../mock-data";

export default function CreateCampaign({ segment, onBack }: { segment: Segment; onBack: () => void }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-8 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Megaphone className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Campaign Scheduled</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your campaign will be sent to <strong>{segment.contacts.toLocaleString()}</strong> contacts in “{segment.name}”.
        </p>
        <button onClick={onBack} className="btn-brand mt-6 rounded-md px-6 py-2 text-sm font-semibold">
          Back to Segments
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <p className="text-xs text-muted-foreground">
        <button onClick={onBack} className="hover:text-indigo-600">Segments</button>
        <span className="mx-1">/</span> Create Campaign
      </p>

      <h1 className="mt-3 text-xl font-bold">Create Campaign</h1>
      <p className="text-sm text-muted-foreground">Compose a message for your segment.</p>

      <div className="mt-6 grid grid-cols-[1fr_320px] gap-8">
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Campaign Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. West Coast Promo"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Send To</label>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50">
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                </span>
                Segment: <strong>{segment.name}</strong>
              </span>
              <span className="text-xs text-muted-foreground">{segment.contacts.toLocaleString()} contacts</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Message</label>
            <div className="rounded-md border border-border bg-card focus-within:border-indigo-500">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Type your message..."
                className="w-full resize-none rounded-t-md bg-transparent px-3 py-2 text-sm outline-none"
              />
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Smile className="h-4 w-4 cursor-pointer hover:text-indigo-600" />
                  <Image className="h-4 w-4 cursor-pointer hover:text-indigo-600" />
                  <Paperclip className="h-4 w-4 cursor-pointer hover:text-indigo-600" />
                </div>
                <span className="text-xs">{message.length} / 160</span>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Delivery</label>
            <button className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
              Send immediately <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setSent(true)} className="btn-brand rounded-md px-6 py-2 text-sm font-semibold">
              Send Campaign
            </button>
            <button onClick={onBack} className="rounded-md border border-border bg-card px-5 py-2 text-sm font-semibold hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>

        {/* Phone preview */}
        <div className="flex justify-center">
          <div className="phone-frame">
            <div className="flex h-8 items-center justify-center bg-muted/60 text-[10px] font-semibold text-muted-foreground">9:41</div>
            <div className="min-h-[380px] space-y-2 bg-white p-3">
              {message && (
                <div className="sms-bubble max-w-[85%] px-3 py-2 text-xs leading-relaxed text-gray-800">
                  {message}
                </div>
              )}
              {!message && (
                <p className="pt-32 text-center text-xs text-muted-foreground">Message preview</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
