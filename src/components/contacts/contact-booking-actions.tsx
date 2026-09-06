"use client";

import { Button } from "@/components/ui/button";
import { CalendarCheck, Link2 } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  contactId: string;
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function ContactBookingActions({ contactId, phone, email, firstName, lastName }: Props) {
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const url = json.data?.bookingUrl;
        if (url) setBookingUrl(url);
      })
      .catch(() => undefined);
  }, []);

  async function sendBookingLink() {
    if (!phone && !email) return;
    setLoading(true);
    try {
      await fetch("/api/contacts/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_booking_link",
          contactId,
          phone,
          email,
          bookingUrl,
        }),
      });
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {bookingUrl ? (
        <Button size="sm" variant="outline" asChild>
          <a href={bookingUrl} target="_blank" rel="noreferrer">
            <CalendarCheck className="h-3.5 w-3.5" />
            Book meeting
          </a>
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={copyLink} disabled={!bookingUrl}>
        <Link2 className="h-3.5 w-3.5" />
        {copied ? "Copied!" : "Copy booking link"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={sendBookingLink}
        disabled={loading || (!phone && !email)}
      >
        Send booking link
      </Button>
    </div>
  );
}
