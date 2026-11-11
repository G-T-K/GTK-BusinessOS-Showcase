import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/role-permissions";

type ReportRow = Record<string, string | number>;

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(rows: ReportRow[]) {
  if (!rows.length) return "No payroll data for the selected period\r\n";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\r\n");
}

async function reportPdf(title: string, rows: ReportRow[]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([792, 612]);
  const maxY = 560;
  const headers = rows.length ? Object.keys(rows[0]) : ["Result"];
  page.drawText(title, { x: 36, y: maxY, size: 18, font: bold, color: rgb(0.1, 0.2, 0.17) });
  let y = maxY - 30;
  const drawHeader = () => {
    const columnWidth = 720 / headers.length;
    headers.forEach((header, index) => page.drawText(header.slice(0, 30), { x: 36 + index * columnWidth, y, size: 8, font: bold, maxWidth: columnWidth - 4 }));
    y -= 18;
  };
  drawHeader();
  for (const row of rows.length ? rows : [{ Result: "No payroll data for the selected period" }]) {
    if (y < 40) {
      page = document.addPage([792, 612]);
      y = maxY - 20;
      drawHeader();
    }
    const columnWidth = 720 / headers.length;
    headers.forEach((header, index) => {
      const value = String(row[header] ?? "").replace(/[^\x20-\x7E]/g, "");
      page.drawText(value.slice(0, 80), { x: 36 + index * columnWidth, y, size: 7, font, maxWidth: columnWidth - 4 });
    });
    y -= 15;
  }
  return document.save();
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const user = session.user as typeof session.user & { id?: string; businessId?: string };
  if (!user.id || !user.businessId) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, businessId: user.businessId, active: true },
    select: { role: true },
  });
  if (!membership || !hasPermission(membership.role, "payroll")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "summary";
  const format = url.searchParams.get("format") ?? "csv";
  const year = Number(url.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return NextResponse.json({ error: "Invalid report year" }, { status: 400 });
  const sensitiveTypes = ["outstanding", "register", "history", "statutory", "department"];
  if (sensitiveTypes.includes(type) && !hasPermission(membership.role, "payrollSensitive")) {
    return NextResponse.json({ error: "Employee-level payroll reports are restricted" }, { status: 403 });
  }
  if (!["summary", "gross-net", "outstanding", ...sensitiveTypes].includes(type)) {
    return NextResponse.json({ error: "Unknown payroll report" }, { status: 400 });
  }
  if (format !== "csv" && format !== "pdf") return NextResponse.json({ error: "Choose CSV or PDF format" }, { status: 400 });

  const baseWhere = { businessId: user.businessId, year, status: { in: ["APPROVED" as const, "PAID" as const] } };
  let rows: ReportRow[] = [];
  if (type === "summary") {
    const runs = await prisma.payrollRun.findMany({ where: baseWhere, orderBy: [{ month: "asc" }, { currency: "asc" }] });
    rows = runs.map((run) => ({
      period: `${run.year}-${String(run.month).padStart(2, "0")}`,
      reference: run.reference,
      currency: run.currency,
      status: run.status,
      employees: run.employeeCount,
      gross: Number(run.grossTotal),
      statutory_deductions: Number(run.statutoryTotal),
      other_deductions: Number(run.otherDeductionTotal),
      net: Number(run.netTotal),
    }));
    const corrections = await prisma.payrollCorrection.findMany({
      where: { payrollRun: baseWhere, status: { in: ["APPROVED", "PAID"] } },
      include: { payrollRun: { select: { year: true, month: true, currency: true, reference: true } } },
    });
    for (const correction of corrections) {
      rows.push({
        period: `${correction.payrollRun.year}-${String(correction.payrollRun.month).padStart(2, "0")}`,
        reference: `${correction.payrollRun.reference}-ADJ`,
        currency: correction.payrollRun.currency,
        status: correction.status,
        employees: 1,
        gross: Number(correction.earningsDelta),
        statutory_deductions: 0,
        other_deductions: Number(correction.deductionsDelta),
        net: Number(correction.earningsDelta) - Number(correction.deductionsDelta),
      });
    }
  } else if (type === "gross-net") {
    const runs = await prisma.payrollRun.findMany({ where: baseWhere, orderBy: [{ month: "asc" }, { currency: "asc" }] });
    const totals = new Map<string, { period: string; currency: string; gross: number; net: number }>();
    for (const run of runs) {
      const period = `${run.year}-${String(run.month).padStart(2, "0")}`;
      const key = `${period}:${run.currency}`;
      const current = totals.get(key) ?? { period, currency: run.currency, gross: 0, net: 0 };
      current.gross += Number(run.grossTotal);
      current.net += Number(run.netTotal);
      totals.set(key, current);
    }
    const corrections = await prisma.payrollCorrection.findMany({
      where: { payrollRun: baseWhere, status: { in: ["APPROVED", "PAID"] } },
      include: { payrollRun: { select: { year: true, month: true, currency: true } } },
    });
    for (const correction of corrections) {
      const period = `${correction.payrollRun.year}-${String(correction.payrollRun.month).padStart(2, "0")}`;
      const key = `${period}:${correction.payrollRun.currency}`;
      const current = totals.get(key) ?? { period, currency: correction.payrollRun.currency, gross: 0, net: 0 };
      current.gross += Number(correction.earningsDelta);
      current.net += Number(correction.earningsDelta) - Number(correction.deductionsDelta);
      totals.set(key, current);
    }
    rows = Array.from(totals.values());
  } else if (type === "outstanding") {
    const runs = await prisma.payrollRun.findMany({
      where: { ...baseWhere, status: "APPROVED" },
      include: { lines: { orderBy: { employeeName: "asc" } } },
    });
    rows = runs.flatMap((run) => run.lines.map((line) => ({
      period: `${run.year}-${String(run.month).padStart(2, "0")}`,
      reference: run.reference,
      employee_number: line.employeeNumber,
      employee: line.employeeName,
      currency: run.currency,
      net_outstanding: Number(line.netPay),
      pay_date: run.payDate?.toISOString().slice(0, 10) ?? "",
    })));
    const corrections = await prisma.payrollCorrection.findMany({
      where: { payrollRun: { ...baseWhere, status: "APPROVED" }, status: "APPROVED" },
      include: { employee: { select: { employeeNumber: true, fullName: true } }, payrollRun: { select: { reference: true, year: true, month: true, currency: true, payDate: true } } },
    });
    rows.push(...corrections.map((correction) => ({
      period: `${correction.payrollRun.year}-${String(correction.payrollRun.month).padStart(2, "0")}`,
      reference: `${correction.payrollRun.reference}-ADJ`,
      employee_number: correction.employee.employeeNumber,
      employee: correction.employee.fullName,
      currency: correction.payrollRun.currency,
      net_outstanding: Number(correction.earningsDelta) - Number(correction.deductionsDelta),
      pay_date: correction.payrollRun.payDate?.toISOString().slice(0, 10) ?? "",
    })));
  } else if (type === "register" || type === "history") {
    const employeeId = url.searchParams.get("employeeId") ?? undefined;
    const lines = await prisma.payrollLine.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        payrollRun: { ...baseWhere, ...(type === "register" ? { status: "PAID" } : {}) },
      },
      include: { payrollRun: { select: { reference: true, year: true, month: true, currency: true, status: true, payDate: true } } },
      orderBy: [{ payrollRun: { year: "asc" } }, { payrollRun: { month: "asc" } }, { employeeName: "asc" }],
    });
    rows = lines.map((line) => ({
      period: `${line.payrollRun.year}-${String(line.payrollRun.month).padStart(2, "0")}`,
      reference: line.payrollRun.reference,
      employee_number: line.employeeNumber,
      employee: line.employeeName,
      department: line.departmentName ?? "",
      currency: line.payrollRun.currency,
      status: line.payrollRun.status,
      gross: Number(line.gross),
      statutory_deductions: Number(line.statutoryDeductions),
      other_deductions: Number(line.otherDeductions),
      net: Number(line.netPay),
      payment_date: line.payrollRun.payDate?.toISOString().slice(0, 10) ?? "",
    }));
    const corrections = await prisma.payrollCorrection.findMany({
      where: {
        payrollRun: baseWhere,
        status: type === "register" ? "PAID" : { in: ["APPROVED", "PAID"] },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { employeeNumber: true, fullName: true, department: { select: { name: true } } } },
        payrollRun: { select: { reference: true, year: true, month: true, currency: true, status: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    });
    rows.push(...corrections.map((correction) => ({
      period: `${correction.payrollRun.year}-${String(correction.payrollRun.month).padStart(2, "0")}`,
      reference: `${correction.payrollRun.reference}-ADJ`,
      employee_number: correction.employee.employeeNumber,
      employee: correction.employee.fullName,
      department: correction.employee.department?.name ?? "",
      currency: correction.payrollRun.currency,
      status: correction.status,
      gross: Number(correction.earningsDelta),
      statutory_deductions: 0,
      other_deductions: Number(correction.deductionsDelta),
      net: Number(correction.earningsDelta) - Number(correction.deductionsDelta),
      payment_date: correction.paidAt?.toISOString().slice(0, 10) ?? "",
    })));
  } else if (type === "statutory") {
    const items = await prisma.payrollLineItem.findMany({
      where: { kind: "STATUTORY_DEDUCTION", payrollLine: { payrollRun: baseWhere } },
      include: { payrollLine: { include: { payrollRun: { select: { reference: true, year: true, month: true, currency: true } } } } },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });
    rows = items.map((item) => ({
      period: `${item.payrollLine.payrollRun.year}-${String(item.payrollLine.payrollRun.month).padStart(2, "0")}`,
      reference: item.payrollLine.payrollRun.reference,
      employee_number: item.payrollLine.employeeNumber,
      employee: item.payrollLine.employeeName,
      code: item.code,
      deduction: item.name,
      currency: item.payrollLine.payrollRun.currency,
      amount: Number(item.amount),
    }));
  } else if (type === "department") {
    const lines = await prisma.payrollLine.findMany({
      where: { payrollRun: baseWhere },
      include: { payrollRun: { select: { currency: true } } },
    });
    const totals = new Map<string, { currency: string; count: number; gross: number; deductions: number; net: number }>();
    for (const line of lines) {
      const key = `${line.departmentName ?? "Unassigned"}:${line.payrollRun.currency}`;
      const current = totals.get(key) ?? { currency: line.payrollRun.currency, count: 0, gross: 0, deductions: 0, net: 0 };
      current.count += 1;
      current.gross += Number(line.gross);
      current.deductions += Number(line.statutoryDeductions) + Number(line.otherDeductions);
      current.net += Number(line.netPay);
      totals.set(key, current);
    }
    const corrections = await prisma.payrollCorrection.findMany({
      where: { payrollRun: baseWhere, status: { in: ["APPROVED", "PAID"] } },
      include: {
        payrollLine: { select: { departmentName: true } },
        payrollRun: { select: { currency: true } },
      },
    });
    for (const correction of corrections) {
      const department = correction.payrollLine.departmentName ?? "Unassigned";
      const currency = correction.payrollRun.currency;
      const key = `${department}:${currency}`;
      const current = totals.get(key) ?? { currency, count: 0, gross: 0, deductions: 0, net: 0 };
      current.gross += Number(correction.earningsDelta);
      current.deductions += Number(correction.deductionsDelta);
      current.net += Number(correction.earningsDelta) - Number(correction.deductionsDelta);
      totals.set(key, current);
    }
    rows = Array.from(totals, ([key, value]) => ({
      department: key.slice(0, key.lastIndexOf(":")),
      currency: value.currency,
      employee_months: value.count,
      gross: value.gross,
      deductions: value.deductions,
      net: value.net,
    }));
  }

  const filename = `payroll-${type}-${year}`;
  if (format === "pdf") {
    const bytes = await reportPdf(`GTK BusinessOS · Payroll ${type} · ${year}`, rows);
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }
  return new NextResponse(csv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"`, "Cache-Control": "private, no-store" },
  });
}
