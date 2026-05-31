-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('Standard', 'Premium', 'Elite');

-- AlterTable: convert partners.tier from TEXT to the PartnerTier enum (existing
-- values are NULL or one of the enum labels, so the cast is lossless).
ALTER TABLE "partners"
  ALTER COLUMN "tier" TYPE "PartnerTier" USING "tier"::"PartnerTier";

-- AlterTable: manual-add partners are verified by default now.
ALTER TABLE "partners" ALTER COLUMN "verified" SET DEFAULT true;
