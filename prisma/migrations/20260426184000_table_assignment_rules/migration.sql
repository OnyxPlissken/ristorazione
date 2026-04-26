ALTER TABLE "LocationTechnicalSetting"
  ADD COLUMN "tableAssignmentStrategy" TEXT NOT NULL DEFAULT 'BALANCED',
  ADD COLUMN "tableAssignmentSlotMode" TEXT NOT NULL DEFAULT 'FLEXIBLE',
  ADD COLUMN "tableAssignmentFlexMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "tableAssignmentTurnoverBufferMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "tableAssignmentCombineTablesEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tableAssignmentMaxTables" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "tableAssignmentMinOccupancyPercent" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "tableAssignmentWeightTableFit" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "tableAssignmentWeightPartySize" INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN "tableAssignmentWeightCustomerPriority" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "tableAssignmentWeightAverageSpend" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "tableAssignmentWeightCreatedAt" INTEGER NOT NULL DEFAULT 10;
