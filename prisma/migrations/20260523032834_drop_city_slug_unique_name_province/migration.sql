-- DropIndex
DROP INDEX "cities_slug_key";

-- AlterTable
ALTER TABLE "cities" DROP COLUMN "slug";

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_province_key" ON "cities"("name", "province");
