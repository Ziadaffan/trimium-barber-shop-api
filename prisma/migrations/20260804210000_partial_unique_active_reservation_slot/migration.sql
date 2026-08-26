-- The unconditional unique index on ("date", "barberId") also counted CANCELLED rows, so a
-- cancelled slot stayed locked forever: availability offered it again (CANCELLED is excluded
-- there) and the insert then failed with P2002.
--
-- It is replaced by a partial unique index that only constrains live reservations. Postgres
-- partial indexes cannot be expressed in schema.prisma, which is why this is raw SQL and why
-- schema.prisma documents it instead of declaring @@unique.
DROP INDEX IF EXISTS "public"."Reservation_date_barberId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_date_barberId_active_key"
  ON "public"."Reservation" ("date", "barberId")
  WHERE "status" <> 'CANCELLED';
