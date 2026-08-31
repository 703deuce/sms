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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Search Images</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Powered by Unsplash</p>
          </div>
          <div className="relative w-64">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSearched(true); }}
              placeholder="Search Images"
              className="w-full rounded-md border border-border bg-background py-2 pl-3 pr-8 text-sm transition-shadow focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        {!searched ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
              <ImageIcon size={22} className="text-indigo-500" />
            </div>
            <div className="text-sm font-medium text-foreground">Search Millions of Hi-Resolution Images</div>
            <div className="mt-1 text-xs text-muted-foreground">Or click to upload your own jpg, png, gif or svg — 100 MB or less</div>
          </div>
        ) : (
          <div className="tv-scroll grid grid-cols-3 gap-3 overflow-auto md:grid-cols-4" style={{ maxHeight: "56vh" }}>
            {stockImages.map((img) => (
              <div
                key={img.id}
                className="tv-img-tile"
                style={{ background: `linear-gradient(160deg, ${img.hue}, #1f2937)` }}
                onClick={() => onPick(img.hue)}
              >
                <span className="relative z-10 rounded bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">Photo by {img.by}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
