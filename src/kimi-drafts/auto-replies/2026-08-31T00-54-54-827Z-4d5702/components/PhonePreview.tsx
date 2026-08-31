import { complianceFooter } from "../mock-data";

export default function PhonePreview({ keyword, message }: { keyword: string; message: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-foreground">Message Preview</span>
      </div>
      <div className="phone-frame">
        <div className="phone-screen">
          <div className="phone-bubble-out">{keyword}</div>
          <div className="phone-bubble-in">
            {message}
            {"\n\n"}
            {complianceFooter}
          </div>
        </div>
      </div>
    </div>
  );
}
