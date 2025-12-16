/*
  Warnings:

  - Added the required column `cloudinaryId` to the `Gallery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Gallery" ADD COLUMN     "cloudinaryId" TEXT NOT NULL;
