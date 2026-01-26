/*
  Warnings:

  - A unique constraint covering the columns `[googleEventId]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "googleEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_googleEventId_key" ON "public"."Reservation"("googleEventId");
