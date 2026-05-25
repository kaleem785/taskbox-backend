-- Booking → ServiceVariant / Package were implicitly ON DELETE SET NULL (Prisma's
-- default for optional relations). On a hard-delete that would null the FK and
-- violate the XOR CHECK. Switch to RESTRICT so the soft-delete policy is enforced
-- by the schema: a variant/package with bookings cannot be hard-deleted.
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_serviceVariantId_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceVariantId_fkey"
  FOREIGN KEY ("serviceVariantId") REFERENCES "service_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" DROP CONSTRAINT "bookings_packageId_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
