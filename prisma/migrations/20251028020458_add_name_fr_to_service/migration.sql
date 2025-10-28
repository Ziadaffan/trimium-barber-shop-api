/*
  Warnings:

  - You are about to drop the column `name` on the `Service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Service" DROP COLUMN "name",
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameFr" TEXT;
