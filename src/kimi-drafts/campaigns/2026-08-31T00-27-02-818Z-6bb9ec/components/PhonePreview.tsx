export default function PhonePreview({ message, label }: { message: string; label: string }) {
  const renderMessage = (text: string) => {
    const urlRe = /(stxt\.io\/\S+|www\.\S+)/g;
    const parts = text.split(urlRe);
    return parts.map((p, i) => (urlRe.test(p) ? <a key={i} className="underline">{p}</a> : <span key={i}>{p}</span>));
  };
  return (
    <div className="flex flex-col items-center">
      <span className="text-[12px] font-semibold text-[#3f4bd8] bg-[#eef0fd] px-3 py-1 rounded-full mb-3">{label}</span>
      <div className="tv-phone">
        <div className="w-16 h-1.5 bg-[#eef0f5] rounded-full mx-auto mb-5" />
        {message ? (
          <div className="tv-bubble max-w-[92%]">{renderMessage(message)}</div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[12px] text-[#9aa1b5]">Your message preview will appear here</div>
        )}
      </div>
    </div>
  );
}
