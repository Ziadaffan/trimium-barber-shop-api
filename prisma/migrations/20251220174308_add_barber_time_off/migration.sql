/*
  Warnings:

  - Added the required column `endDate` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."BarberTimeOffType" AS ENUM ('VACATION', 'BLOCK');

-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."BarberTimeOff" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "type" "public"."BarberTimeOffType" NOT NULL DEFAULT 'VACATION',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BarberTimeOff_barberId_startAt_endAt_idx" ON "public"."BarberTimeOff"("barberId", "startAt", "endAt");

-- AddForeignKey
ALTER TABLE "public"."BarberTimeOff" ADD CONSTRAINT "BarberTimeOff_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "public"."Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
