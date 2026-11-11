ALTER TYPE "Role" ADD VALUE 'PAYROLL_ADMIN';
ALTER TYPE "Role" ADD VALUE 'EMPLOYEE';

CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'CASUAL', 'INTERN');
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');
CREATE TYPE "SalaryComponentKind" AS ENUM ('EARNING', 'OTHER_DEDUCTION');
CREATE TYPE "SalaryComponentMode" AS ENUM ('FIXED', 'VARIABLE');
CREATE TYPE "StatutoryCalculation" AS ENUM ('PERCENTAGE', 'PROGRESSIVE');
CREATE TYPE "StatutoryBasis" AS ENUM ('BASIC', 'GROSS', 'PAYE');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');
CREATE TYPE "PayrollRunKind" AS ENUM ('REGULAR', 'ADJUSTMENT');
CREATE TYPE "PayrollLineItemKind" AS ENUM ('EARNING', 'STATUTORY_DEDUCTION', 'OTHER_DEDUCTION');
CREATE TYPE "PayrollCorrectionStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "departmentId" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "jobTitle" TEXT NOT NULL,
    "employmentDate" DATE NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "basicSalary" DECIMAL(18,2) NOT NULL,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "mobileMoneyProvider" TEXT,
    "mobileMoneyNumber" TEXT,
    "taxNumber" TEXT,
    "nssaNumber" TEXT,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SalaryComponentKind" NOT NULL,
    "mode" "SalaryComponentMode" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeSalaryComponent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeSalaryComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatutoryRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "calculation" "StatutoryCalculation" NOT NULL,
    "basis" "StatutoryBasis" NOT NULL,
    "ratePercent" DECIMAL(9,6),
    "bands" JSONB,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatutoryRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adjustmentForId" TEXT,
    "reference" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "calculationHash" TEXT NOT NULL,
    "kind" "PayrollRunKind" NOT NULL DEFAULT 'REGULAR',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "payDate" DATE,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "statutoryTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeductionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "paidById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "departmentName" TEXT,
    "jobTitle" TEXT NOT NULL,
    "basicSalary" DECIMAL(18,2) NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "statutoryDeductions" DECIMAL(18,2) NOT NULL,
    "otherDeductions" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollLineItem" (
    "id" TEXT NOT NULL,
    "payrollLineId" TEXT NOT NULL,
    "kind" "PayrollLineItemKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "ruleSnapshot" JSONB,
    "componentId" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollCorrection" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollLineId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "earningsDelta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionsDelta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PayrollCorrectionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "PayrollCorrection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_businessId_name_key" ON "Department"("businessId", "name");
CREATE INDEX "Department_businessId_active_idx" ON "Department"("businessId", "active");
CREATE UNIQUE INDEX "Employee_businessId_employeeNumber_key" ON "Employee"("businessId", "employeeNumber");
CREATE UNIQUE INDEX "Employee_businessId_userId_key" ON "Employee"("businessId", "userId");
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");
CREATE INDEX "Employee_businessId_status_fullName_idx" ON "Employee"("businessId", "status", "fullName");
CREATE INDEX "Employee_businessId_departmentId_idx" ON "Employee"("businessId", "departmentId");
CREATE UNIQUE INDEX "SalaryComponent_businessId_code_key" ON "SalaryComponent"("businessId", "code");
CREATE INDEX "SalaryComponent_businessId_active_kind_idx" ON "SalaryComponent"("businessId", "active", "kind");
CREATE INDEX "EmployeeSalaryComponent_employeeId_effectiveFrom_effectiveTo_idx" ON "EmployeeSalaryComponent"("employeeId", "effectiveFrom", "effectiveTo");
CREATE INDEX "EmployeeSalaryComponent_componentId_idx" ON "EmployeeSalaryComponent"("componentId");
CREATE UNIQUE INDEX "StatutoryRule_businessId_code_currency_effectiveFrom_key" ON "StatutoryRule"("businessId", "code", "currency", "effectiveFrom");
CREATE INDEX "StatutoryRule_businessId_active_currency_effectiveFrom_effectiveTo_idx" ON "StatutoryRule"("businessId", "active", "currency", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "PayrollRun_businessId_reference_key" ON "PayrollRun"("businessId", "reference");
CREATE INDEX "PayrollRun_businessId_year_month_status_idx" ON "PayrollRun"("businessId", "year", "month", "status");
CREATE INDEX "PayrollRun_adjustmentForId_idx" ON "PayrollRun"("adjustmentForId");
CREATE UNIQUE INDEX "PayrollLine_payrollRunId_employeeId_key" ON "PayrollLine"("payrollRunId", "employeeId");
CREATE INDEX "PayrollLine_employeeId_payrollRunId_idx" ON "PayrollLine"("employeeId", "payrollRunId");
CREATE INDEX "PayrollLineItem_payrollLineId_kind_idx" ON "PayrollLineItem"("payrollLineId", "kind");
CREATE INDEX "PayrollCorrection_payrollRunId_employeeId_status_idx" ON "PayrollCorrection"("payrollRunId", "employeeId", "status");

ALTER TABLE "Department" ADD CONSTRAINT "Department_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryComponent" ADD CONSTRAINT "EmployeeSalaryComponent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryComponent" ADD CONSTRAINT "EmployeeSalaryComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatutoryRule" ADD CONSTRAINT "StatutoryRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_adjustmentForId_fkey" FOREIGN KEY ("adjustmentForId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
