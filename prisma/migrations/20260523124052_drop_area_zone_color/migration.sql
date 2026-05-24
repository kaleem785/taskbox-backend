-- Drop the optional `color` column from areas and zones; admin UI no longer
-- supports per-area / per-zone color tagging.

ALTER TABLE "areas" DROP COLUMN "color";
ALTER TABLE "zones" DROP COLUMN "color";
