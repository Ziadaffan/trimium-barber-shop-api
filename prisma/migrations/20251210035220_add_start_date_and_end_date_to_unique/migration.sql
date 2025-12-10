/*
  Warnings:

  - A unique constraint covering the columns `[barberId,dayOfWeek,startTime,endTime]` on the table `BarberSchedule` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."BarberSchedule_barberId_dayOfWeek_key";

-- CreateIndex
CREATE UNIQUE INDEX "BarberSchedule_barberId_dayOfWeek_startTime_endTime_key" ON "public"."BarberSchedule"("barberId", "dayOfWeek", "startTime", "endTime");
