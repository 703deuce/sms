"use client";

import { useState } from "react";
import { X, Search, ImageIcon } from "lucide-react";
import { imageResults } from "../mock-data";

export default function ImageSearchModal({
  onClose, onSelect,
}: {
  onClose: () => void;
  onSelect: (hue: string) => void;
}) {
  const [q, setQ] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const doSearch = (val: string) => {
    setQ(val);
    if (val.length >= 2) {
      setSearching(true);
      setSearched(false);
      setTimeout(() => { setSearching(false); setSearched(true); }, 600);
    } else {
      setSearched(false);
    }
  };

  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div
        className="tv-modal flex h-[80vh] w-[min(1000px,92vw)] flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">Search Images</h2>
            <p className="text-[11px] text-gray-400">Powered by Unsplash</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="tv-input !w-[260px] !pl-8"
                placeholder="Search Images"
                value={q}
                onChange={(e) => doSearch(e.target.value)}
                autoFocus
              />
            </div>
            <button className="tv-icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="tv-scroll flex-1 overflow-y-auto p-6">
          {!searched && !searching && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <ImageIcon size={26} />
              </div>
              <div className="text-[14px] font-bold text-gray-900">Search Millions of Hi-Resolution Images</div>
              <p className="mt-1 text-[11px] text-gray-400">Or click to upload your own jpg, png, gif or svg - 100 MB or less</p>
            </div>
          )}
          {searching && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent" />
              <span className="text-[12px] text-gray-500">Searching Images</span>
            </div>
          )}
          {searched && (
            <div className="grid grid-cols-6 gap-4">
              {imageResults.map((img) => (
                <button key={img.id} className="group text-left" onClick={() => onSelect(String(img.hue))}>
                  <div
                    className="mb-1.5 h-[90px] rounded-lg transition-shadow group-hover:shadow-md"
                    style={{ background: `linear-gradient(150deg, hsl(${img.hue},40%,70%), hsl(${img.hue},45%,40%))` }}
                  />
                  <div className="truncate text-[10px] text-gray-400">Photo by {img.author}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
