"use client";

import { useEffect, useRef, useState } from "react";

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

type Lang = "es" | "en";

/**
 * ✅ Usa imágenes de banderas (no emojis) para que SIEMPRE se vean.
 * Coloca estos archivos en /public:
 *  - /flag-es.png  (España)
 *  - /flag-us.png  (USA)
 *
 * Recomendación: 64x64 o 128x128, PNG o WEBP.
 */
function Flag({ src, alt, active }: { src: string; alt: string; active: boolean }) {
  return (
    <span
      className={
        "inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-black/15 " +
        "shadow-[0_6px_14px_rgba(0,0,0,0.10)] transition-opacity " +
        (active ? "opacity-100" : "opacity-45")
      }
      aria-hidden="true"
      title={alt}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" draggable={false} />
    </span>
  );
}

/**
 * ✅ Switch premium (iOS-ish) + banderas a los lados (SIEMPRE visibles)
 */
function LanguageSwitchPremium({
  lang,
  onToggle,
  label,
}: {
  lang: Lang;
  onToggle: () => void;
  label: string;
}) {
  const isEN = lang === "en";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-black/60">{label}</span>

      <Flag src="/flag-es.png" alt="Español" active={!isEN} />

      <button
        type="button"
        onClick={onToggle}
        role="switch"
        aria-checked={isEN}
        className={
          "relative inline-flex h-8 w-[58px] items-center rounded-full border border-black/15 " +
          "bg-white/70 backdrop-blur-md " +
          "shadow-[0_10px_28px_rgba(0,0,0,0.14)] " +
          "transition-all active:scale-[0.98]"
        }
      >
        {/* Track (cambia sutilmente si está en EN) */}
        <span
          className="absolute inset-0 rounded-full transition-opacity"
          style={{
            background: isEN
              ? "linear-gradient(90deg, rgba(91,124,255,0.10), rgba(91,124,255,0.20), rgba(91,124,255,0.10))"
              : "linear-gradient(90deg, rgba(0,0,0,0.03), rgba(0,0,0,0.06), rgba(0,0,0,0.03))",
          }}
          aria-hidden="true"
        />

        {/* Thumb */}
        <span
          className={
            "relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full " +
            "bg-white border border-black/20 " +
            "shadow-[0_10px_18px_rgba(0,0,0,0.18)] " +
            "transition-transform duration-200 ease-out " +
            (isEN ? "translate-x-[30px]" : "translate-x-[4px]")
          }
          aria-hidden="true"
        >
          <span className="h-2 w-2 rounded-full bg-black/25" />
        </span>
      </button>

      <Flag src="/flag-us.png" alt="English" active={isEN} />
    </div>
  );
}

