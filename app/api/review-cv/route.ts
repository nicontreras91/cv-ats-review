// ✅ Archivo: app/api/review-cv/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ReviewResult = {
  ats_score: number;
  summary: string[];
  top_fixes: { title: string; why: string; example_fix: string }[];
  ats_checklist: { item: string; status: "ok" | "warn"; note: string }[];
  suggested_keywords: string[];
  rewritten_bullets: { original: string; improved: string }[];
  template_outline: string[];
};

const ATS_SCHEMA = {
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ats_score: { type: "number", minimum: 0, maximum: 100 },
      summary: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
      top_fixes: {
        type: "array",
        minItems: 7,
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            why: { type: "string" },
            example_fix: { type: "string" },
          },
          required: ["title", "why", "example_fix"],
        },
      },
      ats_checklist: {
        type: "array",
        minItems: 12,
        maxItems: 18,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            item: { type: "string" },
            status: { type: "string", enum: ["ok", "warn"] },
            note: { type: "string" },
          },
          required: ["item", "status", "note"],
        },
      },
      suggested_keywords: { type: "array", minItems: 10, maxItems: 20, items: { type: "string" } },
      rewritten_bullets: {
        type: "array",
        minItems: 6,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            original: { type: "string" },
            improved: { type: "string" },
          },
          required: ["original", "improved"],
        },
      },
      template_outline: { type: "array", minItems: 6, maxItems: 10, items: { type: "string" } },
    },
    required: [
      "ats_score",
      "summary",
      "top_fixes",
      "ats_checklist",
      "suggested_keywords",
      "rewritten_bullets",
      "template_outline",
    ],
  },
} as const;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Falta OPENAI_API_KEY en .env.local" }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("cv");
    const roleTarget = (form.get("roleTarget")?.toString() || "").trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No llegó el archivo 'cv' (PDF)." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Archivo inválido: debe ser PDF." }, { status: 400 });
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "El PDF es muy grande. Máximo 5MB." }, { status: 400 });
    }

    // ✅ Validación páginas (máx 2) ANTES de OpenAI
    const bytes = new Uint8Array(await file.arrayBuffer());
    let pageCount = 0;
    try {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pageCount = pdf.getPageCount();
    } catch {
      return NextResponse.json({ error: "No pude leer el PDF. Exporta nuevamente y reintenta." }, { status: 400 });
    }

    if (pageCount > 2) {
      return NextResponse.json({ error: `Tu CV tiene ${pageCount} páginas. Máximo permitido: 2.` }, { status: 400 });
    }

    const uploaded = await client.files.create({ file, purpose: "assistants" });

    const system = `
Eres un revisor experto de CVs orientado a ATS.
Reglas:
- NO inventes datos: usa placeholders [X], [N], [CLP], [%].
- Devuelve exactamente 7 top_fixes.
- ats_checklist.note siempre string ("" si no aplica).
- rewritten_bullets.original siempre string ("" si no existe claro).
- Si no encuentras bullets textuales claros, usa frases exactas de Experiencia como 'original' (evita original vacío).
- Responde SOLO con JSON que cumpla el schema.
`.trim();

    const user = `
Analiza el CV adjunto (PDF, 1-2 páginas) y entrega un reporte ATS.
Cargo objetivo (opcional): ${roleTarget || "No especificado (infierelo del CV)"}.
Evalúa: formato ATS, secciones, keywords, logros, ortografía y claridad.
`.trim();

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "input_text", text: user },
            { type: "input_file", file_id: uploaded.id },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ats_review",
          schema: ATS_SCHEMA.schema,
          strict: true,
        },
      },
      max_output_tokens: 1600,
      temperature: 0,
    });

    const raw = extractAnything(resp);

    if (!raw || raw.trim().length < 2) {
      return NextResponse.json(
        { error: "Respuesta vacía desde OpenAI (no se pudo extraer contenido).", debug: summarizeResponseShape(resp) },
        { status: 500 }
      );
    }

    const parsed = robustJsonParse<ReviewResult>(raw);

    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: "La IA devolvió una respuesta no-JSON (inesperado).",
          raw_length: raw.length,
          raw_snippet: raw.slice(0, 1200),
          raw_tail: raw.slice(Math.max(0, raw.length - 300)),
          debug: summarizeResponseShape(resp),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.value, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error desconocido" }, { status: 500 });
  }
}

function extractAnything(resp: any): string {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text.trim();

  const out = resp?.output;
  if (Array.isArray(out)) {
    const parts: string[] = [];
    for (const msg of out) {
      const content = msg?.content;
      if (!Array.isArray(content)) continue;

      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") parts.push(c.text);
        else if (c?.type === "text" && typeof c?.text === "string") parts.push(c.text);
        else if (typeof c?.output_text === "string") parts.push(c.output_text);
      }
    }
    return parts.join("").trim();
  }
  return "";
}

function summarizeResponseShape(resp: any) {
  const summary: any = {
    has_output_text: typeof resp?.output_text === "string" ? resp.output_text.length : false,
    output_count: Array.isArray(resp?.output) ? resp.output.length : 0,
    output_types: [] as any[],
  };

  if (Array.isArray(resp?.output)) {
    for (const msg of resp.output) {
      summary.output_types.push({
        type: msg?.type,
        content_count: Array.isArray(msg?.content) ? msg.content.length : 0,
        content_types: Array.isArray(msg?.content) ? msg.content.map((c: any) => c?.type) : [],
        sample_text: Array.isArray(msg?.content)
          ? (msg.content.find((c: any) => typeof c?.text === "string")?.text || "").slice(0, 120)
          : "",
      });
    }
  }
  return summary;
}

function robustJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  const cleaned = (text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  const direct = tryParseObject<T>(cleaned);
  if (direct.ok) return direct;

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);

    const sliced = tryParseObject<T>(slice);
    if (sliced.ok) return sliced;

    const unescapedSlice = unescapeJsonish(slice);
    const unesc1 = tryParseObject<T>(unescapedSlice);
    if (unesc1.ok) return unesc1;

    const dbl = tryDoubleParse<T>(unescapedSlice);
    if (dbl.ok) return dbl;
  }

  const unescapedAll = unescapeJsonish(cleaned);
  const unescAllParsed = tryParseObject<T>(unescapedAll);
  if (unescAllParsed.ok) return unescAllParsed;

  const dbl2 = tryDoubleParse<T>(cleaned);
  if (dbl2.ok) return dbl2;

  const dbl3 = tryDoubleParse<T>(unescapedAll);
  if (dbl3.ok) return dbl3;

  return { ok: false, error: "No se pudo parsear JSON (directo/recorte/unescape/double-parse)." };
}

function tryParseObject<T>(s: string): { ok: true; value: T } | { ok: false } {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object") return { ok: true, value: v as T };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function tryDoubleParse<T>(s: string): { ok: true; value: T } | { ok: false } {
  try {
    const first = JSON.parse(s);
    if (typeof first !== "string") return { ok: false };
    const second = JSON.parse(first);
    if (second && typeof second === "object") return { ok: true, value: second as T };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function unescapeJsonish(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}
