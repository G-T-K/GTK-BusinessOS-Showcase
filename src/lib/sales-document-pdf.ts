import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type BusinessProfile = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: Uint8Array | null;
  logoMimeType: string | null;
  baseCurrency: string;
};

type DocumentLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type SalesDocumentPdfInput = {
  kind: "Quotation" | "Invoice";
  reference: string;
  status: string;
  business: BusinessProfile;
  customer: {
    name: string;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  currency: string;
  createdAt: Date;
  dueLabel?: string;
  validUntil?: Date | null;
  lines: DocumentLine[];
  total: number;
  totalBase: number;
  amountPaidBase?: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const GREEN = rgb(0.08, 0.36, 0.22);
const MUTED = rgb(0.39, 0.43, 0.41);
const LIGHT = rgb(0.92, 0.96, 0.93);
const DARK = rgb(0.12, 0.16, 0.14);

function safeText(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

function formatAmount(value: number, currency: string) {
  const amount = Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const marker = currency === "USD" ? "$" : currency === "ZAR" ? "R" : `${currency} `;
  return `${marker}${amount}`;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
  color = MUTED,
) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(nextLine, size) > width) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= size + 3;
      line = word;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    page.drawText(line, { x, y: currentY, size, font, color });
    currentY -= size + 3;
  }

  return currentY;
}

function drawTableHeader(page: PDFPage, y: number, font: PDFFont) {
  page.drawRectangle({ x: MARGIN, y: y - 19, width: PAGE_WIDTH - MARGIN * 2, height: 26, color: GREEN });
  page.drawText("Description", { x: MARGIN + 10, y: y - 10, size: 9, font, color: rgb(1, 1, 1) });
  page.drawText("Qty", { x: 345, y: y - 10, size: 9, font, color: rgb(1, 1, 1) });
  page.drawText("Unit price", { x: 395, y: y - 10, size: 9, font, color: rgb(1, 1, 1) });
  page.drawText("Amount", { x: 492, y: y - 10, size: 9, font, color: rgb(1, 1, 1) });
  return y - 31;
}

