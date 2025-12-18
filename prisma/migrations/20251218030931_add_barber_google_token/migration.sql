-- CreateTable
CREATE TABLE "public"."BarberGoogleToken" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiryDate" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberGoogleToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarberGoogleToken_barberId_key" ON "public"."BarberGoogleToken"("barberId");

-- AddForeignKey
ALTER TABLE "public"."BarberGoogleToken" ADD CONSTRAINT "BarberGoogleToken_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "public"."Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
