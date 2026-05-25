-- CreateEnum
CREATE TYPE "HomeSection" AS ENUM ('TOP_SERVICES', 'RECOMMENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntityType" ADD VALUE 'CATEGORY';
ALTER TYPE "ActivityEntityType" ADD VALUE 'SERVICE';
ALTER TYPE "ActivityEntityType" ADD VALUE 'SERVICE_VARIANT';
ALTER TYPE "ActivityEntityType" ADD VALUE 'PACKAGE';
ALTER TYPE "ActivityEntityType" ADD VALUE 'TAB';
ALTER TYPE "ActivityEntityType" ADD VALUE 'BADGE';
ALTER TYPE "ActivityEntityType" ADD VALUE 'HOME_FEATURE';

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_subCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "sub_categories" DROP CONSTRAINT "sub_categories_categoryId_fkey";

-- DropIndex
DROP INDEX "services_subCategoryId_idx";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "packageId" TEXT,
ADD COLUMN     "serviceVariantId" TEXT;

-- AlterTable
ALTER TABLE "services" DROP COLUMN "highlightOnHome",
DROP COLUMN "subCategoryId",
ADD COLUMN     "badgeId" TEXT;

-- DropTable
DROP TABLE "sub_categories";

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_variants" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_tabs" (
    "variantId" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_tabs_pkey" PRIMARY KEY ("variantId","tabId")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "originalPrice" DECIMAL(12,2),
    "duration" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_items" (
    "packageId" TEXT NOT NULL,
    "serviceVariantId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "package_items_pkey" PRIMARY KEY ("packageId","serviceVariantId")
);

-- CreateTable
CREATE TABLE "home_features" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "section" "HomeSection" NOT NULL,
    "slotOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badges_slug_key" ON "badges"("slug");

-- CreateIndex
CREATE INDEX "badges_active_displayOrder_idx" ON "badges"("active", "displayOrder");

-- CreateIndex
CREATE INDEX "service_variants_serviceId_displayOrder_idx" ON "service_variants"("serviceId", "displayOrder");

-- CreateIndex
CREATE INDEX "service_variants_active_idx" ON "service_variants"("active");

-- CreateIndex
CREATE UNIQUE INDEX "tabs_slug_key" ON "tabs"("slug");

-- CreateIndex
CREATE INDEX "tabs_active_displayOrder_idx" ON "tabs"("active", "displayOrder");

-- CreateIndex
CREATE INDEX "variant_tabs_tabId_idx" ON "variant_tabs"("tabId");

-- CreateIndex
CREATE INDEX "packages_serviceId_displayOrder_idx" ON "packages"("serviceId", "displayOrder");

-- CreateIndex
CREATE INDEX "packages_active_idx" ON "packages"("active");

-- CreateIndex
CREATE INDEX "package_items_packageId_idx" ON "package_items"("packageId");

-- CreateIndex
CREATE INDEX "package_items_serviceVariantId_idx" ON "package_items"("serviceVariantId");

-- CreateIndex
CREATE INDEX "home_features_section_slotOrder_idx" ON "home_features"("section", "slotOrder");

-- CreateIndex
CREATE INDEX "home_features_active_idx" ON "home_features"("active");

-- CreateIndex
CREATE UNIQUE INDEX "home_features_section_serviceId_key" ON "home_features"("section", "serviceId");

-- CreateIndex
CREATE INDEX "bookings_serviceVariantId_idx" ON "bookings"("serviceVariantId");

-- CreateIndex
CREATE INDEX "bookings_packageId_idx" ON "bookings"("packageId");

-- CreateIndex
CREATE INDEX "services_badgeId_idx" ON "services"("badgeId");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_tabs" ADD CONSTRAINT "variant_tabs_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "service_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_tabs" ADD CONSTRAINT "variant_tabs_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "service_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_features" ADD CONSTRAINT "home_features_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "service_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Raw SQL (not expressible in Prisma schema language)
-- ─────────────────────────────────────────────────────────────────────────────

-- Same-service constraint for package items, enforced at the DB level via
-- composite FKs. Supporting composite UNIQUE indexes are required as FK targets.
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_id_serviceId_key" UNIQUE ("id", "serviceId");
ALTER TABLE "packages"         ADD CONSTRAINT "packages_id_serviceId_key"         UNIQUE ("id", "serviceId");

ALTER TABLE "package_items"
  ADD CONSTRAINT "package_items_variant_same_service_fk"
  FOREIGN KEY ("serviceVariantId", "serviceId") REFERENCES "service_variants"("id", "serviceId");
ALTER TABLE "package_items"
  ADD CONSTRAINT "package_items_package_same_service_fk"
  FOREIGN KEY ("packageId", "serviceId") REFERENCES "packages"("id", "serviceId");

-- Booking XOR invariant: exactly one of serviceVariantId / packageId is set.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_variant_xor_package"
  CHECK (("serviceVariantId" IS NOT NULL) <> ("packageId" IS NOT NULL));
