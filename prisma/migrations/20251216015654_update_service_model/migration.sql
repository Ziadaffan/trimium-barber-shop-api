/*
  Warnings:

  - Changed the type of `type` on the `Service` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "public"."Service_type_key";

-- AlterTable
ALTER TABLE "public"."Service" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropEnum
DROP TYPE "public"."ServiceType";
