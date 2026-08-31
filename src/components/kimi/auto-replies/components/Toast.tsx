import { CheckCircle2 } from "lucide-react";

export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="tv-toast">
      <CheckCircle2 size={16} />
      {message}
    </div>
  );
}
