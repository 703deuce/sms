"use client";
import React, { useState } from "react";
import { Search, Plus, MoreVertical, Pencil, Code2, Copy, Trash2, ListChecks } from "lucide-react";
import { webForms, WebForm } from "../mock-data";

export default function WebFormsList({ onCreate }: { onCreate: () => void }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [rows, setRows] = useState<WebForm[]>(webForms);
  const [q, setQ] = useState("");

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="tv-forms p-6 max-w-[1200px] mx-auto">
      <div className="text-xs text-muted-foreground mb-1">Grow / Forms</div>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ListChecks size={20} className="text-indigo-600" /> Web Forms
          </h1>
          <p className="text-sm text-muted-foreground">View and manage all of your web forms.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-8 pr-3 py-2 text-sm rounded-md border border-border bg-card w-52 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          </div>
          <button onClick={onCreate} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md">
            <Plus size={15} /> Create Web Form
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground bg-muted/40">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Connected Lists</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`tv-thumb tv-thumb-${f.thumb}`} />
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-1">{f.name} <Pencil size={11} className="text-muted-foreground" /></div>
                      <div className="text-[11px] text-muted-foreground">Last saved on {f.lastSaved}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {f.description || <span className="text-indigo-600 cursor-pointer hover:underline flex items-center gap-1">Add Description <Pencil size={11} /></span>}
                </td>
                <td className="px-4 py-3 text-foreground">{f.type}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 text-xs flex items-center justify-center border border-indigo-100">▦</span>
                    {f.connectedLists} Connected List{f.connectedLists === 1 ? "" : "s"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{f.status}</span>
                </td>
                <td className="px-4 py-3 relative">
                  <button onClick={() => setMenuFor(menuFor === f.id ? null : f.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                    <MoreVertical size={16} />
                  </button>
                  {menuFor === f.id && (
                    <div className="absolute right-4 top-10 z-20 bg-card border border-border rounded-lg shadow-lg w-44 py-1 tv-pop">
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-foreground" onClick={() => setMenuFor(null)}><Pencil size={14} /> Edit</button>
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-foreground" onClick={() => setMenuFor(null)}><Code2 size={14} /> Copy Embed Code</button>
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-foreground" onClick={() => { setRows((r) => [...r, { ...f, id: f.id + "-c" + r.length, name: f.name + " (Copy)" }]); setMenuFor(null); }}><Copy size={14} /> Clone</button>
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-red-600" onClick={() => { setRows((r) => r.filter((x) => x.id !== f.id)); setMenuFor(null); }}><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
          <select className="border border-border rounded px-2 py-1 bg-card"><option>25 Per Page</option><option>50 Per Page</option></select>
        </div>
      </div>
    </div>
  );
}
