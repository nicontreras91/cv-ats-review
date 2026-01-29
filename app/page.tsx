// ✅ Archivo: app/page.tsx
"use client";

import { useState } from "react";

type ReviewResult = {
  ats_score: number;
  summary: string[];
  top_fixes: { title: string; why: string; example_fix: string }[];
  ats_checklist: { item: string; status: "ok" | "warn"; note: string }[];
  suggested_keywords: string[];
  rewritten_bullets: { original: string; improved: string }[];
  template_outline: string[];
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [roleTarget, setRoleTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [uiMsg, setUiMsg] = useState<string | null>(null);

  const primaryButtonClass =
    "rounded-lg border border-black bg-white px-4 py-2 text-sm text-black cursor-pointer hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed";

  function onPickFile(f: File | null) {
    setResult(null);
    setError(null);
    setErrorDetail(null);
    setFileMsg(null);
    setUiMsg(null);

    if (!f) {
      setFile(null);
      return;
    }

    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setFileMsg("⚠️ Archivo inválido: debe ser PDF.");
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (f.size > maxBytes) {
      setFile(null);
      setFileMsg("⚠️ Archivo demasiado grande: máximo 5MB.");
      return;
    }

    setFile(f);
    setFileMsg("✅ Cargado correctamente");
  }

  async function analyze() {
    if (!file || loading) return;

    setLoading(true);
    setError(null);
    setErrorDetail(null);
    setResult(null);
    setUiMsg(null);

    try {
      const form = new FormData();
      form.append("cv", file);
      form.append("roleTarget", roleTarget);

      const res = await fetch("/api/review-cv", { method: "POST", body: form });
      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        setErrorDetail(text?.slice(0, 2000) || null);
        throw new Error(`El servidor no devolvió JSON. Status ${res.status}.`);
      }

      if (!res.ok) {
        setErrorDetail(
          JSON.stringify(
            {
              error: data?.error,
              raw_length: data?.raw_length,
              raw_snippet: data?.raw_snippet,
              raw_tail: data?.raw_tail,
              debug: data?.debug,
            },
            null,
            2
          )
        );
        throw new Error(data?.error || "Error desconocido");
      }

      setResult(data as ReviewResult);
      setUiMsg("✅ Reporte generado. Puedes descargarlo en PDF.");
    } catch (e: any) {
      setError(e?.message || "Falló el análisis");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!result) return;

    setUiMsg(null);

    try {
      const res = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: result, roleTarget }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo generar el PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "reporte-ats.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
      setUiMsg("✅ PDF descargado.");
    } catch (e: any) {
      setUiMsg(e?.message || "Error descargando PDF.");
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto px-4 py-10 text-black">
        <h1 className="text-2xl font-semibold text-black">Revisión de CV para pasar ATS</h1>
        <p className="text-sm text-black mt-2">
          Sube tu CV en PDF (máximo 2 páginas). Te devolvemos un informe ejecutivo con fixes concretos.
        </p>

        <div className="mt-6 bg-white border border-black rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-black">CV (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full text-sm text-black cursor-pointer file:mr-3 file:rounded-lg file:border file:border-black file:bg-white file:px-3 file:py-2 file:text-sm file:text-black file:cursor-pointer hover:file:bg-black hover:file:text-white"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            {fileMsg && <p className="text-sm text-black mt-2">{fileMsg}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-black">Cargo objetivo (opcional)</label>
            <input
              className="mt-2 w-full rounded-xl border border-black px-3 py-2 text-sm text-black placeholder:text-black/60 outline-none"
              placeholder="Ej: PMO, Project Manager, Payroll Lead..."
              value={roleTarget}
              onChange={(e) => setRoleTarget(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={analyze} disabled={!file || loading} className={primaryButtonClass}>
              {loading ? "Analizando…" : "Analizar CV"}
            </button>

            <button onClick={downloadPdf} disabled={!result} className={primaryButtonClass}>
              Descargar reporte PDF
            </button>
          </div>

          {error && <p className="text-sm text-black">{error}</p>}

          {uiMsg && (
            <pre className="text-xs text-black whitespace-pre-wrap rounded-xl border border-black p-3">
              {uiMsg}
            </pre>
          )}

          {errorDetail && (
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-black p-3 text-xs text-black">
              {errorDetail}
            </pre>
          )}
        </div>

        {result && (
          <div className="mt-8 space-y-6">
            <div className="bg-white border border-black rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-black">ATS Score</h2>
                <span className="text-2xl font-bold text-black">{result.ats_score}/100</span>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm text-black space-y-1">
                {result.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-black rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-black">Top fixes (prioridad)</h2>
              <div className="mt-3 space-y-4">
                {result.top_fixes.map((f, i) => (
                  <div key={i} className="rounded-xl border border-black p-4">
                    <p className="font-medium text-black">
                      {i + 1}. {f.title}
                    </p>
                    <p className="text-sm text-black mt-1">{f.why}</p>
                    <p className="text-sm text-black mt-2">
                      <span className="font-medium">Ejemplo:</span> {f.example_fix}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-black rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-black">Checklist ATS</h2>
              <div className="mt-3 space-y-2">
                {result.ats_checklist.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span>{c.status === "ok" ? "✅" : "⚠️"}</span>
                    <div>
                      <p className="text-black">{c.item}</p>
                      <p className="text-black">{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-black rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-black">Keywords sugeridas</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.suggested_keywords.map((k, i) => (
                  <span key={i} className="text-xs bg-white border border-black rounded-full px-3 py-1 text-black">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white border border-black rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-black">Bullets reescritos</h2>

              <div className="mt-3 space-y-4">
                {result.rewritten_bullets.map((b, i) => {
                  const hasOriginal = (b.original || "").trim().length > 0;

                  return (
                    <div key={i} className="rounded-xl border border-black p-4">
                      <div className="text-xs font-semibold text-black">#{i + 1}</div>

                      <div className="mt-3 grid gap-3">
                        <div className="rounded-lg border border-black p-3">
                          <div className="text-xs font-semibold text-black">Original</div>
                          <div className="mt-1 text-sm text-black whitespace-pre-wrap">
                            {hasOriginal ? (
                              <>
                                <span className="mr-2">•</span>
                                {b.original}
                              </>
                            ) : (
                              <span className="text-black/70">
                                No detectado en el PDF (posible tabla/imagen/columnas). Igual te dejamos una propuesta
                                abajo.
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-black p-3">
                          <div className="text-xs font-semibold text-black">Mejorado</div>
                          <div className="mt-1 text-sm text-black whitespace-pre-wrap">
                            <span className="mr-2">•</span>
                            {b.improved}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-black rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-black">Estructura recomendada</h2>
              <ol className="mt-3 list-decimal pl-5 text-sm space-y-1 text-black">
                {result.template_outline.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </div>

            <div className="bg-white border border-black rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-black">Descargar</h2>
              <button onClick={downloadPdf} className={"mt-3 " + primaryButtonClass}>
                Descargar reporte PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
