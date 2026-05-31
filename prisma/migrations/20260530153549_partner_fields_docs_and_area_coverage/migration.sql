/*
  Warnings:

  - A unique constraint covering the columns `[applicantId]` on the table `partners` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "address" TEXT,
ADD COLUMN     "applicantId" TEXT,
ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "experience" "ApplicantExperience",
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "partner_areas" (
    "partnerId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_areas_pkey" PRIMARY KEY ("partnerId","areaId")
);

-- CreateTable
CREATE TABLE "partner_documents" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileKey" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant_areas" (
    "applicantId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_areas_pkey" PRIMARY KEY ("applicantId","areaId")
);

-- CreateTable
CREATE TABLE "applicant_zones" (
    "applicantId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_zones_pkey" PRIMARY KEY ("applicantId","zoneId")
);

-- CreateIndex
CREATE INDEX "partner_areas_areaId_idx" ON "partner_areas"("areaId");

-- CreateIndex
CREATE INDEX "partner_documents_partnerId_idx" ON "partner_documents"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_documents_partnerId_type_key" ON "partner_documents"("partnerId", "type");

-- CreateIndex
CREATE INDEX "applicant_areas_areaId_idx" ON "applicant_areas"("areaId");

-- CreateIndex
CREATE INDEX "applicant_zones_zoneId_idx" ON "applicant_zones"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "partners_applicantId_key" ON "partners"("applicantId");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_areas" ADD CONSTRAINT "partner_areas_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_areas" ADD CONSTRAINT "partner_areas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_areas" ADD CONSTRAINT "applicant_areas_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_areas" ADD CONSTRAINT "applicant_areas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_zones" ADD CONSTRAINT "applicant_zones_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_zones" ADD CONSTRAINT "applicant_zones_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
