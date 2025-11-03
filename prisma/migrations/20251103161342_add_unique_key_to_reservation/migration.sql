/*
  Warnings:

  - A unique constraint covering the columns `[date,barberId]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Reservation_date_barberId_key" ON "public"."Reservation"("date", "barberId");
