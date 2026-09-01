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
    <div className="max-w-[640px] pt-6">
      <div className="breadcrumb">Lists / <span>Create List</span></div>
      <h1 className="page-title"><ListPlus size={19} className="text-[#3b4ef5]" /> Create List</h1>
      <p className="page-subtitle mb-7">Create a new contact list.</p>

      <div className="form-card">
        <label className="field-label">List Name</label>
        <input className="input max-w-[420px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nashville Store" />

        <label className="field-label mt-5">Description</label>
        <textarea className="input h-[110px] max-w-[420px] resize-none" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Customers of Nashville Location" />

        <div className="mt-6 flex gap-3 border-t border-[#f1f3f9] pt-5">
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), desc.trim())}>Save</button>
          <button className="btn-secondary" onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
