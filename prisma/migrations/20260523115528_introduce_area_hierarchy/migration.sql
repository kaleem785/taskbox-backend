-- Drop & recreate zone hierarchy: introduce Area between City and Zone.
-- Existing zones / partner_zones / customer_addresses.assigned_zone_id are wiped (dev data only).

-- 1) Wipe data tied to the existing flat zone model.
DELETE FROM "partner_zones";
UPDATE "customer_addresses" SET "assignedZoneId" = NULL;
DELETE FROM "zones";

-- 2) Drop FKs/indexes/constraints that depend on the old zones.cityId shape.
ALTER TABLE "zones" DROP CONSTRAINT "zones_cityId_fkey";
DROP INDEX "zones_cityId_idx";
DROP INDEX "zones_cityId_name_key";
ALTER TABLE "zones" DROP COLUMN "cityId";

-- 3) Create the new Area level.
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "areas_cityId_idx" ON "areas"("cityId");
CREATE UNIQUE INDEX "areas_cityId_name_key" ON "areas"("cityId", "name");

ALTER TABLE "areas" ADD CONSTRAINT "areas_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Re-parent zones under areas.
ALTER TABLE "zones" ADD COLUMN "areaId" TEXT NOT NULL;

CREATE INDEX "zones_areaId_idx" ON "zones"("areaId");
CREATE UNIQUE INDEX "zones_areaId_name_key" ON "zones"("areaId", "name");

ALTER TABLE "zones" ADD CONSTRAINT "zones_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
