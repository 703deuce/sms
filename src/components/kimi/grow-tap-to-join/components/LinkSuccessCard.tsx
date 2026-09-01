"use client";

import { useState } from "react";
import {
  Smartphone, ArrowLeft, MessageSquare, Copy, Check, MousePointerClick,
  ChevronLeft, Signal, Wifi, BatteryFull, CircleCheck,
} from "lucide-react";
import { TapLink } from "../mock-data";

interface Props {
  link: TapLink;
  onBack: () => void;
}

export default function LinkSuccessCard({ link, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="ttj-page">
      <div className="ttj-breadcrumb">Tools / Tap-to-Join Links / <span>Create Link</span></div>
      <div className="ttj-page-header">
        <div className="ttj-page-title-row">
          <div className="ttj-page-icon"><MousePointerClick size={20} /></div>
          <div>
            <h1>Create Link</h1>
            <p>Create a Tap-to-Join link.</p>
          </div>
        </div>
      </div>

      <div className="ttj-success-wrap">
        <div className="ttj-success-card rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="ttj-info-illustration relative">
            <Smartphone size={40} />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <CircleCheck size={12} />
            </span>
          </div>
          <h3>Here&apos;s Your Link</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">Share it anywhere — social posts, emails, or your bio.</p>
          <div className="ttj-link-display">
            <span className="truncate font-medium">{link.url}</span>
            <button
              className="ttj-icon-btn"
              onClick={copy}
              aria-label="Copy link"
              title={copied ? "Copied" : "Copy link"}
            >
              {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            </button>
          </div>
          <div className="ttj-success-actions">
            <button className="ttj-link-btn" onClick={onBack}><ArrowLeft size={13} /> Back to Links</button>
            <button className="ttj-link-btn" onClick={() => setTesting(!testing)}>
              <MessageSquare size={13} /> {testing ? "Hide Preview" : "Text the Link"}
            </button>
          </div>
        </div>

        {testing && (
          <div className="ttj-phone">
            <div className="ttj-phone-screen">
              <div className="ttj-phone-notch" />
              <div className="ttj-phone-statusbar">
                <span>10:30</span>
                <span className="ttj-phone-statusbar-icons">
                  <Signal size={12} />
                  <Wifi size={12} />
                  <BatteryFull size={14} />
                </span>
              </div>
              <div className="ttj-phone-header">
                <span className="ttj-phone-back"><ChevronLeft size={18} /></span>
                <div className="ttj-phone-header-center">
                  <div className="ttj-phone-avatar">+1</div>
                  <div className="ttj-phone-num">+1 (888) 379-4654</div>
                </div>
                <span style={{ width: 18 }} />
              </div>
              <div className="ttj-phone-body">
                <div className="ttj-phone-time">Text Message · SMS · Today 10:30 AM</div>
                <div className="ttj-bubble sent">{link.keyword}</div>
                <div className="ttj-bubble received">Thanks for subscribing!</div>
              </div>
              <div className="ttj-phone-input">
                <span>Text Message · SMS</span>
              </div>
              <div className="ttj-phone-home" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
