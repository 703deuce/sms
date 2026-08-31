"use client";

import { useState } from "react";
import { Smartphone, ArrowLeft, MessageSquare, Copy, Check, MousePointerClick } from "lucide-react";
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
        <div className="ttj-success-card">
          <div className="ttj-info-illustration"><Smartphone size={40} /></div>
          <h3>Here's Your Link</h3>
          <div className="ttj-link-display">
            <span>{link.url}</span>
            <button className="ttj-icon-btn" onClick={copy}>
              {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
            </button>
          </div>
          <div className="ttj-success-actions">
            <button className="ttj-link-btn" onClick={onBack}><ArrowLeft size={13} /> Back to Links</button>
            <button className="ttj-link-btn" onClick={() => setTesting(!testing)}>
              <MessageSquare size={13} /> Text the Link
            </button>
          </div>
        </div>

        {testing && (
          <div className="ttj-phone">
            <div className="ttj-phone-notch" />
            <div className="ttj-phone-header">
              <div className="ttj-phone-avatar">+1</div>
              <div>
                <div className="ttj-phone-num">+1 (888) 379-4654</div>
                <div className="ttj-phone-sub">Text Message · SMS · Today 10:30 AM</div>
              </div>
            </div>
            <div className="ttj-phone-body">
              <div className="ttj-bubble sent">{link.keyword}</div>
              <div className="ttj-bubble received">Thanks for subscribing!</div>
            </div>
            <div className="ttj-phone-input">Text Message · SMS</div>
          </div>
        )}
      </div>
    </div>
  );
}
