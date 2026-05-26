-- Rename Category.imageUrl → Category.iconUrl. The column has always held a flat
-- icon in practice; this aligns the schema name with reality. Plain RENAME so
-- existing values (seed and any prod data) are preserved.
ALTER TABLE "categories" RENAME COLUMN "imageUrl" TO "iconUrl";
