"use client";

import { complianceFooter } from "../mock-data";

export default function PhonePreview({
  keyword,
  message,
}: {
  keyword: string;
  message: string;
}) {
  return (
    <div style={{ position: "sticky", top: 8, width: 300, flexShrink: 0 }}>
      <div className="kw-preview-label">Message Preview</div>
      <div className="kw-phone">
        {/* Status bar */}
        <div className="kw-phone-status">
          <span>9:41</span>
          <div className="kw-phone-notch" />
          <span className="kw-phone-signal">
            <span style={{ height: 4 }} />
            <span style={{ height: 6 }} />
            <span style={{ height: 8 }} />
            <span style={{ height: 10 }} />
          </span>
        </div>
        {/* Conversation header */}
        <div className="kw-phone-header">
          <div className="kw-phone-avatar">T</div>
          <span>Transovo</span>
        </div>

        <div className="kw-phone-thread">
          {keyword ? (
            <>
              <div className="kw-bubble-out kw-fade">{keyword}</div>
              <div className="kw-bubble-time">Delivered</div>
            </>
          ) : null}
          {message ? (
            <div className="kw-bubble-in kw-fade">
              {message}
              {"\n\n"}
              <span style={{ color: "#9aa0b8", fontSize: 11.5 }}>
                {complianceFooter}
              </span>
            </div>
          ) : null}
          {!keyword && !message && (
            <div className="kw-phone-empty">
              Start typing to preview how your keyword conversation will look on a
              subscriber&apos;s phone.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
