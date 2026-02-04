// ✅ Archivo: app/api/review-cv/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type BestMatch = {
  role: string;
  match_score: number; // 0-100
  why_fit: string[]; // 2-4
  missing_keywords: string[]; // 5-12
  recommended_changes: string[]; // 3-6
};

type ReviewResult = {
  ats_score: number;
  summary: string[];
  top_fixes: { title: string; why: string; example_fix: string }[]; // EXACTO 5
  ats_checklist: { item: string; status: "ok" | "warn"; note: string }[];
  suggested_keywords: string[];
  rewritten_bullets: { original: string; improved: string }[]; // EXACTO 5
  template_outline: string[];
  best_matches: BestMatch[]; // EXACTO 3
};

const ATS_SCHEMA = {
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ats_score: { type: "number", minimum: 0, maximum: 100 },

      summary: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
      },

      top_fixes: {
        type: "array",
        minItems: 5,
        maxItems: 5,
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
        minItems: 10,
        maxItems: 12,
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

      suggested_keywords: {
        type: "array",
        minItems: 10,
        maxItems: 18,
        items: { type: "string" },
      },

      rewritten_bullets: {
        type: "array",
        minItems: 5,
        maxItems: 5,
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

      template_outline: {
        type: "array",
        minItems: 5,
        maxItems: 7,
        items: { type: "string" },
      },

      best_matches: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            role: { type: "string" },
            match_score: { type: "number", minimum: 0, maximum: 100 },
            why_fit: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
            missing_keywords: { type: "array", minItems: 5, maxItems: 12, items: { type: "string" } },
            recommended_changes: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
          },
          required: ["role", "match_score", "why_fit", "missing_keywords", "recommended_changes"],
        },
      },
    },
    required: [
      "ats_score",
      "summary",
      "top_fixes",
      "ats_checklist",
      "suggested_keywords",
      "rewritten_bullets",
      "template_outline",
      "best_matches",
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

    // ✅ Idioma deseado (viene desde el front)
    const langRaw = (form.get("lang")?.toString() || "").toLowerCase();
    const lang: "es" | "en" = langRaw === "en" ? "en" : "es";

    const outputLanguageInstruction =
      lang === "en"
        ? "Output language: ENGLISH. Every string field in the JSON must be in English (including bullets, notes, fixes, and role names). Do not mix languages."
        : "Idioma de salida: ESPAÑOL. Cada campo string del JSON debe estar en español (incluyendo bullets, notas, fixes y nombres de cargos). No mezcles idiomas.";

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

    // ✅ Validación páginas (máx 2)
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
Eres un revisor experto de CVs orientado a ATS y selección ejecutiva.

Reglas duras (NO negociables):
- Responde SOLO con JSON válido que cumpla el schema (sin texto fuera del JSON).
- NO inventes datos del candidato: si falta info usa placeholders [X], [N], [CLP], [%].
- Devuelve exactamente 5 top_fixes (ni más ni menos).
- Devuelve exactamente 5 rewritten_bullets (ni más ni menos).
- best_matches debe venir EXACTO con 3 roles (ni más ni menos) y deben ser roles razonables según el CV real.
- suggested_keywords: SOLO keywords ATS (sin nombres de campos como "original", "improved", "rewritten_bullets", etc).
- NO incluyas fragmentos de JSON dentro de strings (por ejemplo: "]}, {").
- Cada string debe ser texto humano limpio (sin llaves, sin comillas sueltas).
- NO mezcles idiomas dentro del mismo reporte.

${outputLanguageInstruction}
`.trim();

    const user = `
Analiza el CV adjunto (PDF, 1-2 páginas) y entrega un reporte ATS ejecutivo y accionable.

Instrucciones:
- Evalúa formato ATS, secciones, keywords, logros, claridad y consistencia.
- best_matches: elige los 3 cargos con mejor match para este CV, con:
  - match_score (0-100)
  - why_fit (2-4 bullets)
  - missing_keywords (5-12)
  - recommended_changes (3-6 cambios concretos)

${lang === "en" ? "Write the entire report in English." : "Escribe todo el reporte en español."}
`.trim();

    // ✅ hacemos 2 intentos, pero SIEMPRE intentamos parsear aunque status venga "incomplete"
    let resp = await callOpenAI({
      system,
      user,
      fileId: uploaded.id,
      schema: ATS_SCHEMA.schema,
      schemaName: "ats_review",
      maxOutputTokens: 1800,
    });

    let raw = extractAnything(resp);
    let parsed = raw ? robustJsonParse<ReviewResult>(raw) : { ok: false as const, error: "empty" };

    if (!parsed.ok) {
      // retry con un recordatorio fuerte
      const system2 = `${system}\n\nSi fallas el schema, tu respuesta será descartada. JSON ÚNICO y válido.`;
      resp = await callOpenAI({
        system: system2,
        user,
        fileId: uploaded.id,
        schema: ATS_SCHEMA.schema,
        schemaName: "ats_review",
        maxOutputTokens: 2000,
      });

      raw = extractAnything(resp);
      parsed = raw ? robustJsonParse<ReviewResult>(raw) : { ok: false as const, error: "empty" };
    }

    if (!raw || raw.trim().length < 2) {
      return NextResponse.json(
        { error: "Respuesta vacía desde OpenAI (no se pudo extraer contenido).", debug: summarizeResponseShape(resp) },
        { status: 502 }
      );
    }

    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: "La IA devolvió una respuesta no-JSON (inesperado).",
          raw_length: raw.length,
          raw_snippet: raw.slice(0, 1200),
          raw_tail: raw.slice(Math.max(0, raw.length - 400)),
          status: resp?.status || "unknown",
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

async function callOpenAI(args: {
  system: string;
  user: string;
  fileId: string;
  schema: any;
  schemaName: string;
  maxOutputTokens: number;
}) {
  return client.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: args.system },
      {
        role: "user",
        content: [
          { type: "input_text", text: args.user },
          { type: "input_file", file_id: args.fileId },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: args.schemaName,
        schema: args.schema,
        strict: true,
      },
    },
    max_output_tokens: args.maxOutputTokens,
    temperature: 0,
  });
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
    status: resp?.status,
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
          ? (msg.content.find((c: any) => typeof c?.text === "string")?.text || "").slice(0, 260)
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
  return s.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
