// ✅ Archivo: app/api/report-pdf/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

type ReviewResult = {
  ats_score: number;
  summary: string[];
  top_fixes: { title: string; why: string; example_fix: string }[];
  ats_checklist: { item: string; status: "ok" | "warn"; note: string }[];
  suggested_keywords: string[];
  rewritten_bullets: { original: string; improved: string }[];
  template_outline: string[];
};

export async function POST(req: Request) {
  try {
    const { report, roleTarget } = (await req.json()) as {
      report: ReviewResult;
      roleTarget?: string;
    };

    if (!report) {
      return NextResponse.json({ error: "No llegó el reporte." }, { status: 400 });
    }

    const pdfBytes = await buildPdf(report, roleTarget || "");

    // ✅ FIX: NextResponse espera BodyInit -> usamos ArrayBuffer
    const body = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte-ats.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error generando PDF" },
      { status: 500 }
    );
  }
}

async function buildPdf(r: ReviewResult, roleTarget: string) {
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // A4
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const M = 48;

  // Colores
  const BLACK = rgb(0, 0, 0);
  const GRAY = rgb(0.35, 0.35, 0.35);
  const LIGHT = rgb(0.95, 0.95, 0.95);

  // Tipografía
  const h1 = 18;
  const h2 = 12.5;
  const body = 10.5;
  const small = 9;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
  }

  function ensure(space: number) {
    if (y - space < M) newPage();
  }

  function drawText(
    txt: string,
    x: number,
    yy: number,
    size: number,
    bold = false,
    color = BLACK
  ) {
    page.drawText(txt, {
      x,
      y: yy,
      size,
      font: bold ? fontBold : fontRegular,
      color,
    });
  }

  function drawLine(x1: number, yy: number, x2: number, thickness = 1) {
    page.drawLine({
      start: { x: x1, y: yy },
      end: { x: x2, y: yy },
      thickness,
      color: BLACK,
    });
  }

  function card(x: number, yy: number, w: number, h: number) {
    page.drawRectangle({
      x,
      y: yy,
      width: w,
      height: h,
      borderColor: BLACK,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });
  }

  function wrapText(text: string, maxWidth: number, size: number) {
    const words = (text || "").replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = fontRegular.widthOfTextAtSize(test, size);
      if (width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function blockTitle(title: string) {
    ensure(30);
    drawText(title, M, y, h2, true);
    y -= 10;
    drawLine(M, y, PAGE_W - M, 1);
    y -= 14;
  }

  function bulletList(items: string[], size = body) {
    const maxWidth = PAGE_W - M * 2 - 14;
    for (const it of items) {
      ensure(18);
      drawText("•", M, y, size, true);
      const lines = wrapText(it, maxWidth, size);
      drawText(lines[0], M + 14, y, size, false);
      y -= 14;
      for (let i = 1; i < lines.length; i++) {
        ensure(14);
        drawText(lines[i], M + 14, y, size, false);
        y -= 14;
      }
      y -= 2;
    }
  }

  function pillRow(items: string[]) {
    const maxW = PAGE_W - M * 2;
    let x = M;
    let rowY = y;

    for (const k of items) {
      const label = (k || "").trim();
      if (!label) continue;

      const padX = 8;
      const padY = 5;
      const textW = fontRegular.widthOfTextAtSize(label, small);
      const boxW = textW + padX * 2;
      const boxH = small + padY * 2;

      if (x + boxW > M + maxW) {
        y -= boxH + 8;
        ensure(0);
        x = M;
        rowY = y;
      }

      page.drawRectangle({
        x,
        y: rowY - padY,
        width: boxW,
        height: boxH,
        borderColor: BLACK,
        borderWidth: 1,
        color: LIGHT,
      });

      drawText(label, x + padX, rowY + padY, small, false, BLACK);
      x += boxW + 8;
    }

    y -= 34;
  }

  // ✅ Iconos vectoriales
  function drawCheckIcon(x: number, yy: number, size = 12) {
    page.drawRectangle({
      x,
      y: yy - size + 2,
      width: size,
      height: size,
      borderColor: BLACK,
      borderWidth: 1,
      color: rgb(0.92, 1, 0.92),
    });

    page.drawLine({
      start: { x: x + 2, y: yy - size / 2 },
      end: { x: x + 5, y: yy - size + 4 },
      thickness: 1.6,
      color: rgb(0, 0.5, 0),
    });

    page.drawLine({
      start: { x: x + 5, y: yy - size + 4 },
      end: { x: x + size - 2, y: yy - 2 },
      thickness: 1.6,
      color: rgb(0, 0.5, 0),
    });
  }

  function drawWarnIcon(x: number, yy: number, size = 12) {
    const top = { x: x + size / 2, y: yy };
    const left = { x, y: yy - size + 2 };
    const right = { x: x + size, y: yy - size + 2 };

    // fondo suave
    page.drawRectangle({
      x: x - 1,
      y: yy - size + 1,
      width: size + 2,
      height: size + 2,
      color: rgb(1, 0.98, 0.86),
      borderWidth: 0,
    });

    // triángulo contorno
    page.drawLine({ start: top, end: left, thickness: 1.2, color: BLACK });
    page.drawLine({ start: top, end: right, thickness: 1.2, color: BLACK });
    page.drawLine({ start: left, end: right, thickness: 1.2, color: BLACK });

    // "!" dentro
    page.drawLine({
      start: { x: x + size / 2, y: yy - 3 },
      end: { x: x + size / 2, y: yy - size + 6 },
      thickness: 1.6,
      color: BLACK,
    });

    page.drawCircle({
      x: x + size / 2,
      y: yy - size + 4,
      size: 1.4,
      color: BLACK,
    });
  }

  // Header
  drawText("Reporte ATS — CV Review", M, y, h1, true);
  y -= 22;

  const date = new Date();
  drawText(`Generado: ${date.toLocaleDateString()}`, M, y, small, false, GRAY);
  y -= 18;

  if (roleTarget) {
    drawText(`Cargo objetivo: ${roleTarget}`, M, y, body, false);
    y -= 16;
  }

  // Score card
  ensure(80);
  const cardH = 70;
  const cardY = y - cardH;
  card(M, cardY, PAGE_W - M * 2, cardH);

  drawText("ATS Score", M + 14, y - 22, h2, true);
  drawText(`${r.ats_score}/100`, PAGE_W - M - 120, y - 40, 26, true);

  const diagnosis =
    r.ats_score >= 85
      ? "Muy sólido. Pulir detalles para maximizar conversión."
      : r.ats_score >= 70
      ? "Bueno, con oportunidades claras de mejora ATS."
      : "Riesgo alto en ATS. Conviene reestructurar y optimizar keywords.";

  drawText(diagnosis, M + 14, y - 50, body, false, GRAY);
  y = cardY - 24;

  // Resumen
  blockTitle("Resumen ejecutivo");
  bulletList((r.summary || []).slice(0, 6), body);

  // Top fixes
  blockTitle("Top fixes (prioridad)");
  const fixes = (r.top_fixes || []).slice(0, 7);
  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    ensure(62);

    drawText(`${i + 1}. ${f.title}`, M, y, body, true);
    y -= 14;

    const whyLines = wrapText(f.why, PAGE_W - M * 2, small);
    for (const ln of whyLines) {
      ensure(12);
      drawText(ln, M, y, small, false, GRAY);
      y -= 12;
    }

    const ex = `Ejemplo: ${f.example_fix}`;
    const exLines = wrapText(ex, PAGE_W - M * 2, small);
    for (const ln of exLines) {
      ensure(12);
      drawText(ln, M, y, small, false, BLACK);
      y -= 12;
    }

    y -= 6;
    drawLine(M, y, PAGE_W - M, 0.5);
    y -= 10;
  }

  // Checklist
  blockTitle("Checklist ATS");
  const checklist = (r.ats_checklist || []).slice(0, 18);

  for (const c of checklist) {
    ensure(30);

    if (c.status === "ok") drawCheckIcon(M, y, 12);
    else drawWarnIcon(M, y, 12);

    drawText(`${c.item}`, M + 18, y, body, true);
    y -= 14;

    const noteLines = wrapText(c.note || "", PAGE_W - M * 2 - 18, small);
    for (const ln of noteLines) {
      ensure(12);
      drawText(ln, M + 18, y, small, false, GRAY);
      y -= 12;
    }
    y -= 6;
  }

  // Keywords
  blockTitle("Keywords sugeridas");
  pillRow((r.suggested_keywords || []).slice(0, 20));

  // Bullets reescritos
  blockTitle("Bullets reescritos");
  const bullets = (r.rewritten_bullets || []).slice(0, 10);

  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    ensure(92);

    drawText(`#${i + 1}`, M, y, small, true, GRAY);
    y -= 14;

    drawText("Original", M, y, small, true);
    y -= 12;

    const orig = b.original?.trim()
      ? `• ${b.original.trim()}`
      : "No detectado en el PDF (posible tabla/imagen/columnas).";

    const origLines = wrapText(orig, PAGE_W - M * 2, body);
    for (const ln of origLines) {
      ensure(14);
      drawText(ln, M, y, body, false);
      y -= 14;
    }

    y -= 8;

    drawText("Mejorado", M, y, small, true);
    y -= 12;

    const imp = `• ${b.improved || ""}`;
    const impLines = wrapText(imp, PAGE_W - M * 2, body);
    for (const ln of impLines) {
      ensure(14);
      drawText(ln, M, y, body, false);
      y -= 14;
    }

    y -= 12;
    drawLine(M, y, PAGE_W - M, 0.5);
    y -= 14;
  }

  // Outline
  blockTitle("Estructura recomendada");
  const outline = (r.template_outline || []).slice(0, 10);
  for (let i = 0; i < outline.length; i++) {
    ensure(18);
    const line = `${i + 1}. ${outline[i]}`;
    const lines = wrapText(line, PAGE_W - M * 2, body);
    for (const ln of lines) {
      ensure(14);
      drawText(ln, M, y, body, false);
      y -= 14;
    }
    y -= 2;
  }

  // Footer
  const pages = pdf.getPages();
  for (let idx = 0; idx < pages.length; idx++) {
    const p = pages[idx];
    const footer = `CV Review • Página ${idx + 1}/${pages.length}`;
    p.drawText(footer, {
      x: M,
      y: 24,
      size: small,
      font: fontRegular,
      color: GRAY,
    });
  }

  return await pdf.save(); // Uint8Array
}
