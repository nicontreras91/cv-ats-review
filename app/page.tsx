"use client";

import { useEffect, useState } from "react";

type BestMatch = {
  role: string;
  match_score: number;
  why_fit: string[];
  missing_keywords: string[];
  recommended_changes: string[];
};

type ReviewResult = {
  ats_score: number;
  summary: string[];
  top_fixes: { title: string; why: string; example_fix: string }[];
  ats_checklist: { item: string; status: "ok" | "warn"; note: string }[];
  suggested_keywords: string[];
  rewritten_bullets: { original: string; improved: string }[];
  template_outline: string[];
  best_matches: BestMatch[];
};

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={"animate-spin " + className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}

function LoadingDots({ active }: { active: boolean }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!active) {
      setDots("");
      return;
    }
    const id = window.setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 350);
    return () => window.clearInterval(id);
  }, [active]);

  return <span className="inline-block w-[16px]">{dots}</span>;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [uiMsg, setUiMsg] = useState<string | null>(null);

  // 🎨 Paleta alineada al logo (azul pastel + grises elegantes)
  const BG = "bg-[#E9EDF3]"; // gris suave elegante
  const CARD = "bg-white border border-black/10 shadow-[0_10px_30px_rgba(15,23,42,0.08)]";
  const TEXT = "text-[#0F172A]"; // slate-900
  const MUTED = "text-[#334155]"; // slate-700
  const MUTED2 = "text-[#475569]"; // slate-600

  // Botones: primario azul pastel, secundario neutro
  const primaryButtonClass =
    "rounded-xl bg-[#6D83FF] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(109,131,255,0.35)] hover:bg-[#5C73FF] active:bg-[#526AFF] disabled:opacity-50 disabled:cursor-not-allowed transition";
  const secondaryButtonClass =
    "rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed transition";

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
              status: data?.status,
            },
            null,
            2
          )
        );
        throw new Error(data?.error || "Error desconocido");
      }

      setResult(data as ReviewResult);
      setUiMsg("✅ Reporte generado. Incluye los 3 cargos con mejor match según tu CV.");
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
        body: JSON.stringify({ report: result }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo generar el PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      // ⚠️ Mantengo tu nombre actual aquí. Si ya lo cambiaste a reporte-reviCV, edita acá también.
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
    <main className={"min-h-screen " + BG + " " + TEXT}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header: móvil = logo arriba, texto abajo | desktop = texto izq, logo der */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          {/* Logo */}
          <div className="w-full sm:w-auto flex justify-center sm:justify-end order-1 sm:order-2">
            <div className="rounded-2xl bg-white/70 border border-black/10 shadow-[0_12px_30px_rgba(15,23,42,0.06)] px-3 py-2">
              <img
                src="/logo-v2.png"
                alt="ReviCV"
                className="h-14 w-auto sm:h-16 object-contain"
                draggable={false}
              />
            </div>
          </div>

  {/* Texto */}
  <div className="min-w-0 order-2 sm:order-1">
    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
      Revisa tu CV para mejorar tus oportunidades
    </h1>
    <p className={"text-sm mt-2 " + MUTED}>
      Sube tu CV en PDF (máximo 2 páginas). Te devolvemos un informe ejecutivo con fixes concretos y tus 3 mejores cargos recomendados.
    </p>
  </div>
</div>


        <div className={"mt-6 rounded-2xl p-5 space-y-4 relative " + CARD} aria-busy={loading}>
          {/* Overlay “pro”: difumina + oscurece + no deja ver “otra carga” debajo */}
          {loading && (
            <div className="absolute inset-0 rounded-2xl bg-indigo-900/10 backdrop-blur-md flex items-center justify-center z-50">
              <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.20)]">
                <div className="h-12 w-12 rounded-xl overflow-hidden border border-black/10 bg-white flex items-center justify-center shrink-0">
                  <video
                    className="h-full w-full object-contain"
                    src="/logo-loader.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                  />
                </div>
                <div className="text-sm">
                  Analizando<LoadingDots active={loading} />
                  <div className={"text-xs mt-0.5 " + MUTED2}>Esto puede tomar unos segundos</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">CV (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full text-sm cursor-pointer file:mr-3 file:rounded-xl file:border file:border-black/15 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0F172A] file:cursor-pointer hover:file:bg-black/5"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
            {fileMsg && <p className={"text-sm mt-2 " + MUTED2}>{fileMsg}</p>}
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={analyze} disabled={!file || loading} className={primaryButtonClass}>
              <span className={loading ? "invisible" : "inline-flex items-center gap-2"}>Analizar CV</span>
            </button>

            <button onClick={downloadPdf} disabled={!result || loading} className={secondaryButtonClass}>
              Descargar reporte PDF
            </button>

            <span className="sr-only" aria-live="polite">
              {loading ? "Analizando CV" : ""}
            </span>
          </div>

          {error && <p className={"text-sm " + MUTED2}>{error}</p>}

          {uiMsg && (
            <pre className="text-xs whitespace-pre-wrap rounded-xl border border-black/10 bg-white/70 p-3">{uiMsg}</pre>
          )}

          {errorDetail && (
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-black/10 bg-white/70 p-3 text-xs">
              {errorDetail}
            </pre>
          )}
        </div>

        {result && (
          <div className="mt-8 space-y-6">
            <div className={"rounded-2xl p-5 " + CARD}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">ATS Score</h2>
                <span className="text-2xl font-bold">{result.ats_score}/100</span>
              </div>
              <ul className={"mt-3 list-disc pl-5 text-sm space-y-1 " + MUTED}>
                {result.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className={"rounded-2xl p-5 " + CARD}>
              <h2 className="text-lg font-semibold">Top 3 cargos recomendados</h2>

              <div className="mt-3 space-y-4">
                {result.best_matches.map((m, idx) => (
                  <div key={idx} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{m.role}</p>
                      <p className="text-sm font-semibold">{m.match_score}/100</p>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">Por qué calzas</p>
                      <ul className={"mt-1 list-disc pl-5 text-sm space-y-1 " + MUTED}>
                        {m.why_fit.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">Keywords faltantes</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.missing_keywords.map((k, i) => (
                          <span
                            key={i}
                            className="text-xs bg-white border border-black/10 rounded-full px-3 py-1 text-[#0F172A] shadow-[0_6px_14px_rgba(15,23,42,0.06)]"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">Cambios recomendados</p>
                      <ul className={"mt-1 list-disc pl-5 text-sm space-y-1 " + MUTED}>
                        {m.recommended_changes.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={"rounded-2xl p-5 " + CARD}>
              <h2 className="text-lg font-semibold">Top fixes (prioridad)</h2>
              <div className="mt-3 space-y-4">
                {result.top_fixes.map((f, i) => (
                  <div key={i} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                    <p className="font-semibold">
                      {i + 1}. {f.title}
                    </p>
                    <p className={"text-sm mt-1 " + MUTED}>{f.why}</p>
                    <p className={"text-sm mt-2 " + MUTED}>
                      <span className="font-semibold text-[#0F172A]">Ejemplo:</span> {f.example_fix}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={"rounded-2xl p-5 " + CARD}>
              <h2 className="text-lg font-semibold">Checklist ATS</h2>
              <div className="mt-3 space-y-2">
                {result.ats_checklist.map((c, i) => (
                  <div key={i} className={"flex items-start gap-2 text-sm " + MUTED}>
                    <span className="mt-0.5">{c.status === "ok" ? "✅" : "⚠️"}</span>
                    <div>
                      <p className="text-[#0F172A] font-semibold">{c.item}</p>
                      <p className={MUTED}>{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={"rounded-2xl p-5 " + CARD}>
              <h2 className="text-lg font-semibold">Keywords sugeridas</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.suggested_keywords.map((k, i) => (
                  <span
                    key={i}
                    className="text-xs bg-white border border-black/10 rounded-full px-3 py-1 text-[#0F172A] shadow-[0_6px_14px_rgba(15,23,42,0.06)]"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className={"rounded-2xl p-5 " + CARD}>
              <h2 className="text-lg font-semibold">Bullets reescritos</h2>

              <div className="mt-3 space-y-4">
                {result.rewritten_bullets.map((b, i) => {
                  const hasOriginal = (b.original || "").trim().length > 0;

                  return (
                    <div key={i} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                      <div className={"text-xs font-semibold " + MUTED2}>#{i + 1}</div>

                      <div className="mt-3 grid gap-3">
                        <div className="rounded-xl border border-black/10 bg-white p-3">
                          <div className={"text-xs font-semibold " + MUTED2}>Original</div>
                          <div className={"mt-1 text-sm whitespace-pre-wrap " + MUTED}>
                            {hasOriginal ? (
                              <>
                                <span className="mr-2">•</span>
                                {b.original}
                              </>
                            ) : (
                              <span className="text-black/60">
                                No detectado en el PDF (posible tabla/imagen/columnas). Igual te dejamos una propuesta abajo.
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-black/10 bg-white p-3">
                          <div className={"text-xs font-semibold " + MUTED2}>Mejorado</div>
                          <div className={"mt-1 text-sm whitespace-pre-wrap " + MUTED}>
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

            <div className={"rounded-2xl p-5 " + CARD}>
              <h2 className="text-lg font-semibold">Estructura recomendada</h2>
              <ol className={"mt-3 list-decimal pl-5 text-sm space-y-1 " + MUTED}>
                {result.template_outline.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </div>

            <div className={"rounded-2xl p-5 " + CARD}>
              <h2 className="text-lg font-semibold">Descargar</h2>
              <button onClick={downloadPdf} disabled={loading} className={"mt-3 " + secondaryButtonClass}>
                Descargar reporte PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
