import { NextResponse } from "next/server";
import { createPayslipPdf } from "@/lib/payroll-pdf";
import { getPayslipAccess } from "@/lib/payroll-access";

export async function GET(request: Request, { params }: { params: { lineId: string } }) {
  const access = await getPayslipAccess(params.lineId);
  if (!access.allowed) {
    return NextResponse.json({ error: access.status === 401 ? "Authentication required" : "Payslip not found or access denied" }, { status: access.status });
  }
  if (!["APPROVED", "PAID"].includes(access.line.payrollRun.status)) {
    return NextResponse.json({ error: "Payslips are available after payroll approval" }, { status: 404 });
  }
  const payslip = await createPayslipPdf(access.line.id, access.businessId);
  if (!payslip) return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  const { logAction } = await import("@/lib/audit");
  await logAction({
    businessId: access.businessId,
    userId: access.userId,
    action: "payroll.payslip_generated",
    entityType: "PayrollLine",
    entityId: access.line.id,
    metadata: { employeeNumber: access.line.employeeNumber, payrollReference: payslip.reference },
  });
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return new NextResponse(payslip.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${payslip.employeeNumber}-${payslip.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
