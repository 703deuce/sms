"use client";

export default function PhonePreview({ keyword, message }: { keyword: string; message: string }) {
  return (
    <div>
      <div className="tv-phone-title">Message Preview</div>
      <div className="tv-phone">
        <div className="tv-bubble-out">{keyword}</div>
        <div className="tv-bubble-in">
          {message}
          {"\n\n"}Msg &amp; data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms &amp; Privacy: s.trnsv.io/tc2bd00b.
        </div>
      </div>
    </div>
  );
}
