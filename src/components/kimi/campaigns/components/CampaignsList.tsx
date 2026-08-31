"use client";
import { useState } from "react";
import { Search, SlidersHorizontal, Users, MessageSquare, MoreVertical, BarChart2, Copy, Megaphone, Check } from "lucide-react";
import { campaigns as seed, Campaign } from "../mock-data";

export default function CampaignsList({ onCreate }: { onCreate: () => void }) {
  const [rows, setRows] = useState<Campaign[]>(seed);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));

  const clone = (c: Campaign) => {
    setRows([{ ...c, id: c.id + "-copy", name: c.name + " (Copy)", status: "Draft", meta: "Last saved just now", clicks: null, unsubs: null, revenue: null }, ...rows]);
    setMenuFor(null);
    setToast("Campaign cloned.");
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb]">
      {toast && (
        <div className="fixed top-4 right-4 z-50 fade-in flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}
      <header className="px-8 pt-7 pb-4">
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-slate-900">
          <Megaphone className="w-6 h-6 text-indigo-500" /> Campaigns
        </h1>
        <p className="text-sm text-slate-500 mt-1">View and manage all of your campaigns.</p>
      </header>

      <div className="px-8 flex items-center gap-3">
        <button className="btn-ghost flex items-center gap-2 !py-2"><SlidersHorizontal className="w-4 h-4" /> Filter</button>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="input-field !pl-9" />
        </div>
        <button className="btn-primary" onClick={onCreate}>Create Campaign</button>
      </div>

      <div className="px-8 mt-5 pb-10">
        <div className="camp-row !bg-transparent border-b border-slate-200 !py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Campaign</span><span></span><span></span><span></span><span className="text-right">Status</span><span></span>
        </div>
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelected(c.id === selected ? null : c.id)}
            className={`camp-row cursor-pointer ${selected === c.id ? "selected" : ""}`}
          >
            <div>
              <p className="text-[14px] font-semibold text-slate-800">{c.name}</p>
              <p className="text-[12px] text-slate-400 mt-0.5">{c.meta}</p>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-[13px] font-semibold">{c.recipients.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400">{c.audienceLabel}</p>
              </div>
            </div>
            <MessageSquare className="w-4 h-4 text-slate-300" />
            <div className="flex items-center gap-6">
              {c.clicks !== null ? (
                <>
                  <div><p className="text-[13px] font-semibold text-slate-800">{c.clicks}</p><p className="text-[11px] text-slate-400">Clicks</p></div>
                  <div><p className="text-[13px] font-semibold text-slate-800">{c.unsubs}</p><p className="text-[11px] text-slate-400">Unsubs</p></div>
                  <div><p className="text-[13px] font-semibold text-slate-800">{c.revenue}</p><p className="text-[11px] text-slate-400">Revenue</p></div>
                </>
              ) : <span />}
            </div>
            <div className="text-right">
              <span className={`status-pill ${c.status === "Sent" ? "sent" : "draft"}`}>{c.status}</span>
            </div>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id); }}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuFor === c.id && (
                <div className="kebab-menu fade-in" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setMenuFor(null)}><BarChart2 className="w-4 h-4" /> Analytics</button>
                  <button onClick={() => clone(c)}><Copy className="w-4 h-4" /> Clone</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