const I18N = {
  es: {
    language: "Idioma",
    title: "Revisa tu CV para mejorar tus oportunidades",
    subtitle:
      "Sube tu CV en PDF (máximo 2 páginas). Te devolveré un informe ejecutivo con fixes concretos y 3 cargos recomendados de acuerdo a tu experiencia y habilidades.",

    cvLabel: "CV (PDF)",
    pickFile: "Seleccionar archivo",
    noFile: "Sin archivos seleccionados",
    pickFileHint: "PDF, máximo 5MB",

    invalidFile: "⚠️ Archivo inválido: debe ser PDF.",
    fileTooBig: "⚠️ Archivo demasiado grande: máximo 5MB.",
    loadedOk: "✅ Cargado correctamente",

    analyze: "Analizar CV",
    analyzing: "Analizando",
    analyzingHint: "Esto puede tomar unos segundos",

    downloadPdf: "Descargar reporte PDF",
    reportReady: "✅ Reporte generado. Incluye los 3 cargos con mejor match según tu CV.",
    pdfDownloaded: "✅ PDF descargado.",
    errDownloadPdf: "No se pudo generar el PDF.",
    errAnalyzeFallback: "Falló el análisis",
    openNewTab: "Se abre en una pestaña nueva.",

    helpTitle: "¿Te fue de ayuda?",
    helpBody: "Si quieres apoyar el proyecto, puedes hacerlo con Mercado Pago.",
    support: "Apoyar con Mercado Pago",

    feedbackTitle: "¿Te gustaría dejarme un feedback?",
    feedbackBody: "No te tomará más de 30 segundos",
    feedbackBtn: "Enviar feedback",

    atsScore: "ATS Score",
    topRoles: "Top 3 cargos recomendados",
    whyFit: "Por qué calzas",
    missingKeywords: "Keywords faltantes",
    recommendedChanges: "Cambios recomendados",

    topFixes: "Top fixes (prioridad)",
    exampleLabel: "Ejemplo",

    checklist: "Checklist ATS",
    suggestedKeywords: "Keywords sugeridas",

    rewrittenBullets: "Bullets reescritos",
    original: "Original",
    improved: "Mejorado",
    notDetected: "No detectado en el PDF (posible tabla/imagen/columnas). Igual te dejamos una propuesta abajo.",

    outline: "Estructura recomendada",
    download: "Descargar",
    downloadAgain: "Descargar reporte PDF",
    
    pageTitle: "Revisa tu CV con Revi",
    pageTitleShort: "Revi | Revisa tu CV",

  },
  en: {
    language: "Language",
    title: "Review your Resume to improve your chances",
    subtitle:
      "Upload your Resume as a PDF (max 2 pages). You'll get an executive ATS report with concrete fixes and 3 recommended roles based on your experience and skills.",

    cvLabel: "Resume (PDF)",
    pickFile: "Choose file",
    noFile: "No file selected",
    pickFileHint: "PDF, max 5MB",

    invalidFile: "⚠️ Invalid file: it must be a PDF.",
    fileTooBig: "⚠️ File too large: max 5MB.",
    loadedOk: "✅ Uploaded successfully",

    analyze: "Analyze Resume",
    analyzing: "Analyzing",
    analyzingHint: "This may take a few seconds",

    downloadPdf: "Download PDF report",
    reportReady: "✅ Report generated. Includes the top 3 best-matching roles based on your Resume.",
    pdfDownloaded: "✅ PDF downloaded.",
    errDownloadPdf: "Could not generate the PDF.",
    errAnalyzeFallback: "Analysis failed",
    openNewTab: "Opens in a new tab.",

    helpTitle: "Was this helpful?",
    helpBody: "If you want to support the project, you can do it via Mercado Pago.",
    support: "Support via Mercado Pago",

    feedbackTitle: "Want to leave feedback?",
    feedbackBody: "It takes less than 30 seconds",
    feedbackBtn: "Send feedback",

    atsScore: "ATS Score",
    topRoles: "Top 3 recommended roles",
    whyFit: "Why you're a fit",
    missingKeywords: "Missing keywords",
    recommendedChanges: "Recommended changes",

    topFixes: "Top fixes (priority)",
    exampleLabel: "Example",

    checklist: "ATS Checklist",
    suggestedKeywords: "Suggested keywords",

    rewrittenBullets: "Rewritten bullets",
    original: "Original",
    improved: "Improved",
    notDetected: "Not detected in the PDF (tables/images/columns). We still provide an improved proposal below.",

    outline: "Recommended structure",
    download: "Download",
    downloadAgain: "Download PDF report",

    pageTitle: "Review your Resume with Revi",
    pageTitleShort: "Revi | Review your Resume",

  },
} as const;

/**
 * ✅ Mejor detección de idioma:
 * - Preferencia explícita guardada (localStorage) manda.
 * - Si no hay preferencia guardada:
 *   - usa navigator.languages (lista completa) primero
 *   - si no existe, cae a navigator.language
 *   - si encuentra "es" => es, si no => en
 *
 * Esto evita el “siempre me da inglés” cuando tu navegador está en español,
 * porque navigator.language puede venir raro en algunos setups, pero navigator.languages casi siempre trae bien la lista.
 */
