import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { moneyInCurrency } from "@/lib/format";

const pageWidth = 612;
const pageHeight = 792;
const ink = rgb(0.11, 0.18, 0.22);
const muted = rgb(0.38, 0.43, 0.47);
const green = rgb(0.08, 0.43, 0.3);
const pale = rgb(0.94, 0.97, 0.95);

function printable(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

function addRow(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  y: number,
  label: string,
  value: string,
  emphasis = false,
) {
  page.drawText(printable(label), { x: 48, y, size: emphasis ? 11 : 9, font: emphasis ? bold : font, color: emphasis ? ink : muted });
  page.drawText(printable(value), { x: 365, y, size: emphasis ? 11 : 9, font: emphasis ? bold : font, color: emphasis ? ink : ink, maxWidth: 200 });
}

export async function createPayslipPdf(lineId: string, businessId: string) {
  const line = await prisma.payrollLine.findFirst({
    where: { id: lineId, payrollRun: { businessId, status: { in: ["APPROVED", "PAID"] } } },
    include: {
      employee: { select: { id: true } },
      payrollRun: {
        include: {
          business: { select: { name: true, address: true, phone: true, email: true, website: true, logo: true, logoMimeType: true } },
        },
      },
      items: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
    },
  });
  if (!line) return null;

  const [yearToDate, paidCorrections] = await Promise.all([
    prisma.payrollLine.aggregate({
      where: {
        employeeId: line.employeeId,
        payrollRun: {
          businessId,
          year: line.payrollRun.year,
          month: { lte: line.payrollRun.month },
          currency: line.payrollRun.currency,
          status: { in: ["APPROVED", "PAID"] },
        },
      },
      _sum: { gross: true, statutoryDeductions: true, otherDeductions: true, netPay: true },
    }),
    prisma.payrollCorrection.aggregate({
      where: {
        employeeId: line.employeeId,
        payrollRun: {
          businessId,
          year: line.payrollRun.year,
          month: { lte: line.payrollRun.month },
          currency: line.payrollRun.currency,
        },
        status: "PAID",
      },
      _sum: { earningsDelta: true, deductionsDelta: true },
    }),
  ]);
  const ytdGross = Number(yearToDate._sum.gross ?? 0) + Number(paidCorrections._sum.earningsDelta ?? 0);
  const ytdNet = Number(yearToDate._sum.netPay ?? 0)
    + Number(paidCorrections._sum.earningsDelta ?? 0)
    - Number(paidCorrections._sum.deductionsDelta ?? 0);
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([pageWidth, pageHeight]);
  const { business } = line.payrollRun;

  page.drawRectangle({ x: 0, y: pageHeight - 122, width: pageWidth, height: 122, color: pale });
  let logo = null;
  if (business.logo && business.logoMimeType === "image/png") logo = await document.embedPng(business.logo);
  if (business.logo && business.logoMimeType === "image/jpeg") logo = await document.embedJpg(business.logo);
  if (logo) {
    const dimensions = logo.scale(Math.min(1, 68 / logo.width, 68 / logo.height));
    page.drawImage(logo, { x: 48, y: pageHeight - 100, width: dimensions.width, height: dimensions.height });
  }
  const companyX = logo ? 132 : 48;
  page.drawText(printable(business.name), { x: companyX, y: pageHeight - 53, size: 18, font: bold, color: ink, maxWidth: 425 });
  const contact = [business.address, business.phone, business.email, business.website].filter(Boolean).join("  |  ");
  if (contact) page.drawText(printable(contact), { x: companyX, y: pageHeight - 72, size: 8, font: regular, color: muted, maxWidth: 425 });
  page.drawText("PAYSLIP", { x: 48, y: pageHeight - 160, size: 16, font: bold, color: green });
  page.drawText(`${monthName(line.payrollRun.month)} ${line.payrollRun.year}  ·  ${line.payrollRun.currency}`, { x: 48, y: pageHeight - 179, size: 10, font: regular, color: muted });

  page.drawRectangle({ x: 42, y: pageHeight - 288, width: 528, height: 82, color: rgb(0.97, 0.98, 0.98) });
  const employeeRows = [
    ["Employee", line.employeeName],
    ["Employee number", line.employeeNumber],
    ["Department / role", [line.departmentName, line.jobTitle].filter(Boolean).join(" · ") || "—"],
    ["Payment date", line.payrollRun.payDate?.toISOString().slice(0, 10) ?? "Not yet paid"],
  ];
  employeeRows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 56 + column * 265;
    const y = pageHeight - 230 - row * 31;
    page.drawText(printable(label), { x, y, size: 7, font: regular, color: muted });
    page.drawText(printable(value), { x, y: y - 13, size: 9, font: bold, color: ink, maxWidth: 245 });
  });

  let y = pageHeight - 325;
  addRow(page, regular, bold, y, "EARNINGS", "", true);
  y -= 24;
  for (const item of line.items.filter((entry) => entry.kind === "EARNING")) {
    addRow(page, regular, bold, y, item.name, moneyInCurrency(Number(item.amount), line.payrollRun.currency));
    y -= 18;
  }
  addRow(page, regular, bold, y, "Gross salary", moneyInCurrency(Number(line.gross), line.payrollRun.currency), true);
  y -= 30;
  addRow(page, regular, bold, y, "DEDUCTIONS", "", true);
  y -= 24;
  for (const item of line.items.filter((entry) => entry.kind !== "EARNING")) {
    addRow(page, regular, bold, y, `${item.name}${item.kind === "STATUTORY_DEDUCTION" ? " · Statutory" : ""}`, moneyInCurrency(Number(item.amount), line.payrollRun.currency));
    y -= 18;
  }
  addRow(page, regular, bold, y, "Total statutory deductions", moneyInCurrency(Number(line.statutoryDeductions), line.payrollRun.currency), true);
  y -= 19;
  addRow(page, regular, bold, y, "Total other deductions", moneyInCurrency(Number(line.otherDeductions), line.payrollRun.currency), true);
  y -= 30;
  page.drawRectangle({ x: 42, y: y - 13, width: 528, height: 36, color: pale });
  addRow(page, regular, bold, y, "NET SALARY PAYABLE", moneyInCurrency(Number(line.netPay), line.payrollRun.currency), true);
  y -= 52;
  page.drawText("YEAR TO DATE · SAME CURRENCY", { x: 48, y, size: 9, font: bold, color: green });
  y -= 20;
  addRow(page, regular, bold, y, "Gross earnings", moneyInCurrency(ytdGross, line.payrollRun.currency));
  y -= 17;
  addRow(page, regular, bold, y, "Statutory deductions", moneyInCurrency(Number(yearToDate._sum.statutoryDeductions ?? 0), line.payrollRun.currency));
  y -= 17;
  addRow(page, regular, bold, y, "Other deductions", moneyInCurrency(Number(yearToDate._sum.otherDeductions ?? 0) + Number(paidCorrections._sum.deductionsDelta ?? 0), line.payrollRun.currency));
  y -= 17;
  addRow(page, regular, bold, y, "Net paid / payable", moneyInCurrency(ytdNet, line.payrollRun.currency));
  page.drawLine({ start: { x: 48, y: 38 }, end: { x: 564, y: 38 }, thickness: 0.5, color: rgb(0.82, 0.85, 0.85) });
  page.drawText("Confidential payroll document · Generated from the approved payroll record", { x: 48, y: 24, size: 7, font: regular, color: muted });

  const bytes = await document.save();
  return { bytes, employeeNumber: line.employeeNumber, employeeName: line.employeeName, reference: line.payrollRun.reference };
}

function monthName(month: number) {
  return new Date(Date.UTC(2020, month - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });
}
