-- Promote HomeSection from an enum to a first-class entity (admin add + reorder).
-- HomeFeature: replace `section` enum FK with `sectionId` FK, rename slotOrder → displayOrder.

-- 1. New table for sections.
CREATE TABLE "home_sections" (
  "id"           TEXT          NOT NULL,
  "slug"         TEXT          NOT NULL,
  "name"         TEXT          NOT NULL,
  "description"  TEXT,
  "displayOrder" INTEGER       NOT NULL DEFAULT 0,
  "active"       BOOLEAN       NOT NULL DEFAULT true,
  "validFrom"    TIMESTAMP(3),
  "validUntil"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "home_sections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "home_sections_slug_key"           ON "home_sections" ("slug");
CREATE INDEX        "home_sections_active_displayOrder_idx" ON "home_sections" ("active", "displayOrder");

-- 2. Seed the two starter sections so existing HomeFeature rows can be backfilled.
--    Stable hand-picked ids so future code/seed runs can rely on them.
INSERT INTO "home_sections" ("id", "slug", "name", "displayOrder", "updatedAt") VALUES
  ('hs_top_services', 'top-services', 'Top Services',   0, CURRENT_TIMESTAMP),
  ('hs_recommended',  'recommended',  'Recommended for you', 1, CURRENT_TIMESTAMP);

-- 3. Add sectionId column to home_features (nullable for now so we can backfill).
ALTER TABLE "home_features" ADD COLUMN "sectionId" TEXT;

-- 4. Backfill from the old enum value.
UPDATE "home_features" SET "sectionId" = 'hs_top_services' WHERE "section" = 'TOP_SERVICES';
UPDATE "home_features" SET "sectionId" = 'hs_recommended'  WHERE "section" = 'RECOMMENDED';

-- 5. Drop the old unique + index that referenced the section enum column.
--    Both were created as plain indexes (not table constraints), so DROP INDEX.
DROP INDEX "home_features_section_serviceId_key";
DROP INDEX "home_features_section_slotOrder_idx";

-- 6. Drop the old section column and rename slotOrder → displayOrder.
ALTER TABLE "home_features" DROP COLUMN "section";
ALTER TABLE "home_features" RENAME COLUMN "slotOrder" TO "displayOrder";

-- 7. Now the backfilled sectionId can be made NOT NULL, with FK + new unique/index.
ALTER TABLE "home_features" ALTER COLUMN "sectionId" SET NOT NULL;
ALTER TABLE "home_features"
  ADD CONSTRAINT "home_features_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "home_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "home_features_sectionId_serviceId_key"     ON "home_features" ("sectionId", "serviceId");
CREATE INDEX        "home_features_sectionId_displayOrder_idx"  ON "home_features" ("sectionId", "displayOrder");

-- 8. Drop the now-unused enum type.
DROP TYPE "HomeSection";

-- 9. Extend ActivityEntityType with the new entity.
ALTER TYPE "ActivityEntityType" ADD VALUE 'HOME_SECTION';
