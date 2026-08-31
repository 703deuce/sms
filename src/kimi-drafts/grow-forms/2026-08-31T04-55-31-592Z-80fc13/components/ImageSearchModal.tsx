"use client";
import React, { useState } from "react";
import { Search, ImageIcon } from "lucide-react";
import { Modal } from "./ui";
import { stockImages } from "../mock-data";

export default function ImageSearchModal({
  open, onClose, onPick,
}: { open: boolean; onClose: () => void; onPick: (hue: string) => void }) {
  const [q, setQ] = useState("");
  const [searched, setSearched] = useState(false);

  return (
    <Modal open={open} onClose={onClose} width={880}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Search Images</h2>
            <p className="text-xs text-muted-foreground">Powered by Unsplash</p>
          </div>
          <div className="relative w-64">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSearched(true); }}
              placeholder="Search Images"
              className="w-full pl-3 pr-8 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        {!searched ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ImageIcon size={36} className="text-indigo-400 mb-3" />
            <div className="text-sm font-medium text-foreground">Search Millions of Hi-Resolution Images</div>
            <div className="text-xs text-muted-foreground mt-1">Or click to upload your own jpg, png, gif or svg - 100 MB or less</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 tv-scroll overflow-auto" style={{ maxHeight: "56vh" }}>
            {stockImages.map((img) => (
              <div key={img.id} className="tv-img-tile" style={{ background: `linear-gradient(160deg, ${img.hue}, #1f2937)` }} onClick={() => onPick(img.hue)}>
                <span className="relative z-10 bg-black/40 rounded px-1.5 py-0.5">Photo by {img.by}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
