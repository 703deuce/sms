"use client";
import { useState } from "react";

export default function LinkTracker({ url, onShorten, onSkip }: { url: string; onShorten: (shortUrl: string) => void; onSkip: () => void }) {
  const [stage, setStage] = useState<"ask" | "name">("ask");
  const [linkName, setLinkName] = useState("");

  return (
    <div className="st-fade border-t border-border mt-2 pt-2.5 px-1">
      {stage === "ask" ? (
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-gray-600">Track the <span className="font-medium text-gray-800">{url}</span> link?</span>
          <div className="flex gap-2">
            <button onClick={() => setStage("name")} className="text-[12.5px] font-medium text-indigo-600 border border-indigo-200 rounded-md px-3 py-1 hover:bg-indigo-50">Yes</button>
            <button onClick={onSkip} className="text-[12.5px] font-medium text-gray-500 border border-border rounded-md px-3 py-1 hover:bg-gray-50">No</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Name your link"
            className="flex-1 border-b-2 border-indigo-400 text-[13px] py-1 focus:outline-none bg-transparent"
          />
          <button
            onClick={() => linkName && onShorten("stxt.io/lea/B72c4aa521")}
            className="text-[12.5px] font-medium text-indigo-600 hover:underline"
          >Shorten</button>
          <button onClick={onSkip} className="text-[12.5px] text-gray-400 hover:underline">Cancel</button>
        </div>
      )}
    </div>
  );
}
