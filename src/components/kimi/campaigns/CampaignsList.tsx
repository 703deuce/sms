"use client";
import { useState } from "react";
import { Megaphone, Search, Users, MessageSquare, MoreVertical, BarChart2, Copy, ChevronDown, CheckCircle2 } from "lucide-react";
import type { KimiCampaign } from "./types";

export default function CampaignsList({
  campaigns,
  onCreate,
  toast,
}: {
  campaigns: KimiCampaign[];
  onCreate: () => void;
  toast: string | null;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="st-fade">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><Megaphone size={18} className="text-indigo-600" /></div>
        <h1 className="text-[22px] font-semibold text-foreground">Campaigns</h1>
      </div>
      <p className="text-[13.5px] text-gray-500 mb-5 ml-12">View and manage all of your campaigns.</p>

      <div className="flex items-center gap-3 mb-4">
        <button className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-[13px] text-gray-600 bg-card hover:bg-gray-50">
          <ChevronDown size={14} /> Filter
        </button>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search" className="border border-border rounded-lg pl-9 pr-3 py-2 text-[13px] w-64 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <button onClick={onCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-lg px-4 py-2">Create Campaign</button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-visible">
        <div className="grid grid-cols-[1fr_130px_60px_220px_90px_40px] items-center px-5 py-3 border-b border-border text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div>Campaign</div><div /><div /><div /><div className="flex items-center gap-1">Status <ChevronDown size={12} /></div><div />
        </div>
        {campaigns.map((c: KimiCampaign) => (
          <div
            key={c.id}
            onClick={() => setSelected(c.id === selected ? null : c.id)}
            className={`st-row relative grid grid-cols-[1fr_130px_60px_220px_90px_40px] items-center px-5 py-4 border-b border-border last:border-0 cursor-pointer ${selected === c.id ? "selected" : ""}`}
          >
            <div>
              <div className="text-[13.5px] font-medium text-gray-900">{c.name}</div>
              <div className="text-[12px] text-gray-400 mt-0.5">{c.savedAt}</div>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-gray-600">
              <Users size={15} className="text-indigo-400" />
              <div>
                <div className="font-medium text-gray-900">{c.recipients}</div>
                <div className="text-[11px] text-gray-400">{c.audience}</div>
              </div>
            </div>
            <div>{c.hasReply && <MessageSquare size={16} className="text-gray-300" />}</div>
            <div className="flex items-center gap-6 text-[13px]">
              {c.clicks !== null ? (
                <>
                  <div><div className="font-medium text-gray-900">{c.clicks}</div><div className="text-[11px] text-gray-400">Clicks</div></div>
                  <div><div className="font-medium text-gray-900">{c.unsubs}</div><div className="text-[11px] text-gray-400">Unsubs</div></div>
                  <div><div className="font-medium text-gray-900">{c.revenue}</div><div className="text-[11px] text-gray-400">Revenue</div></div>
                </>
              ) : <div />}
            </div>
            <div>
              <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full ${c.status === "Sent" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                {c.status === "Sent" && <CheckCircle2 size={12} />}{c.status}
              </span>
            </div>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMenuFor(menuFor === c.id ? null : c.id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400">
                <MoreVertical size={16} />
              </button>
              {menuFor === c.id && (
                <div className="absolute right-0 top-8 z-20 bg-white border border-border rounded-lg shadow-lg w-36 py-1 st-fade">
                  <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 cursor-pointer"><BarChart2 size={14} className="text-gray-400" /> Analytics</div>
                  <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 cursor-pointer"><Copy size={14} className="text-gray-400" /> Clone</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div className="st-toast fixed top-4 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-lg">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
