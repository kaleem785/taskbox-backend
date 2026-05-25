-- Drop the DB-level same-service constraint for package items. The rule is now
-- enforced solely in application code (CatalogService.assertVariantInService).
-- Removing the composite FKs also removes the un-modelable-by-Prisma constraints
-- that forced hand-written migrations, so `migrate dev` works normally again.

-- 1. Composite FKs first (they depend on the unique indexes + the column).
ALTER TABLE "package_items" DROP CONSTRAINT IF EXISTS "package_items_variant_same_service_fk";
ALTER TABLE "package_items" DROP CONSTRAINT IF EXISTS "package_items_package_same_service_fk";

-- 2. The composite UNIQUE indexes that existed only as FK targets.
ALTER TABLE "service_variants" DROP CONSTRAINT IF EXISTS "service_variants_id_serviceId_key";
ALTER TABLE "packages"         DROP CONSTRAINT IF EXISTS "packages_id_serviceId_key";

-- 3. The denormalized column itself.
ALTER TABLE "package_items" DROP COLUMN "serviceId";
