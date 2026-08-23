import { cn } from "@/lib/utils";

type SocialIconProps = {
  className?: string;
};

export function InstagramIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function FacebookIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14 8.5h2.5l-.5 3H14v9h-3v-9H9V8.5h2V6.8C11 5.2 12.1 4 14.2 4H16v3h-1.5c-.8 0-1 .4-1 1v.5z" />
    </svg>
  );
}

export function TwitterIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.9 7.5h2.1l-4.6 5.2 5.4 7.3h-4.2l-3.3-4.3-3.8 4.3H4.5l4.9-5.6L4.2 7.5h4.3l3 3.9 3.4-3.9zm-.7 12.1h1.2L7.1 8.6H5.8l12.4 13z" />
    </svg>
  );
}

export function PinterestIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 4c-4.4 0-8 3.4-8 7.6 0 2.9 1.8 5.5 4.5 6.7-.1-.6-.1-1.5.2-2.2.2-.8 1.4-5.3 1.4-5.3s-.4-.8-.4-2c0-1.9 1.1-3.3 2.5-3.3 1.2 0 1.7.9 1.7 2 0 1.2-.8 3-1.2 4.6-.3 1.4.7 2.5 2 2.5 2.4 0 4.2-2.5 4.2-6.1 0-3.2-2.3-5.4-5.6-5.4-3.8 0-6 2.8-6 5.8 0 1.1.4 2.3 1 2.9.1.1.1.2.1.3l-.4 1.5c0 .2-.1.2-.3.1-1.1-.5-1.8-2.1-1.8-3.8 0-3.1 2.2-6 6.6-6 3.5 0 6.2 2.5 6.2 5.9 0 3.5-2.2 6.3-5.3 6.3-1 0-2-.5-2.3-1.2l-.6 2.3c-.2.8-.8 1.8-1.2 2.4.9.3 1.9.4 2.9.4 4.4 0 8-3.4 8-7.6C20 7.4 16.4 4 12 4z" />
    </svg>
  );
}

export function TikTokIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.5 5.2c.9 1.2 2.2 2 3.7 2.1v2.8c-1.3 0-2.5-.4-3.5-1.1v6.4c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.3 0 .7 0 1 .1v3.1c-.3-.1-.7-.1-1-.1-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3V2h2.8c.1 1.2.6 2.3 1.5 3.2z" />
    </svg>
  );
}

export function YoutubeIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 003.4 7.2 26 26 0 003 12a26 26 0 00.4 4.8 2.5 2.5 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8A26 26 0 0021 12a26 26 0 00-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z" />
    </svg>
  );
}

export function WebsiteIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 6.2 3.8 9s-1.3 6.3-3.8 9M12 3c-2.5 2.7-3.8 6.2-3.8 9s1.3 6.3 3.8 9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function LocationIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function BookingIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function SocialLinkIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const iconClass = cn("h-5 w-5", className);
  switch (type) {
    case "facebook":
      return <FacebookIcon className={iconClass} />;
    case "instagram":
      return <InstagramIcon className={iconClass} />;
    case "twitter":
      return <TwitterIcon className={iconClass} />;
    case "pinterest":
      return <PinterestIcon className={iconClass} />;
    case "tiktok":
      return <TikTokIcon className={iconClass} />;
    case "youtube":
      return <YoutubeIcon className={iconClass} />;
    case "website":
      return <WebsiteIcon className={iconClass} />;
    case "booking":
      return <BookingIcon className={iconClass} />;
    default:
      return <WebsiteIcon className={iconClass} />;
  }
}
