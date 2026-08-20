"use client";

import { BRAND_NAME } from "@/lib/brand";
import { focusLandingSearch } from "@/components/landing/numbers/numbers-landing-page";

const PROMPTS = [
  "I want an easy 571 number under $15",
  "Find me a roofing number in Virginia.",
  "Show me numbers with 777 or 888",
];

export function LandingAiPrompts() {
  return (
    <aside className="nl-ai-prompts">
      <h3 className="text-[15px] font-bold text-[#0f172a]">Try asking {BRAND_NAME}</h3>
      <div className="mt-4 space-y-2.5">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={focusLandingSearch}
            className="nl-ai-prompt-chip"
          >
            {prompt}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-[#64748b]">AI finds what you want, fast.</p>
    </aside>
  );
}
