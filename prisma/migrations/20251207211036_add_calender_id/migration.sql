/*
  Warnings:

  - A unique constraint covering the columns `[calendarId]` on the table `GoogleCalendarToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `calendarId` to the `GoogleCalendarToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."GoogleCalendarToken" ADD COLUMN     "calendarId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarToken_calendarId_key" ON "public"."GoogleCalendarToken"("calendarId");
