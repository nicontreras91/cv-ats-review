// app/api/report-pdf/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import path from "path";
import { readFile } from "fs/promises";

export const runtime = "nodejs";

type Lang = "es" | "en";

type BestMatch = {
  role: string;
  match_score: number; // 0-100
  why_fit: string[]; // 2-5
  missing_keywords: string[]; // 5-15
  recommended_changes: string[]; // 3-8
};

type ReviewResult = {
  ats_score: number;
  summary: string[];
  top_fixes: { title: string; why: string; example_fix: string }[];
  ats_checklist: { item: string; status: "ok" | "warn"; note: string }[];
  suggested_keywords: string[];
  rewritten_bullets: { original: string; improved: string }[];
  template_outline: string[];
  best_matches: BestMatch[]; // Top 3 cargos sugeridos
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { report: ReviewResult; lang?: Lang };
    const report = body?.report;
    const lang: Lang = body?.lang === "en" ? "en" : "es";

    if (!report) {
      return NextResponse.json({ error: "No llegó el reporte." }, { status: 400 });
    }

    const pdfBytes = await buildPdf(report, lang);

    const filename =
      lang === "en"
        ? "Resume Review Report - Revi.pdf"
        : "Reporte de Revisión de CV - Revi.pdf";

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error generando PDF" }, { status: 500 });
  }
}

