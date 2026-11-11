CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK');

CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "openingDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialReconciliation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementDate" DATE NOT NULL,
    "previousStatementDate" DATE,
    "previousStatementBalance" DECIMAL(18,2) NOT NULL,
    "statementBalance" DECIMAL(18,2) NOT NULL,
    "expectedBalance" DECIMAL(18,2) NOT NULL,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "FinancialReconciliation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment"
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "reconciliationId" TEXT;

ALTER TABLE "Expense"
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "reconciliationId" TEXT;

CREATE UNIQUE INDEX "FinancialAccount_businessId_name_key" ON "FinancialAccount"("businessId", "name");
CREATE INDEX "FinancialAccount_businessId_active_idx" ON "FinancialAccount"("businessId", "active");
CREATE INDEX "FinancialReconciliation_businessId_accountId_statementDate_idx" ON "FinancialReconciliation"("businessId", "accountId", "statementDate");
CREATE INDEX "Payment_accountId_paidAt_idx" ON "Payment"("accountId", "paidAt");
CREATE INDEX "Expense_accountId_incurredAt_idx" ON "Expense"("accountId", "incurredAt");

ALTER TABLE "FinancialAccount"
  ADD CONSTRAINT "FinancialAccount_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialReconciliation"
  ADD CONSTRAINT "FinancialReconciliation_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialReconciliation_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_reconciliationId_fkey"
  FOREIGN KEY ("reconciliationId") REFERENCES "FinancialReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Expense_reconciliationId_fkey"
  FOREIGN KEY ("reconciliationId") REFERENCES "FinancialReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "FinancialAccount" (
  "id", "businessId", "name", "type", "openingBalance", "openingDate", "active", "createdAt", "updatedAt"
)
SELECT
  'cash_' || substr(md5("id"), 1, 24),
  "id",
  'Cash',
  'CASH',
  0,
  DATE '1970-01-01',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Business";