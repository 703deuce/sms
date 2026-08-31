"use client";
import { useState } from "react";
import { Search, Filter, MoreVertical, Users, Image, BarChart2, Copy, Megaphone, Info } from "lucide-react";
import { campaigns } from "../mock-data";

export default function CampaignList({ onCreate }: { onCreate: () => void }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rows = campaigns.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#eef0fd] flex items-center justify-center"><Megaphone size={16} className="text-[#3f4bd8]" /></div>
        <h1 className="text-[22px] font-bold text-[#1a1f36]">Campaigns</h1>
      </div>
      <p className="text-[13px] text-[#6b7288] mb-6 ml-11">View and manage all of your campaigns.</p>

      <div className="flex items-center gap-3 mb-4">
        <button className="tv-input flex items-center gap-2 px-3 py-2 text-[13px] text-[#4a5068] font-medium"><Filter size={14} /> Filter</button>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa1b5]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="tv-input pl-9 pr-3 py-2 text-[13px] w-[240px]" />
        </div>
        <button onClick={onCreate} className="tv-btn-primary px-4 py-2 text-[13px]">Create Campaign</button>
      </div>

      <div className="tv-card overflow-visible">
        <div className="grid grid-cols-[1fr_130px_60px_220px_90px_40px] items-center px-5 py-3 border-b border-[#eef0f5] text-[11px] font-semibold uppercase tracking-wide text-[#9aa1b5]">
          <span className="flex items-center gap-1">Campaign <Info size={11} /></span>
          <span />
          <span />
          <span />
          <span className="flex items-center gap-1 justify-end">Status <Info size={11} /></span>
          <span />
        </div>
        {rows.map((c) => (
          <div key={c.id} className="tv-row-hover grid grid-cols-[1fr_130px_60px_220px_90px_40px] items-center px-5 py-4 border-b border-[#f1f2f6] last:border-0 relative">
            <div>
              <p className="text-[13.5px] font-semibold text-[#1a1f36] flex items-center gap-2">
                {c.name}
                {c.status === "Draft" && <span className="text-[10px] text-[#9aa1b5] font-normal">✎</span>}
              </p>
              <p className="text-[12px] text-[#6b7288] mt-0.5">{c.detail}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1a1f36]">
              <span className="w-6 h-6 rounded-md bg-[#eef0fd] flex items-center justify-center"><Users size={12} className="text-[#3f4bd8]" /></span>
              {c.recipients}
              <span className="block text-[11px] font-normal text-[#9aa1b5] ml-1">{c.audience}</span>
            </div>
            <div>{c.hasMms && <Image size={15} className="text-[#9aa1b5]" />}</div>
            <div className="flex items-center gap-5 text-[13px]">
              {c.clicks !== null ? (
                <>
                  <span className="text-center"><span className="block font-semibold text-[#1a1f36]">{c.clicks}</span><span className="text-[11px] text-[#9aa1b5]">Clicks</span></span>
                  <span className="text-center"><span className="block font-semibold text-[#1a1f36]">{c.unsubs}</span><span className="text-[11px] text-[#9aa1b5]">Unsubs</span></span>
                  <span className="text-center"><span className="block font-semibold text-[#1a1f36]">{c.revenue}</span><span className="text-[11px] text-[#9aa1b5]">Revenue</span></span>
                </>
              ) : <span />}
            </div>
            <div className="flex justify-end">
              <span className={c.status === "Sent" ? "tv-status-sent" : "tv-status-draft"}>{c.status}</span>
            </div>
            <div className="relative flex justify-end">
              <button onClick={() => setMenuFor(menuFor === c.id ? null : c.id)} className="p-1.5 rounded-md hover:bg-[#eef0f5] text-[#6b7288]">
                <MoreVertical size={16} />
              </button>
              {menuFor === c.id && (
                <div className="absolute right-0 top-8 z-20 tv-card shadow-lg w-[150px] py-1.5 text-[13px]">
                  <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6fa] text-[#1a1f36]" onClick={() => setMenuFor(null)}><BarChart2 size={14} className="text-[#6b7288]" /> Analytics</button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6fa] text-[#1a1f36]" onClick={() => setMenuFor(null)}><Copy size={14} className="text-[#6b7288]" /> Clone</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
