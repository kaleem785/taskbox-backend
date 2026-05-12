-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CLEARED', 'WARNING_1', 'WARNING_2', 'SUSPENDED', 'UNSUSPENSION_REQUESTED');

-- CreateEnum
CREATE TYPE "CommissionEventKind" AS ENUM ('GENERATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WARNING_1', 'WARNING_2', 'SUSPENDED', 'FINE_PAID', 'UNSUSPENSION_REQUESTED', 'UNSUSPENSION_APPROVED', 'UNSUSPENSION_REJECTED', 'DEADLINE_EXTENDED');

-- CreateTable
CREATE TABLE "commission_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "categoryRates" JSONB NOT NULL DEFAULT '{}',
    "defaultRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "deadlineDayOfWeek" INTEGER NOT NULL DEFAULT 6,
    "deadlineHourLocal" INTEGER NOT NULL DEFAULT 23,
    "deadlineMinuteLocal" INTEGER NOT NULL DEFAULT 59,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "warning1Hours" INTEGER NOT NULL DEFAULT 24,
    "warning2Hours" INTEGER NOT NULL DEFAULT 48,
    "suspensionHours" INTEGER NOT NULL DEFAULT 72,
    "autoSuspensionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "penaltyFineFixed" DECIMAL(12,2) NOT NULL DEFAULT 200,
    "penaltyPercentage" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "maxFineCap" DECIMAL(12,2) NOT NULL DEFAULT 500,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "notifySms" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "jobsCount" INTEGER NOT NULL DEFAULT 0,
    "cashCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "commissionDue" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "screenshotKey" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "penaltyFine" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finePaid" BOOLEAN NOT NULL DEFAULT false,
    "warning1At" TIMESTAMP(3),
    "warning2At" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_jobs" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "jobName" TEXT NOT NULL,
    "customerPaid" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_events" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "kind" "CommissionEventKind" NOT NULL,
    "byUserId" TEXT,
    "detail" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_deadline_idx" ON "commissions"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_partnerId_weekStart_key" ON "commissions"("partnerId", "weekStart");

-- CreateIndex
CREATE INDEX "commission_jobs_commissionId_idx" ON "commission_jobs"("commissionId");

-- CreateIndex
CREATE UNIQUE INDEX "commission_jobs_commissionId_bookingId_key" ON "commission_jobs"("commissionId", "bookingId");

-- CreateIndex
CREATE INDEX "commission_events_commissionId_createdAt_idx" ON "commission_events"("commissionId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_jobs" ADD CONSTRAINT "commission_jobs_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
