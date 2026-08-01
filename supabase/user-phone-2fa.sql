-- SMS 2FA / phone verification fields on User (additive).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");
