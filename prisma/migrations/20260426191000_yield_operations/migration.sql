ALTER TABLE "LocationTechnicalSetting"
  ADD COLUMN "predictiveDurationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "kitchenLoadGuardEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "kitchenLoadWindowMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "kitchenLoadMaxCovers" INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN "controlledOverbookingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "controlledOverbookingMaxCovers" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "controlledOverbookingMinReliabilityScore" INTEGER NOT NULL DEFAULT 70,
  ADD COLUMN "waitlistOfferTtlMinutes" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "ownerBriefEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ownerBriefMorningHour" INTEGER NOT NULL DEFAULT 10;
