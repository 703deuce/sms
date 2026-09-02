export default function PhonePreview({
  message,
  label = "Message Preview",
  mediaUrls = [],
}: {
  message: string;
  label?: string;
  mediaUrls?: string[];
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="mb-4 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1 text-[11.5px] font-semibold tracking-wide text-indigo-600">
        {label}
      </span>
      <div className="phone-frame">
        <div className="mt-9 space-y-2 px-1">
          {message || mediaUrls.length > 0 ? (
            <div key={message} className="sms-bubble whitespace-pre-wrap">
              {message ? <p>{message}</p> : null}
              {mediaUrls.length > 0 ? (
                <div className={`flex flex-wrap gap-1.5 ${message ? "mt-2" : ""}`}>
                  {mediaUrls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/40"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-1 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
              <p className="text-[11.5px] leading-relaxed text-slate-400">
                Your message will appear here as you type.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
