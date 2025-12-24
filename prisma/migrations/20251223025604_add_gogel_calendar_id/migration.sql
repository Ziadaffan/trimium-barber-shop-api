/*
  Warnings:

  - A unique constraint covering the columns `[googleCalendarId]` on the table `Barber` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Barber" ADD COLUMN     "googleCalendarId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Barber_googleCalendarId_key" ON "public"."Barber"("googleCalendarId");
