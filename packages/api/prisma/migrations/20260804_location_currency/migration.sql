-- Align existing property currencies with their configured countries.
UPDATE "Hotel"
SET "currency" = 'ZAR'
WHERE UPPER(TRIM("country")) IN ('ZA', 'SOUTH AFRICA');

UPDATE "Hotel"
SET "currency" = 'NGN'
WHERE UPPER(TRIM("country")) IN ('NG', 'NIGERIA');

UPDATE "Hotel"
SET "currency" = 'USD'
WHERE UPPER(TRIM("country")) IN ('US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA');

UPDATE "Hotel"
SET "currency" = 'GBP'
WHERE UPPER(TRIM("country")) IN ('GB', 'UK', 'UNITED KINGDOM');
