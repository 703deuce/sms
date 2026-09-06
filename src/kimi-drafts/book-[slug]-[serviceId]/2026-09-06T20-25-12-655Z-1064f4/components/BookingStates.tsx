import { Button, Card, Spinner } from "./ui";
import { CalendarX, RefreshCcw } from "lucide-react";

export function BookingLoading() {
  return (
    <div className="booking-shell flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="skeleton-shimmer h-8 w-40" />
          <div className="skeleton-shimmer h-4 w-64" />
        </div>
        <Card className="p-6">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div className="flex-1 space-y-2">
                  <div className="skeleton-shimmer h-4 w-40" />
                  <div className="skeleton-shimmer h-3 w-full max-w-xs" />
                  <div className="skeleton-shimmer h-3 w-32" />
                </div>
                <div className="skeleton-shimmer h-7 w-7 rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-center">
            <Spinner label="Loading booking page…" />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function BookingError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="booking-shell flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <CalendarX className="h-5 w-5" />
        </div>
        <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
          We couldn't load this booking page
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {message || "The link may have expired or the page is temporarily unavailable. Try again in a moment."}
        </p>
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4" /> Try again
        </Button>
      </Card>
    </div>
  );
}

export function BookingNotFound() {
  return (
    <div className="booking-shell flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <CalendarX className="h-5 w-5" />
        </div>
        <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
          This booking link is no longer active
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          The business may have disabled this page, or the link was single-use. Contact the business directly to book.
        </p>
      </Card>
    </div>
  );
}

export function ServiceEmptyState() {
  return (
    <div className="fade-in py-10 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <CalendarX className="h-5 w-5" />
      </div>
      <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
        No services available right now
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-foreground">
        This business hasn't published any bookable services yet. Please check back soon or contact the business directly.
      </p>
    </div>
  );
}
