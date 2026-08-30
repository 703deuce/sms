export default function PhonePreview({ message, title = "Message Preview" }: { message: string; title?: string }) {
  const renderMessage = (m: string) => {
    const parts = m.split(/(stxt\.io\/\S+|www\.\S+|https?:\/\/\S+)/g);
    return parts.map((p, i) =>
      /^(stxt\.io|www\.|https?:)/.test(p) ? <a key={i} className="text-blue-600 underline">{p}</a> : <span key={i}>{p}</span>
    );
  };
  return (
    <div>
      <div className="text-center text-[13px] text-indigo-600 font-medium mb-3">{title}</div>
      <div className="st-phone mx-auto">
        <div className="st-phone-screen flex flex-col">
          {message ? (
            <div className="st-bubble st-fade whitespace-pre-wrap">{renderMessage(message)}</div>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </div>
  );
}
