import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/role-permissions";
import { createPayslipPdf } from "@/lib/payroll-pdf";

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFiles(files: { name: string; data: Buffer }[]) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(file.data.length, 18);
    header.writeUInt32LE(file.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, file.data);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8);
    directory.writeUInt16LE(0, 10);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(file.data.length, 20);
    directory.writeUInt32LE(file.data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + file.data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

export async function GET(_request: Request, { params }: { params: { runId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const user = session.user as typeof session.user & { id?: string; businessId?: string };
  if (!user.id || !user.businessId) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, businessId: user.businessId, active: true },
    select: { role: true },
  });
  if (!membership || !hasPermission(membership.role, "payrollSensitive")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.runId, businessId: user.businessId, status: { in: ["APPROVED", "PAID"] } },
    include: { lines: { select: { id: true, employeeNumber: true } } },
  });
  if (!run) return NextResponse.json({ error: "Approved payroll run not found" }, { status: 404 });

  const files: { name: string; data: Buffer }[] = [];
  for (const line of run.lines) {
    const payslip = await createPayslipPdf(line.id, user.businessId);
    if (payslip) files.push({ name: `${line.employeeNumber}-${run.reference}.pdf`, data: Buffer.from(payslip.bytes) });
  }
  if (files.length === 0) return NextResponse.json({ error: "No payslips are available for this run" }, { status: 404 });
  await logAction({
    businessId: user.businessId,
    userId: user.id,
    action: "payroll.payslips_bulk_generated",
    entityType: "PayrollRun",
    entityId: run.id,
    metadata: { reference: run.reference, count: files.length },
  });
  const bytes = zipFiles(files);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${run.reference}-payslips.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