async function buildPdf(r: ReviewResult, lang: Lang) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

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

  // -------- Fonts (Noto Sans, subset:false) with fallback --------
  let fontRegular: any;
  let fontBold: any;

  try {
    const regularPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const boldPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf");
    const [regularBytes, boldBytes] = await Promise.all([readFile(regularPath), readFile(boldPath)]);

    fontRegular = await pdf.embedFont(regularBytes, { subset: false });
    fontBold = await pdf.embedFont(boldBytes, { subset: false });
  } catch {
    // fallback seguro
    fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
    fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  function drawText(
    txt: string,
    x: number,
    yy: number,
    size: number,
    bold = false,
    color = BLACK
  ) {
    page.drawText(txt || "", { x, y: yy, size, font: bold ? fontBold : fontRegular, color });
  }

  function drawLine(x1: number, yy: number, x2: number, thickness = 1) {
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color: BLACK });
  }

  function card(x: number, yy: number, w: number, h: number) {
    page.drawRectangle({ x, y: yy, width: w, height: h, borderColor: BLACK, borderWidth: 1, color: rgb(1, 1, 1) });
  }

  function wrapText(text: string, maxWidth: number, size: number) {
    const words = (text || "").replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = fontRegular.widthOfTextAtSize(test, size);
      if (width <= maxWidth) line = test;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function blockTitle(title: string) {
    ensure(40);
    drawText(title, M, y, h2, true);
    y -= 12;
    drawLine(M, y, PAGE_W - M, 1);
    y -= 18;
  }

  function bulletList(items: string[], size = body) {
    const maxWidth = PAGE_W - M * 2 - 14;

    for (const it of items) {
      if (!it) continue;
      ensure(18);
      drawText("•", M, y, size, true, GRAY);
      const lines = wrapText(it, maxWidth, size);
      drawText(lines[0], M + 14, y, size, false, BLACK);
      y -= 14;

      for (let i = 1; i < lines.length; i++) {
        ensure(14);
        drawText(lines[i], M + 14, y, size, false, BLACK);
        y -= 14;
      }
      y -= 2;
    }
  }

  // ✅ Bullets compactos para keywords (en vez de pills)
  function bulletKeywords(items: string[], size = body) {
    const clean = (items || []).map((x) => (x || "").trim()).filter(Boolean);
    if (!clean.length) return;

    const maxWidth = PAGE_W - M * 2 - 14;

    for (const it of clean) {
      ensure(16);
      drawText("•", M, y, size, true, GRAY);
      const lines = wrapText(it, maxWidth, size);
      drawText(lines[0], M + 14, y, size, false, BLACK);
      y -= 14;

      for (let i = 1; i < lines.length; i++) {
        ensure(14);
        drawText(lines[i], M + 14, y, size, false, BLACK);
        y -= 14;
      }
    }

    y -= 6;
  }

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

    page.drawRectangle({
      x: x - 1,
      y: yy - size + 1,
      width: size + 2,
      height: size + 2,
      color: rgb(1, 0.98, 0.86),
      borderWidth: 0,
    });

    page.drawLine({ start: top, end: left, thickness: 1.2, color: BLACK });
    page.drawLine({ start: top, end: right, thickness: 1.2, color: BLACK });
    page.drawLine({ start: left, end: right, thickness: 1.2, color: BLACK });

    page.drawLine({
      start: { x: x + size / 2, y: yy - 3 },
      end: { x: x + size / 2, y: yy - size + 6 },
      thickness: 1.6,
      color: BLACK,
    });
    page.drawCircle({ x: x + size / 2, y: yy - size + 4, size: 1.4, color: BLACK });
  }

  // -------- Labels by language --------
  const L = {
    title: lang === "en" ? "Resume Review" : "Revisión de CV",
    generated: lang === "en" ? "Generated" : "Generado",
    atsScore: "ATS Score",
    top3: lang === "en" ? "Top 3 suggested roles (best match)" : "Top 3 cargos sugeridos (mejor match)",
    whyFit: lang === "en" ? "Why you're a fit" : "Por qué calzas",
    missing: lang === "en" ? "Missing keywords" : "Keywords faltantes",
    changes: lang === "en" ? "Recommended changes" : "Cambios recomendados",
    execSummary: lang === "en" ? "Executive summary" : "Resumen ejecutivo",
    fixes: lang === "en" ? "Top fixes (priority)" : "Top fixes (prioridad)",
    checklist: lang === "en" ? "ATS Checklist" : "Checklist ATS",
    suggested: lang === "en" ? "Suggested keywords" : "Keywords sugeridas",
    bullets: lang === "en" ? "Rewritten bullets" : "Bullets reescritos",
    original: lang === "en" ? "Original" : "Original",
    improved: lang === "en" ? "Improved" : "Mejorado",
    notDetected:
      lang === "en"
        ? "Not detected in the PDF (tables/images/columns)."
        : "No detectado en el PDF (posible tabla/imagen/columnas).",
    outline: lang === "en" ? "Recommended structure" : "Estructura recomendada",
    footer: "Revi",
  };

  // -------- Header --------
  drawText(L.title, M, y, h1, true);
  y -= 22;

  const date = new Date();
  drawText(
    `${L.generated}: ${date.toLocaleDateString(lang === "en" ? "en-US" : "es-CL")}`,
    M,
    y,
    small,
    false,
    GRAY
  );
  y -= 22;

  // -------- ATS Score Card (same info as web: score + summary bullets) --------
  ensure(150);

  const cardH = 140; // ✅ más alto para que quepan bullets
  const cardY = y - cardH;
  card(M, cardY, PAGE_W - M * 2, cardH);

  drawText(L.atsScore, M + 14, y - 22, h2, true);
  drawText(`${r.ats_score}/100`, PAGE_W - M - 120, y - 42, 26, true);

  // ✅ Bullets del summary (igual que web)
  const cardBullets = (r.summary || []).slice(0, 5);
  let yy = y - 60;
  const maxWidth = PAGE_W - M * 2 - 28;

  for (const s of cardBullets) {
    if (!s) continue;

    drawText("•", M + 14, yy, small, true, GRAY);
    const lines = wrapText(s, maxWidth, small);
    drawText(lines[0], M + 28, yy, small, false, GRAY);
    yy -= 12;

    for (let i = 1; i < lines.length; i++) {
      ensure(12);
      drawText(lines[i], M + 28, yy, small, false, GRAY);
      yy -= 12;
    }

    yy -= 2;
  }

  y = cardY - 26;

  // -------- Top 3 suggested roles --------
  const matches = Array.isArray(r.best_matches) ? r.best_matches.slice(0, 3) : [];
  if (matches.length) {
    blockTitle(L.top3);

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      ensure(170);

      drawText(`${i + 1}. ${m.role}`, M, y, body, true);
      drawText(`${m.match_score}/100`, PAGE_W - M - 70, y, body, true);
      y -= 14;

      drawText(L.whyFit, M, y, small, true, GRAY);
      y -= 12;
      bulletList((m.why_fit || []).slice(0, 5), body);
      y -= 4;

      drawText(L.missing, M, y, small, true, GRAY);
      y -= 12;
      // ✅ Bullets en vez de pills
      bulletKeywords((m.missing_keywords || []).slice(0, 12), body);

      drawText(L.changes, M, y, small, true, GRAY);
      y -= 12;
      bulletList((m.recommended_changes || []).slice(0, 6), body);

      y -= 8;
      drawLine(M, y, PAGE_W - M, 0.6);
      y -= 14;
    }
  }

  // -------- Executive summary (igual que data de web, aquí completo) --------
  blockTitle(L.execSummary);
  bulletList((r.summary || []).slice(0, 6), body);

  // -------- Top fixes --------
  blockTitle(L.fixes);
  const fixes = (r.top_fixes || []).slice(0, 5);
  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    ensure(72);

    drawText(`${i + 1}. ${f.title}`, M, y, body, true);
    y -= 14;

    const whyLines = wrapText(f.why, PAGE_W - M * 2, small);
    for (const ln of whyLines) {
      ensure(12);
      drawText(ln, M, y, small, false, GRAY);
      y -= 12;
    }

    const exLabel = lang === "en" ? "Example: " : "Ejemplo: ";
    const ex = `${exLabel}${f.example_fix}`;
    const exLines = wrapText(ex, PAGE_W - M * 2, small);
    for (const ln of exLines) {
      ensure(12);
      drawText(ln, M, y, small, false, BLACK);
      y -= 12;
    }

    y -= 6;
    drawLine(M, y, PAGE_W - M, 0.5);
    y -= 12;
  }

  // -------- Checklist --------
  blockTitle(L.checklist);
  const checklist = (r.ats_checklist || []).slice(0, 12);
  for (const c of checklist) {
    ensure(34);

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
    y -= 8;
  }

  // -------- Suggested keywords (bullets) --------
  blockTitle(L.suggested);
  bulletKeywords((r.suggested_keywords || []).slice(0, 20), body);

  // -------- Rewritten bullets --------
  blockTitle(L.bullets);
  const bullets = (r.rewritten_bullets || []).slice(0, 5);
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    ensure(96);

    drawText(`#${i + 1}`, M, y, small, true, GRAY);
    y -= 14;

    drawText(L.original, M, y, small, true, GRAY);
    y -= 12;

    const orig = b.original?.trim()
      ? `• ${b.original.trim()}`
      : L.notDetected;

    const origLines = wrapText(orig, PAGE_W - M * 2, body);
    for (const ln of origLines) {
      ensure(14);
      drawText(ln, M, y, body, false);
      y -= 14;
    }

    y -= 8;

    drawText(L.improved, M, y, small, true, GRAY);
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

  // -------- Outline --------
  blockTitle(L.outline);
  const outline = (r.template_outline || []).slice(0, 7);
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

  // -------- Footer --------
  const pages = pdf.getPages();
  for (let idx = 0; idx < pages.length; idx++) {
    const p = pages[idx];
    const footer = `${L.footer} • ${lang === "en" ? "Page" : "Página"} ${idx + 1}/${pages.length}`;
    p.drawText(footer, { x: M, y: 24, size: small, font: fontRegular, color: GRAY });
  }

  return await pdf.save();
}
