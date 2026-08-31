"use client";
import { useState } from "react";
import { ListPlus } from "lucide-react";

interface Props {
  onBack: () => void;
  onSave: (name: string, description: string) => void;
}

export default function CreateListPage({ onBack, onSave }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div className="p-8 max-w-[640px]">
      <div className="text-[11.5px] text-[#9aa3c0] mb-2">Lists / <span className="text-[#44507a]">Create List</span></div>
      <h1 className="flex items-center gap-2 text-[20px] font-bold text-[#0f1b3d]">
        <ListPlus size={20} className="text-[#3b4ef5]" /> Create List
      </h1>
      <p className="text-[13px] text-[#7a85a8] mt-0.5 mb-7">Create a new contact list.</p>

      <label className="block text-[12.5px] font-semibold text-[#0f1b3d] mb-1.5">List Name</label>
      <input className="input max-w-[420px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nashville Store" />

      <label className="block text-[12.5px] font-semibold text-[#0f1b3d] mt-5 mb-1.5">Description</label>
      <textarea className="input max-w-[420px] h-[110px] resize-none" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Customers of Nashville Location" />

      <div className="flex gap-3 mt-6">
        <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), desc.trim())}>Save</button>
        <button className="btn-secondary" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
