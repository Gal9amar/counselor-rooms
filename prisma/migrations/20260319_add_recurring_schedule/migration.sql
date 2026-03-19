-- CreateTable
CREATE TABLE "RecurringSchedule" (
    "id"          SERIAL NOT NULL,
    "roomId"      INTEGER NOT NULL,
    "therapistId" INTEGER NOT NULL,
    "startHour"   INTEGER NOT NULL,
    "endHour"     INTEGER NOT NULL,
    "note"        TEXT,
    "frequency"   TEXT NOT NULL,
    "daysOfWeek"  INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3),
    "occurrences" INTEGER,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSchedule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN "recurringId" INTEGER;

-- CreateIndex
CREATE INDEX "ScheduleSlot_recurringId_idx" ON "ScheduleSlot"("recurringId");

-- AddForeignKey
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_therapistId_fkey"
    FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_recurringId_fkey"
    FOREIGN KEY ("recurringId") REFERENCES "RecurringSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
