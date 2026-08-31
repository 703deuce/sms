export default function PhonePreview({ message, label = "Message Preview" }: { message: string; label?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[11.5px] font-semibold tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1 mb-4">
        {label}
      </span>
      <div className="phone-frame">
        <div className="mt-9 space-y-2">
          {message ? (
            <div key={message} className="sms-bubble whitespace-pre-wrap">{message}</div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <p className="text-[11.5px] text-slate-400">Your message will appear here as you type.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
