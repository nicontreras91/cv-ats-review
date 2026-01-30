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
  const supportButtonClass =
    "inline-flex items-center justify-center text-center whitespace-nowrap " +
    "rounded-xl px-5 py-2.5 text-sm font-semibold text-white " +
    "w-full sm:w-[240px] " +
    "bg-[#5B7CFF] hover:bg-[#4C6FFF] active:bg-[#3F63FF] " +
    "shadow-[0_8px_22px_rgba(91,124,255,0.28)] border border-black/10";

  // ✅ LINK DONACIÓN (monto libre) — reemplaza por tu link real:
  const DONATE_URL = "https://link.mercadopago.cl/revicv";
  const FEEDBACK_URL = "https://forms.gle/Ccrg6NscVBY8xxjv6";

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

  // ✅ Colores (si ya los tenías definidos, déjalos como están)
  const BG = "bg-[#E9EEF6]";
  const TEXT = "text-black";
  const MUTED = "text-black/70";
  const CARD = "bg-white border border-black rounded-2xl";

  // ✅ Bloque reutilizable (idéntico) para Donación + Feedback
  const SupportAndFeedback = ({ withTopBorder }: { withTopBorder: boolean }) => (
    <>
      {/* ✅ Donación */}
      <div className={(withTopBorder ? "mt-5 border-t border-black/10 pt-4" : "")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-black/70 sm:pr-6">
            <p className="font-semibold text-black">¿Te fue de ayuda?</p>
            <p>Si quieres apoyar el proyecto, puedes hacerlo con Mercado Pago.</p>
          </div>

          <div className="w-full sm:w-auto">
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className={supportButtonClass}>
              Apoyar con Mercado Pago
            </a>

            <div className="mt-1 w-full sm:w-[240px] text-xs text-black/50 text-center sm:text-right">
              Se abre en una pestaña nueva.
            </div>
          </div>
        </div>
      </div>

      {/* Separador */}
      <div className="my-4 h-px w-full bg-black/10" />

      {/* ✅ Feedback */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-black/70">
          <p className="font-semibold text-black">¿Te gustaría dejarme un feedback?</p>
          <p>No te tomará más de 30 segundos</p>
        </div>

        <div className="w-full sm:w-auto">
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={supportButtonClass}>
            Enviar feedback
          </a>

          <div className="mt-1 w-full sm:w-[240px] text-xs text-black/50 text-center sm:text-right">
            Se abre en una pestaña nueva.
          </div>
        </div>
      </div>
    </>
  );

  return (
    <main className={"min-h-screen " + BG + " " + TEXT}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header: en móvil centrado + logo arriba / en web texto izq + logo der */}
        <div className="flex flex-col-reverse items-center text-center sm:flex-row sm:items-start sm:justify-between sm:text-left gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Revisa tu CV para mejorar tus oportunidades</h1>
            <p className={"text-sm mt-2 " + MUTED}>
              Sube tu CV en PDF (máximo 2 páginas). Te devolveré un informe ejecutivo con fixes concretos y 3 cargos recomendados de
              acuerdo a tu experiencia y habilidades.
            </p>
          </div>

          <div className="shrink-0 w-full sm:w-auto flex justify-center sm:justify-end">
            <div className="rounded-2xl bg-white/70 border border-black/10 shadow-[0_12px_30px_rgba(15,23,42,0.06)] px-3 py-2">
              <img src="/logo-v2.png" alt="ReviCV" className="h-16 w-auto object-contain" draggable={false} />
            </div>
          </div>
        </div>

        <div className={"mt-6 rounded-2xl p-5 space-y-4 relative " + CARD} aria-busy={loading}>
          {/* ✅ Overlay “pro”: difumina + oscurece + no deja ver “otra carga” debajo */}
          {loading && (
            <div className="absolute inset-0 rounded-2xl bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-50">
              <div className="w-[92%] max-w-xl flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
                <div className="h-10 w-10 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <video className="h-full w-full object-cover" src="/logo-loader.mp4" autoPlay muted loop playsInline />
                </div>

                <div className="text-sm text-black">
                  Analizando<LoadingDots active={loading} />
                  <div className={"text-xs mt-0.5 " + MUTED}>Esto puede tomar unos segundos</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">CV (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full text-sm cursor-pointer file:mr-3 file:rounded-lg file:border file:border-black file:bg-white file:px-3 file:py-2 file:text-sm file:text-black file:cursor-pointer hover:file:bg-black hover:file:text-white"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
            {fileMsg && <p className={"text-sm mt-2 " + MUTED}>{fileMsg}</p>}
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-row gap-3">
            <button onClick={analyze} disabled={!file || loading} className={primaryButtonClass}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  Analizando<LoadingDots active={loading} />
                </span>
              ) : (
                "Analizar CV"
              )}
            </button>

            <button onClick={downloadPdf} disabled={!result || loading} className={primaryButtonClass + " w-full sm:w-auto"}>
              Descargar reporte PDF
            </button>

            <span className="sr-only" aria-live="polite">
              {loading ? "Analizando CV" : ""}
            </span>
          </div>

          {/* ✅ SOLO ANTES del reporte (cuando NO hay result) */}
          {!result && <SupportAndFeedback withTopBorder={true} />}

          {error && <p className="text-sm">{error}</p>}

          {uiMsg && <pre className="text-xs whitespace-pre-wrap rounded-xl border border-black p-3">{uiMsg}</pre>}

          {errorDetail && <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-black p-3 text-xs">{errorDetail}</pre>}
        </div>

        {result && (
          <div className="mt-8 space-y-6">
            <div className={CARD + " p-5"}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">ATS Score</h2>
                <span className="text-2xl font-bold">{result.ats_score}/100</span>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm space-y-1">
                {result.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">Top 3 cargos recomendados</h2>

              <div className="mt-3 space-y-4">
                {result.best_matches.map((m, idx) => (
                  <div key={idx} className="rounded-xl border border-black p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{m.role}</p>
                      <p className="text-sm font-semibold">{m.match_score}/100</p>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">Por qué calzas</p>
                      <ul className="mt-1 list-disc pl-5 text-sm space-y-1">
                        {m.why_fit.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">Keywords faltantes</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.missing_keywords.map((k, i) => (
                          <span key={i} className="text-xs bg-white border border-black rounded-full px-3 py-1">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">Cambios recomendados</p>
                      <ul className="mt-1 list-disc pl-5 text-sm space-y-1">
                        {m.recommended_changes.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">Top fixes (prioridad)</h2>
              <div className="mt-3 space-y-4">
                {result.top_fixes.map((f, i) => (
                  <div key={i} className="rounded-xl border border-black p-4">
                    <p className="font-medium">
                      {i + 1}. {f.title}
                    </p>
                    <p className="text-sm mt-1">{f.why}</p>
                    <p className="text-sm mt-2">
                      <span className="font-medium">Ejemplo:</span> {f.example_fix}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">Checklist ATS</h2>
              <div className="mt-3 space-y-2">
                {result.ats_checklist.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span>{c.status === "ok" ? "✅" : "⚠️"}</span>
                    <div>
                      <p>{c.item}</p>
                      <p>{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">Keywords sugeridas</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.suggested_keywords.map((k, i) => (
                  <span key={i} className="text-xs bg-white border border-black rounded-full px-3 py-1">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">Bullets reescritos</h2>

              <div className="mt-3 space-y-4">
                {result.rewritten_bullets.map((b, i) => {
                  const hasOriginal = (b.original || "").trim().length > 0;

                  return (
                    <div key={i} className="rounded-xl border border-black p-4">
                      <div className="text-xs font-semibold">#{i + 1}</div>

                      <div className="mt-3 grid gap-3">
                        <div className="rounded-lg border border-black p-3">
                          <div className="text-xs font-semibold">Original</div>
                          <div className="mt-1 text-sm whitespace-pre-wrap">
                            {hasOriginal ? (
                              <>
                                <span className="mr-2">•</span>
                                {b.original}
                              </>
                            ) : (
                              <span className="text-black/70">
                                No detectado en el PDF (posible tabla/imagen/columnas). Igual te dejamos una propuesta abajo.
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-black p-3">
                          <div className="text-xs font-semibold">Mejorado</div>
                          <div className="mt-1 text-sm whitespace-pre-wrap">
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

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">Estructura recomendada</h2>
              <ol className="mt-3 list-decimal pl-5 text-sm space-y-1">
                {result.template_outline.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">Descargar</h2>
              <button onClick={downloadPdf} disabled={loading} className={"mt-3 " + primaryButtonClass}>
                Descargar reporte PDF
              </button>
            </div>
          </div>
        )}

        {/* ✅ SOLO DESPUÉS del reporte (cuando SÍ hay result) */}
        {result && (
          <div className="mt-8">
            <div className={CARD + " p-5"}>
              <SupportAndFeedback withTopBorder={false} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