function detectBrowserLang(): Lang {
  const langs = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [];
  const primary = (langs[0] || navigator.language || "es").toLowerCase();

  // Si cualquier preferencia del navegador parte con "es", usamos español
  const anySpanish =
    langs.some((l) => (l || "").toLowerCase().startsWith("es")) || primary.startsWith("es");

  return anySpanish ? "es" : "en";
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

  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    const saved = window.localStorage.getItem("revi_lang") as Lang | null;
    if (saved === "es" || saved === "en") {
      setLang(saved);
      document.documentElement.lang = saved;
      return;
    }

    const auto = detectBrowserLang();
    setLang(auto);
    document.documentElement.lang = auto;
  }, []);

  function setLanguage(next: Lang) {
    setLang(next);
    window.localStorage.setItem("revi_lang", next);
    document.documentElement.lang = next;

    setFileMsg(null);
    setUiMsg(null);
    setError(null);
    setErrorDetail(null);
  }

  const t = I18N[lang];

  useEffect(() => {
  // ✅ Título de la pestaña según idioma
    document.title = t.pageTitle;
  }, [lang, t.pageTitle]);


  const supportButtonClass =
    "inline-flex items-center justify-center text-center whitespace-nowrap " +
    "rounded-xl px-5 py-2.5 text-sm font-semibold text-white " +
    "w-full sm:w-[240px] " +
    "bg-[#5B7CFF] hover:bg-[#4C6FFF] active:bg-[#3F63FF] " +
    "shadow-[0_8px_22px_rgba(91,124,255,0.28)] border border-black/10";

  const DONATE_URL = "https://link.mercadopago.cl/revicv";
  const FEEDBACK_URL = "https://forms.gle/Ccrg6NscVBY8xxjv6";

  const primaryButtonClass =
    "rounded-lg border border-black bg-white px-4 py-2 text-sm text-black cursor-pointer hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed";

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function resetUiForNewFile() {
    setResult(null);
    setError(null);
    setErrorDetail(null);
    setFileMsg(null);
    setUiMsg(null);
  }

  function onPickFile(f: File | null) {
    resetUiForNewFile();

    if (!f) {
      setFile(null);
      return;
    }

    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setFileMsg(t.invalidFile);
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (f.size > maxBytes) {
      setFile(null);
      setFileMsg(t.fileTooBig);
      return;
    }

    setFile(f);
    setFileMsg(t.loadedOk);
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
      form.append("lang", lang);

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
      setUiMsg(t.reportReady);
    } catch (e: any) {
      setError(e?.message || t.errAnalyzeFallback);
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
        body: JSON.stringify({ report: result, lang }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || t.errDownloadPdf);
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
      setUiMsg(t.pdfDownloaded);
    } catch (e: any) {
      setUiMsg(e?.message || t.errDownloadPdf);
    }
  }

  const BG = "bg-[#E9EEF6]";
  const TEXT = "text-black";
  const MUTED = "text-black/70";
  const CARD = "bg-white border border-black rounded-2xl";

  const SupportAndFeedback = ({ withTopBorder }: { withTopBorder: boolean }) => (
    <>
      <div className={withTopBorder ? "mt-5 border-t border-black/10 pt-4" : ""}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-black/70 sm:pr-6">
            <p className="font-semibold text-black">{t.helpTitle}</p>
            <p>{t.helpBody}</p>
          </div>

          <div className="w-full sm:w-auto">
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className={supportButtonClass}>
              {t.support}
            </a>

            <div className="mt-1 w-full sm:w-[240px] text-xs text-black/50 text-center sm:text-right">{t.openNewTab}</div>
          </div>
        </div>
      </div>

      <div className="my-4 h-px w-full bg-black/10" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-black/70">
          <p className="font-semibold text-black">{t.feedbackTitle}</p>
          <p>{t.feedbackBody}</p>
        </div>

        <div className="w-full sm:w-auto">
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={supportButtonClass}>
            {t.feedbackBtn}
          </a>

          <div className="mt-1 w-full sm:w-[240px] text-xs text-black/50 text-center sm:text-right">{t.openNewTab}</div>
        </div>
      </div>
    </>
  );

  const fileName = file?.name || t.noFile;

  return (
    <main className={"min-h-screen " + BG + " " + TEXT}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col-reverse items-center text-center sm:flex-row sm:items-start sm:justify-between sm:text-left gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{t.title}</h1>
            <p className={"text-sm mt-2 " + MUTED}>{t.subtitle}</p>
          </div>

          <div className="shrink-0 w-full sm:w-auto flex flex-col items-center sm:items-end gap-3">
            <LanguageSwitchPremium
              lang={lang}
              onToggle={() => setLanguage(lang === "es" ? "en" : "es")}
              label={t.language}
            />

            <div className="rounded-2xl bg-white/70 border border-black/10 shadow-[0_12px_30px_rgba(15,23,42,0.06)] px-3 py-2">
              <img src="/logo-v2.png" alt="ReviCV" className="h-16 w-auto object-contain" draggable={false} />
            </div>
          </div>
        </div>

        <div className={"mt-6 rounded-2xl p-5 space-y-4 relative " + CARD} aria-busy={loading}>
          {loading && (
            <div className="absolute inset-0 rounded-2xl bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-50">
              <div className="w-[92%] max-w-xl flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
                <div className="h-10 w-10 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <video className="h-full w-full object-cover" src="/logo-loader.mp4" autoPlay muted loop playsInline />
                </div>

                <div className="text-sm text-black">
                  {t.analyzing}
                  <LoadingDots active={loading} />
                  <div className={"text-xs mt-0.5 " + MUTED}>{t.analyzingHint}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">{t.cvLabel}</label>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />

            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className={
    "cursor-pointer select-none " +
    "rounded-lg border border-black bg-white px-4 py-2 text-sm font-semibold text-black " +
    "transition-all " +
    "hover:-translate-y-[1px] hover:shadow-[0_10px_22px_rgba(0,0,0,0.16)] hover:bg-black hover:text-white " +
    "active:translate-y-0 active:shadow-[0_6px_14px_rgba(0,0,0,0.12)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                }
              >
                {t.pickFile}
              </button>

              <div className="text-sm text-black/80">
                <span className="font-medium">{fileName}</span>
                <div className="text-xs text-black/50">{t.pickFileHint}</div>
              </div>
            </div>

            {fileMsg && <p className={"text-sm mt-2 " + MUTED}>{fileMsg}</p>}
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-row gap-3">
            <button onClick={analyze} disabled={!file || loading} className={primaryButtonClass}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  {t.analyzing}
                  <LoadingDots active={loading} />
                </span>
              ) : (
                t.analyze
              )}
            </button>

            <button onClick={downloadPdf} disabled={!result || loading} className={primaryButtonClass + " w-full sm:w-auto"}>
              {t.downloadPdf}
            </button>

            <span className="sr-only" aria-live="polite">
              {loading ? t.analyzing : ""}
            </span>
          </div>

          {!result && <SupportAndFeedback withTopBorder={true} />}

          {error && <p className="text-sm">{error}</p>}
          {uiMsg && <pre className="text-xs whitespace-pre-wrap rounded-xl border border-black p-3">{uiMsg}</pre>}
          {errorDetail && <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-black p-3 text-xs">{errorDetail}</pre>}
        </div>

        {result && (
          <div className="mt-8 space-y-6">
            <div className={CARD + " p-5"}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t.atsScore}</h2>
                <span className="text-2xl font-bold">{result.ats_score}/100</span>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm space-y-1">
                {result.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">{t.topRoles}</h2>

              <div className="mt-3 space-y-4">
                {result.best_matches.map((m, idx) => (
                  <div key={idx} className="rounded-xl border border-black p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{m.role}</p>
                      <p className="text-sm font-semibold">{m.match_score}/100</p>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">{t.whyFit}</p>
                      <ul className="mt-1 list-disc pl-5 text-sm space-y-1">
                        {m.why_fit.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">{t.missingKeywords}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.missing_keywords.map((k, i) => (
                          <span key={i} className="text-xs bg-white border border-black rounded-full px-3 py-1">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">{t.recommendedChanges}</p>
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
              <h2 className="text-lg font-semibold">{t.topFixes}</h2>
              <div className="mt-3 space-y-4">
                {result.top_fixes.map((f, i) => (
                  <div key={i} className="rounded-xl border border-black p-4">
                    <p className="font-medium">
                      {i + 1}. {f.title}
                    </p>
                    <p className="text-sm mt-1">{f.why}</p>
                    <p className="text-sm mt-2">
                      <span className="font-medium">{t.exampleLabel}:</span> {f.example_fix}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">{t.checklist}</h2>
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
              <h2 className="text-lg font-semibold">{t.suggestedKeywords}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.suggested_keywords.map((k, i) => (
                  <span key={i} className="text-xs bg-white border border-black rounded-full px-3 py-1">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">{t.rewrittenBullets}</h2>

              <div className="mt-3 space-y-4">
                {result.rewritten_bullets.map((b, i) => {
                  const hasOriginal = (b.original || "").trim().length > 0;

                  return (
                    <div key={i} className="rounded-xl border border-black p-4">
                      <div className="text-xs font-semibold">#{i + 1}</div>

                      <div className="mt-3 grid gap-3">
                        <div className="rounded-lg border border-black p-3">
                          <div className="text-xs font-semibold">{t.original}</div>
                          <div className="mt-1 text-sm whitespace-pre-wrap">
                            {hasOriginal ? (
                              <>
                                <span className="mr-2">•</span>
                                {b.original}
                              </>
                            ) : (
                              <span className="text-black/70">{t.notDetected}</span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-black p-3">
                          <div className="text-xs font-semibold">{t.improved}</div>
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
              <h2 className="text-lg font-semibold">{t.outline}</h2>
              <ol className="mt-3 list-decimal pl-5 text-sm space-y-1">
                {result.template_outline.map((tt, i) => (
                  <li key={i}>{tt}</li>
                ))}
              </ol>
            </div>

            <div className={CARD + " p-5"}>
              <h2 className="text-lg font-semibold">{t.download}</h2>
              <button onClick={downloadPdf} disabled={loading} className={"mt-3 " + primaryButtonClass}>
                {t.downloadAgain}
              </button>
            </div>
          </div>
        )}

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
