-- CreateEnum
CREATE TYPE "AIRecommendationSource" AS ENUM ('DAILY_GM_BRIEFING', 'DEPARTMENT_INTELLIGENCE');

-- CreateEnum
CREATE TYPE "AIRecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TASK_CREATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AIRecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "AIRecommendation" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "sourceType" "AIRecommendationSource" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "priority" "AIRecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "rationale" TEXT NOT NULL,
  "status" "AIRecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "createdTaskId" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIRecommendation_hotelId_sourceType_sourceId_title_key" ON "AIRecommendation"("hotelId", "sourceType", "sourceId", "title");
CREATE INDEX "AIRecommendation_hotelId_idx" ON "AIRecommendation"("hotelId");
CREATE INDEX "AIRecommendation_status_idx" ON "AIRecommendation"("status");
CREATE INDEX "AIRecommendation_department_idx" ON "AIRecommendation"("department");
CREATE INDEX "AIRecommendation_priority_idx" ON "AIRecommendation"("priority");
CREATE INDEX "AIRecommendation_sourceType_sourceId_idx" ON "AIRecommendation"("sourceType", "sourceId");
CREATE INDEX "AIRecommendation_createdAt_idx" ON "AIRecommendation"("createdAt");

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_createdTaskId_fkey" FOREIGN KEY ("createdTaskId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
