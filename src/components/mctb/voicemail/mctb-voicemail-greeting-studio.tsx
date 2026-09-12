"use client";

import { PersonalGreetingControls } from "@/components/personal/personal-greeting-controls";
import { buildMctbGreetingLibrary } from "@/lib/mctb/voicemail-greeting-library";
import type { PersonalVoicemailBox } from "@/lib/personal/voicemail-mappers";
import { Play, X } from "lucide-react";
import { useMemo, useRef } from "react";

type Props = {
  open: boolean;
  mode: "create" | "change";
  box: PersonalVoicemailBox | null;
  onClose: () => void;
  onSaveText: (text: string) => Promise<void>;
  onSaveUrl: (url: string) => Promise<void>;
  onUseDefault: () => Promise<void>;
};

export function MctbVoicemailGreetingStudio({
  open,
  mode,
  box,
  onClose,
  onSaveText,
  onSaveUrl,
  onUseDefault,
}: Props) {
  const library = useMemo(() => buildMctbGreetingLibrary(box), [box]);
  const libraryPreviewRef = useRef<HTMLAudioElement>(null);

  if (!open) return null;

  function previewEntry(url: string | null) {
    if (!url) return;
    const audio = libraryPreviewRef.current;
    if (!audio) return;
    audio.src = url;
    void audio.play().catch(() => undefined);
  }

  return (
    <>
      <div className="mctb-vm-drawer-backdrop" onClick={onClose} role="presentation" />
      <div className="mctb-vm-studio" role="dialog" aria-labelledby="mctb-vm-studio-title">
        <header className="mctb-vm-studio__head">
          <div>
            <h2 id="mctb-vm-studio-title" className="mctb-vm-studio__title">
              {mode === "create" ? "Create voicemail greeting" : "Change voicemail greeting"}
            </h2>
            <p className="mctb-vm-studio__sub">Choose how callers hear your voicemail greeting.</p>
          </div>
          <button type="button" className="mctb-vm-studio__close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mctb-vm-studio__body">
          <PersonalGreetingControls
            greetingText={box?.greetingText || "Please leave a message after the tone."}
            greetingUrl={box?.greetingUrl}
            onSaveText={onSaveText}
            onSaveUrl={onSaveUrl}
            activationMode="explicit"
            premiumTabs
            createButtonLabel="Generate preview"
            emptyHint="No custom audio active yet. Your default greeting plays until you activate a new one."
          />

          <section className="mctb-vm-studio__library" aria-labelledby="mctb-vm-library-title">
            <h3 id="mctb-vm-library-title" className="mctb-vm-studio__library-title">
              Your greetings
            </h3>
            <audio ref={libraryPreviewRef} className="hidden" />
            <ul className="mctb-vm-studio__library-list">
              {library.map((g) => (
                <li key={g.id} className="mctb-vm-studio__library-row">
                  <div className="min-w-0">
                    <p className="mctb-vm-studio__library-name">{g.label}</p>
                    <p className="mctb-vm-studio__library-meta">
                      {g.status} · {g.detail}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {g.previewUrl ? (
                      <button
                        type="button"
                        className="mctb-vm-btn mctb-vm-btn--icon"
                        aria-label={`Preview ${g.label}`}
                        onClick={() => previewEntry(g.previewUrl)}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {g.id === "default" ? (
                      <button
                        type="button"
                        className="mctb-vm-btn"
                        onClick={() => void onUseDefault()}
                      >
                        Use default
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="mctb-vm-studio__footer">
            <button type="button" className="mctb-vm-btn" onClick={() => void onUseDefault()}>
              Use default greeting
            </button>
            <button type="button" className="mctb-vm-btn mctb-vm-btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
