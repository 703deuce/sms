"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  contactId: string;
  phone?: string;
};

/** Opens canonical Inbox thread for this contact (existing or new compose). */
export function ContactMessageAction({ contactId }: Props) {
  const href = `/conversations?contactId=${encodeURIComponent(contactId)}`;

  return (
    <Link href={href} className="inline-flex">
      <Button variant="outline" size="sm" type="button">
        <MessageSquare className="h-4 w-4" aria-hidden />
        Message
      </Button>
    </Link>
  );
}
