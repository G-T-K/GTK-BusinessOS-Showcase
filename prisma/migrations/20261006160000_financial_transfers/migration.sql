CREATE TABLE "FinancialTransfer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "fromReconciliationId" TEXT,
    "toReconciliationId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialTransfer_businessId_transferDate_idx" ON "FinancialTransfer"("businessId", "transferDate");
CREATE INDEX "FinancialTransfer_fromAccountId_transferDate_idx" ON "FinancialTransfer"("fromAccountId", "transferDate");
CREATE INDEX "FinancialTransfer_toAccountId_transferDate_idx" ON "FinancialTransfer"("toAccountId", "transferDate");

ALTER TABLE "FinancialTransfer"
  ADD CONSTRAINT "FinancialTransfer_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialTransfer_fromAccountId_fkey"
  FOREIGN KEY ("fromAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialTransfer_toAccountId_fkey"
  FOREIGN KEY ("toAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialTransfer_fromReconciliationId_fkey"
  FOREIGN KEY ("fromReconciliationId") REFERENCES "FinancialReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialTransfer_toReconciliationId_fkey"
  FOREIGN KEY ("toReconciliationId") REFERENCES "FinancialReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;