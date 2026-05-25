-- Drop Category.icon / Category.color / Category.priceRangeMin / Category.priceRangeMax:
-- categories now render with a per-category PNG illustration (Category.imageUrl) to
-- match the customer mobile app. Icon/color pickers and manual price-range fields are
-- gone from the admin UI; price range is derived from underlying services when needed.
ALTER TABLE "categories" DROP COLUMN "icon";
ALTER TABLE "categories" DROP COLUMN "color";
ALTER TABLE "categories" DROP COLUMN "priceRangeMin";
ALTER TABLE "categories" DROP COLUMN "priceRangeMax";
