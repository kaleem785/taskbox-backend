-- Drop Service.durationUnit: all durations are stored in minutes (matching
-- ServiceVariant.duration), formatted for display in the UI. The unit column was
-- redundant and created a parent/child mismatch (variants are minutes-only).
ALTER TABLE "services" DROP COLUMN "durationUnit";

-- Enum type is now unreferenced.
DROP TYPE "DurationUnit";
