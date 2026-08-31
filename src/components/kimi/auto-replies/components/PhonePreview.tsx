import { complianceFooter } from "../mock-data";

export default function PhonePreview({ keyword, message }: { keyword: string; message: string }) {
  return (
    <div className="phone-preview">
      <div className="phone-preview-label">Message Preview</div>
      <div className="phone-frame">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-bubble-out">{keyword}</div>
          <div className="phone-bubble-in">
            {message}
            {"\n\n"}
            {complianceFooter}
          </div>
        </div>
        <div className="phone-home" />
      </div>
    </div>
  );
}
