-- CreateTable
CREATE TABLE "public"."GoogleCalendarWatch" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "expiration" BIGINT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarWatch_calendarId_key" ON "public"."GoogleCalendarWatch"("calendarId");
