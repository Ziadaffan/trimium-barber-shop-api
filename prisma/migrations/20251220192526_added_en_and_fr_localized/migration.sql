/*
  Warnings:

  - You are about to drop the column `description` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Service` table. All the data in the column will be lost.
  - Added the required column `nameEn` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameFr` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "description",
DROP COLUMN "name",
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "descriptionFr" TEXT,
ADD COLUMN     "nameEn" TEXT NOT NULL,
ADD COLUMN     "nameFr" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Service" DROP COLUMN "description",
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "descriptionFr" TEXT;
