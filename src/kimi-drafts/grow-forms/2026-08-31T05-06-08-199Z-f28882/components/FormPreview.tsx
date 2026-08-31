"use client";

import { useState } from "react";
import { ChevronLeft, MessageSquareText, Send } from "lucide-react";
import { builderDefaults } from "../mock-data";

export function FormPreview({
  heading, subheading, onExit,
}: {
  heading: string;
  subheading: string;
  onExit: () => void;
}) {
  const [step, setStep] = useState<"form" | "success" | "phone">("form");
  const [replied, setReplied] = useState(false);

  if (step === "phone") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black/80 p-6">
        <div className="w-[340px] overflow-hidden rounded-[36px] border-[6px] border-gray-800 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gray-50 px-5 py-2 text-[11px] font-semibold text-gray-800">
            <span>10:55</span>
            <span className="h-4 w-16 rounded-full bg-black" />
            <span className="text-gray-400">•••</span>
          </div>
          <div className="border-b border-gray-100 px-4 py-2.5 text-center">
            <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-500">+1</div>
            <div className="text-[11px] text-gray-500">+1 (888) 379-4654</div>
          </div>
          <div className="min-h-[340px] space-y-3 bg-white p-4">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-[12px] leading-snug text-gray-800">
              {builderDefaults.doubleOptIn}
            </div>
            {replied && (
              <>
                <div className="ml-auto max-w-[60%] rounded-2xl rounded-tr-sm bg-green-500 px-3.5 py-2 text-[12px] text-white">Yes</div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-[12px] leading-snug text-gray-800">
                  {builderDefaults.optIn}
                  <div className="mt-1.5 text-[10px] text-gray-400">
                    Msg & data rates may apply. Msg frequency varies. Text STOP to stop, HELP for help. Terms & Privacy: tvxt.co/2y3496194
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2.5">
            <div className="flex-1 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] text-gray-400">Text Message · SMS</div>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white"
              onClick={() => setReplied(true)}
              title="Reply YES"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
        <button className="tv-btn-ghost fixed left-6 top-6" onClick={onExit}>
          <ChevronLeft size={14} className="mr-1 inline" /> Back to Builder
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <button className="tv-btn-ghost fixed left-6 top-6 z-10 shadow-sm" onClick={onExit}>
        <ChevronLeft size={14} className="mr-1 inline" /> Back to Builder
      </button>
      <div className="grid min-h-screen grid-cols-2">
        <div className="flex flex-col items-center justify-center bg-[#2f4a37] p-12">
          {step === "form" ? (
            <div className="w-full max-w-[420px]">
              <h1 className="text-center text-[28px] font-bold text-white">{heading}</h1>
              <p className="mt-2 text-center text-[13px] text-white/80">{subheading}</p>
              <div className="mt-7 grid grid-cols-2 gap-3">
                <input className="rounded bg-white/95 px-3.5 py-3 text-[13px] outline-none" placeholder="First Name" />
                <input className="rounded bg-white/95 px-3.5 py-3 text-[13px] outline-none" placeholder="Last Name" />
              </div>
              <input className="mt-3 w-full rounded bg-white/95 px-3.5 py-3 text-[13px] outline-none" placeholder="Mobile Number" />
              <input className="mt-3 w-full rounded bg-white/95 px-3.5 py-3 text-[13px] outline-none" placeholder="Email (Optional)" />
              <button
                className="mt-4 w-full rounded bg-[#c8b291] py-3.5 text-[14px] font-semibold tracking-wide text-[#2b2b22] hover:brightness-105"
                onClick={() => setStep("success")}
              >
                Join Now
              </button>
              <p className="mt-4 text-[9px] leading-relaxed text-white/50">{builderDefaults.compliance}</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                <MessageSquareText size={24} className="text-white/85" />
              </div>
              <h1 className="text-[26px] font-bold text-white">Check Your Texts</h1>
              <p className="mx-auto mt-2 max-w-[340px] text-[13px] text-white/80">
                We just sent you a message. Reply YES and we'll respond with your promo code.
              </p>
              <button className="tv-btn-primary mt-6" onClick={() => setStep("phone")}>Simulate Phone Reply</button>
            </div>
          )}
        </div>
        <div
          className="relative"
          style={{ background: "linear-gradient(150deg,#5c7263,#2c3d30)" }}
        >
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 25% 20%, rgba(255,255,255,.18), transparent 45%), radial-gradient(circle at 75% 80%, rgba(0,0,0,.25), transparent 55%), radial-gradient(circle at 60% 30%, rgba(210,180,140,.25), transparent 35%)",
          }} />
          <div className="absolute bottom-4 left-4 rounded bg-black/40 px-2 py-1 text-[10px] text-white/80">
            Café photo — Patchwork Coffee Co.
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmbedSitePreview({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-8 py-4">
        <div className="flex items-center gap-4">
          <button className="rounded bg-white px-3 py-1 text-[11px] font-bold text-black" onClick={onExit}>EXIT</button>
          <span className="text-[15px] font-bold">Transovo Tutorials</span>
        </div>
        <div className="flex items-center gap-6 text-[13px] text-white/70">
          <span>Services</span><span>Work</span><span>About</span>
          <span>Login</span>
          <button className="rounded border border-white/30 px-3 py-1.5 text-[12px]">Contact Me</button>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-10 px-8 py-14">
        <div>
          <h1 className="text-center text-[28px] font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Want 20% Off?</h1>
          <p className="mt-2 text-center text-[12px] text-white/70">{builderDefaults.embed.subheading}</p>
          <div className="mx-auto mt-6 max-w-[400px] space-y-3">
            <input className="w-full rounded bg-white px-3.5 py-3 text-[13px] text-gray-800 outline-none" placeholder="First Name" />
            <input className="w-full rounded bg-white px-3.5 py-3 text-[13px] text-gray-800 outline-none" placeholder="Last Name" />
            <input className="w-full rounded bg-white px-3.5 py-3 text-[13px] text-gray-800 outline-none" placeholder="Mobile Number" />
            <input className="w-full rounded bg-white px-3.5 py-3 text-[13px] text-gray-800 outline-none" placeholder="Email" />
            <button className="w-full rounded bg-white py-3.5 text-[13px] font-semibold text-black hover:bg-gray-100">Join Now</button>
            <p className="text-[8px] leading-relaxed text-white/40">{builderDefaults.compliance}</p>
          </div>
        </div>
        <div
          className="min-h-[380px] rounded"
          style={{ background: "linear-gradient(160deg,#7fa8c9 0%,#3d5a3a 65%,#22301f 100%)" }}
        >
          <div className="flex h-full items-end p-4">
            <span className="rounded bg-black/40 px-2 py-1 text-[10px] text-white/80">Palm trees image section</span>
          </div>
        </div>
      </div>
    </div>
  );
}
