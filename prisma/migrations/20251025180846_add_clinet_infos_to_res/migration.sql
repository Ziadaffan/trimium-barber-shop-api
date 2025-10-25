/*
  Warnings:

  - Added the required column `clientEmail` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientName` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientPhone` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceId` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ServiceType" AS ENUM ('HAIRCUT', 'BEARD_TRIM', 'SHAVING', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "clientEmail" TEXT NOT NULL,
ADD COLUMN     "clientName" TEXT NOT NULL,
ADD COLUMN     "clientPhone" TEXT NOT NULL,
ADD COLUMN     "serviceId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."Service" (
    "id" TEXT NOT NULL,
    "type" "public"."ServiceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
