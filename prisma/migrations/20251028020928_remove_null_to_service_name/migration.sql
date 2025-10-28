/*
  Warnings:

  - Made the column `nameEn` on table `Service` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nameFr` on table `Service` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Service" ALTER COLUMN "nameEn" SET NOT NULL,
ALTER COLUMN "nameFr" SET NOT NULL;
