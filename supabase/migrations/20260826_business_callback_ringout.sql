-- Preferred callback phone for one-click business callback (RingOut-style)

ALTER TABLE smart_routing_authorized_callers
  ADD COLUMN IF NOT EXISTS "preferredCallbackPhoneE164" TEXT;
