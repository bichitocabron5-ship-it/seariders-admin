CREATE TYPE "JetskiLicenseMode" AS ENUM ('NONE', 'GREEN_LIMITED', 'YELLOW_UNLIMITED');
CREATE TYPE "PricingTier" AS ENUM ('STANDARD', 'RESIDENT');

ALTER TABLE "Reservation"
ADD COLUMN "jetskiLicenseMode" "JetskiLicenseMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN "pricingTier" "PricingTier" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "ServicePrice"
ADD COLUMN "pricingTier" "PricingTier" NOT NULL DEFAULT 'STANDARD';

UPDATE "Reservation"
SET
  "jetskiLicenseMode" = CASE
    WHEN "isLicense" = true THEN 'YELLOW_UNLIMITED'::"JetskiLicenseMode"
    ELSE 'NONE'::"JetskiLicenseMode"
  END,
  "pricingTier" = 'STANDARD'::"PricingTier";
