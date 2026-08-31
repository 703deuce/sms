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
    <div style={{ position: "sticky", top: 0 }}>
      <div
        style={{
          textAlign: "center",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "#6a708c",
          marginBottom: 12,
        }}
      >
        Message Preview
      </div>
      <div className="kw-phone">
        <div
          style={{
            width: 90,
            height: 5,
            borderRadius: 99,
            background: "#e6e8f2",
            margin: "0 auto 18px",
          }}
        />
        {keyword && <div className="kw-bubble-out kw-fade">{keyword}</div>}
        {message && (
          <div className="kw-bubble-in kw-fade">
            {message}
            {"\n\n"}
            {complianceFooter}
          </div>
        )}
      </div>
    </div>
  );
}