export async function createSalesDocumentPdf(input: SalesDocumentPdfInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`${input.kind} ${input.reference}`);
  pdf.setAuthor(safeText(input.business.name));

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = 1;

  const drawBrandHeader = async (target: PDFPage) => {
    let textX = MARGIN;
    if (input.business.logo && input.business.logoMimeType) {
      try {
        const image = input.business.logoMimeType === "image/png"
          ? await pdf.embedPng(input.business.logo)
          : await pdf.embedJpg(input.business.logo);
        const scale = Math.min(76 / image.width, 54 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        target.drawImage(image, { x: MARGIN, y: PAGE_HEIGHT - MARGIN - height, width, height });
        textX = MARGIN + 90;
      } catch {
        textX = MARGIN;
      }
    }

    target.drawText(safeText(input.business.name), {
      x: textX,
      y: PAGE_HEIGHT - MARGIN - 14,
      size: 15,
      font: bold,
      color: DARK,
      maxWidth: 260,
    });

    let contactY = PAGE_HEIGHT - MARGIN - 31;
    for (const detail of [input.business.address, input.business.phone, input.business.email, input.business.website]) {
      if (detail) {
        contactY = drawWrappedText(target, detail, textX, contactY, 260, regular, 8.5);
      }
    }

    const title = input.kind.toUpperCase();
    const titleWidth = bold.widthOfTextAtSize(title, 20);
    target.drawText(title, {
      x: PAGE_WIDTH - MARGIN - titleWidth,
      y: PAGE_HEIGHT - MARGIN - 12,
      size: 20,
      font: bold,
      color: GREEN,
    });
    const referenceWidth = regular.widthOfTextAtSize(safeText(input.reference), 10);
    target.drawText(safeText(input.reference), {
      x: PAGE_WIDTH - MARGIN - referenceWidth,
      y: PAGE_HEIGHT - MARGIN - 30,
      size: 10,
      font: regular,
      color: MUTED,
    });
    const status = safeText(input.status.replace(/_/g, " "));
    const statusWidth = regular.widthOfTextAtSize(status, 8);
    target.drawText(status, {
      x: PAGE_WIDTH - MARGIN - statusWidth,
      y: PAGE_HEIGHT - MARGIN - 45,
      size: 8,
      font: regular,
      color: MUTED,
    });

    target.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - 140 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 140 },
      thickness: 1,
      color: LIGHT,
    });
  };

  const drawFooter = (target: PDFPage, number: number) => {
    target.drawLine({
      start: { x: MARGIN, y: 38 },
      end: { x: PAGE_WIDTH - MARGIN, y: 38 },
      thickness: 0.7,
      color: LIGHT,
    });
    target.drawText("Generated by GTK BusinessOS", { x: MARGIN, y: 24, size: 8, font: regular, color: MUTED });
    const pageLabel = `Page ${number}`;
    const labelWidth = regular.widthOfTextAtSize(pageLabel, 8);
    target.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - labelWidth, y: 24, size: 8, font: regular, color: MUTED });
  };

  await drawBrandHeader(page);

  let y = PAGE_HEIGHT - 166;
  page.drawText("BILL TO", { x: MARGIN, y, size: 8, font: bold, color: GREEN });
  y -= 16;
  page.drawText(safeText(input.customer.name), { x: MARGIN, y, size: 11, font: bold, color: DARK });
  y -= 15;
  for (const detail of [input.customer.address, input.customer.phone, input.customer.email]) {
    if (detail) y = drawWrappedText(page, detail, MARGIN, y, 240, regular, 8.5);
  }

  const dateLines = [
    `Date: ${input.createdAt.toLocaleDateString("en-GB")}`,
    input.dueLabel ? `Due: ${input.dueLabel}` : null,
    input.validUntil ? `Valid until: ${input.validUntil.toLocaleDateString("en-GB")}` : null,
  ].filter((line): line is string => Boolean(line));
  let dateY = PAGE_HEIGHT - 166;
  for (const line of dateLines) {
    const width = regular.widthOfTextAtSize(safeText(line), 9);
    page.drawText(safeText(line), { x: PAGE_WIDTH - MARGIN - width, y: dateY, size: 9, font: regular, color: MUTED });
    dateY -= 15;
  }

  y = Math.min(y - 12, PAGE_HEIGHT - 248);
  y = drawTableHeader(page, y, bold);

  for (const line of input.lines) {
    if (y < 90) {
      drawFooter(page, pageNumber);
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNumber += 1;
      await drawBrandHeader(page);
      y = drawTableHeader(page, PAGE_HEIGHT - 166, bold);
    }

    page.drawLine({
      start: { x: MARGIN, y: y - 9 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - 9 },
      thickness: 0.5,
      color: LIGHT,
    });
    page.drawText(safeText(line.name).slice(0, 42), { x: MARGIN + 10, y, size: 9, font: regular, color: DARK });
    const qty = Number(line.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 });
    page.drawText(qty, { x: 345, y, size: 8.5, font: regular, color: DARK });
    page.drawText(formatAmount(line.unitPrice, input.currency), { x: 395, y, size: 8.5, font: regular, color: DARK });
    page.drawText(formatAmount(line.total, input.currency), { x: 492, y, size: 8.5, font: regular, color: DARK });
    y -= 27;
  }

  if (y < 130) {
    drawFooter(page, pageNumber);
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    await drawBrandHeader(page);
    y = PAGE_HEIGHT - 170;
  }

  y -= 5;
  page.drawRectangle({ x: 345, y: y - 12, width: PAGE_WIDTH - MARGIN - 345, height: 30, color: LIGHT });
  page.drawText("Total", { x: 357, y: y - 1, size: 10, font: bold, color: DARK });
  const totalText = formatAmount(input.total, input.currency);
  const totalWidth = bold.widthOfTextAtSize(totalText, 10);
  page.drawText(totalText, { x: PAGE_WIDTH - MARGIN - totalWidth - 10, y: y - 1, size: 10, font: bold, color: DARK });
  y -= 30;

  if (input.kind === "Invoice") {
    if (input.business.baseCurrency !== input.currency) {
      page.drawText(`Base total (${input.business.baseCurrency}): ${formatAmount(input.totalBase, input.business.baseCurrency)}`, {
        x: 345, y, size: 8.5, font: regular, color: MUTED,
      });
      y -= 15;
    }
    const paid = input.amountPaidBase ?? 0;
    page.drawText(`Paid (${input.business.baseCurrency}): ${formatAmount(paid, input.business.baseCurrency)}`, {
      x: 345, y, size: 8.5, font: regular, color: MUTED,
    });
    y -= 15;
    page.drawText(`Balance (${input.business.baseCurrency}): ${formatAmount(input.totalBase - paid, input.business.baseCurrency)}`, {
      x: 345, y, size: 8.5, font: bold, color: DARK,
    });
  }

  pdf.getPages().forEach((documentPage, index) => drawFooter(documentPage, index + 1));
  return pdf.save();
}