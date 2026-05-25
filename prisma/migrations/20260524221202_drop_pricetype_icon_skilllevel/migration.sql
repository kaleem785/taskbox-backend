-- Drop unused Service columns: bookable price/duration semantics moved to
-- ServiceVariant, so PriceType no longer applies; skillLevel was never
-- customer-facing; icon was redundant with imageUrl (Category carries the icon).
ALTER TABLE "services" DROP COLUMN "priceType";
ALTER TABLE "services" DROP COLUMN "icon";
ALTER TABLE "services" DROP COLUMN "skillLevel";

-- Enum types are now unreferenced.
DROP TYPE "PriceType";
DROP TYPE "SkillLevel";
