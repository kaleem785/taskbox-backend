-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('PENDING', 'NEEDS_REVIEW', 'DOCS_REVIEW', 'TEST_SCHEDULED', 'TEST_COMPLETED', 'FINAL_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicantExperience" AS ENUM ('LESS_1', 'Y1_3', 'Y3_5', 'Y5_PLUS');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CNIC_FRONT', 'CNIC_BACK', 'SELFIE', 'CERTIFICATE', 'EXPERIENCE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('MISSING', 'UPLOADED', 'NEEDS_FIX', 'VALID');

-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('APPLICANT', 'BOOKING', 'COMMISSION', 'PARTNER');

-- CreateTable
CREATE TABLE "applicants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "cnic" TEXT,
    "cityId" TEXT,
    "categoryId" TEXT,
    "address" TEXT,
    "experience" "ApplicantExperience",
    "source" TEXT,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'PENDING',
    "profileCompletion" INTEGER NOT NULL DEFAULT 0,
    "hasResubmitted" BOOLEAN NOT NULL DEFAULT false,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant_documents" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'MISSING',
    "fileKey" TEXT,
    "feedback" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicant_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant_tests" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "venueName" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "scoredAt" TIMESTAMP(3),
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "scoreSafety" INTEGER,
    "scoreTools" INTEGER,
    "scorePractical" INTEGER,
    "scoreCustomer" INTEGER,
    "scoreDocs" INTEGER,
    "totalScore" INTEGER,
    "passed" BOOLEAN,
    "notes" TEXT,
    "scheduledByUserId" TEXT,
    "scoredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicant_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "entityType" "ActivityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "color" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "capacity" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_venues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applicants_status_idx" ON "applicants"("status");

-- CreateIndex
CREATE INDEX "applicants_cityId_idx" ON "applicants"("cityId");

-- CreateIndex
CREATE INDEX "applicants_categoryId_idx" ON "applicants"("categoryId");

-- CreateIndex
CREATE INDEX "applicant_documents_applicantId_idx" ON "applicant_documents"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_documents_applicantId_type_key" ON "applicant_documents"("applicantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_tests_applicantId_key" ON "applicant_tests"("applicantId");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_createdAt_idx" ON "activity_logs"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_actorUserId_idx" ON "activity_logs"("actorUserId");

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_documents" ADD CONSTRAINT "applicant_documents_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_tests" ADD CONSTRAINT "applicant_tests_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
