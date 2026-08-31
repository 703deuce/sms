export default function PhonePreview({ message, label = "Message Preview" }: { message: string; label?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-full px-3 py-1 mb-4">{label}</span>
      <div className="phone-frame">
        <div className="mt-8">
          {message ? (
            <div className="sms-bubble whitespace-pre-wrap">{message}</div>
          ) : (
            <div className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}
