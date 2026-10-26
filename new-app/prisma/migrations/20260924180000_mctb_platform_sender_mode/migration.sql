-- CreateEnum
CREATE TYPE "MctbSenderMode" AS ENUM ('WORKSPACE', 'PLATFORM');

-- AlterTable
ALTER TABLE "missed_call_text_configs" ADD COLUMN "senderMode" "MctbSenderMode" NOT NULL DEFAULT 'WORKSPACE';
