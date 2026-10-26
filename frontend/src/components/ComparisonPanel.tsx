
"use client";

import { useMemo, useState } from "react";

import type {
  AIInterpretation,
  ChangeCategory,
  ChangeType,
  ComparisonResult,
  DocumentChange,
} from "@/types/comparison";

type ComparisonPanelProps = {
  referenceFile: File;
  finalFile: File;
  onInspect: (change: DocumentChange) => void;
};

const API_URL = "http://127.0.0.1:8010";

const categoryLabels: Record<ChangeCategory, string> = {
  nombre: "Nombres",
  fecha_plazo: "Fechas y plazos",
  importe: "Importes",
  texto: "Texto",
};

const typeLabels: Record<ChangeType, string> = {
  modified: "Modificado",
  added: "Añadido",
  removed: "Eliminado",
};

export default function ComparisonPanel({
  referenceFile,
  finalFile,
  onInspect,
}: ComparisonPanelProps) {
  const [result, setResult] =
    useState<ComparisonResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [category, setCategory] =
    useState<ChangeCategory | "all">("all");

  const [aiLoadingId, setAiLoadingId] = useState<string | null>(
    null
  );

  const [aiErrors, setAiErrors] = useState<
    Record<string, string>
  >({});

  async function compareDocuments() {
    setLoading(true);
    setError("");
    setResult(null);
    setAiErrors({});
    setCategory("all");

    const formData = new FormData();

    formData.append("reference", referenceFile);
    formData.append("final", finalFile);

    try {
      const response = await fetch(`${API_URL}/compare`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Error al comparar documentos (HTTP ${response.status}).`
        );
      }

      const data =
        (await response.json()) as ComparisonResult;

      if (
        !["different", "same", "needs_review"].includes(
          data.status
        ) ||
        !Array.isArray(data.changes)
      ) {
        throw new Error(
          "El servidor ha devuelto una respuesta inesperada."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo completar la comparación."
      );
    } finally {
      setLoading(false);
    }
  }
  
  async function analyzeChange(change: DocumentChange) {
    if (loading || aiLoadingId !== null) return;

    setAiLoadingId(change.id);

    // Borrar únicamente el error de este cambio
    setAiErrors((previous) => ({
      ...previous,
      [change.id]: "",
    }));

    try {
      const response = await fetch(
        `${API_URL}/analyze-change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: change.type,
            referenceText: change.reference?.text ?? null,
            finalText: change.final?.text ?? null,
          }),
        }
      );

      const data: unknown = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        const message =
          isRecord(data) && typeof data.detail === "string"
            ? data.detail
            : `Error HTTP ${response.status}`;

        throw new Error(message);
      }

      if (!isRecord(data) || !isRecord(data.ai)) {
        throw new Error(
          "El servidor no ha devuelto un análisis válido."
        );
      }

      const { assessment, priority, explanation } = data.ai;

      // Verificar los valores antes de mostrarlos
      if (
        (
          assessment !== "equivalent" &&
          assessment !== "meaning_changed" &&
          assessment !== "uncertain"
        ) ||
        (
          priority !== "low" &&
          priority !== "medium" &&
          priority !== "high" &&
          priority !== "unknown"
        ) ||
        typeof explanation !== "string"
      ) {
        throw new Error(
          "La IA ha devuelto un resultado inesperado."
        );
      }

      const ai: AIInterpretation = {
        assessment,
        priority,
        explanation,
      };

      // Actualizamos exclusivamente el cambio seleccionado
      setResult((previous) => {
        if (!previous) return null;

        return {
          ...previous,
          changes: previous.changes.map((item) =>
            item.id === change.id
              ? { ...item, ai }
              : item
          ),
        };
      });

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo analizar esta diferencia.";

      setAiErrors((previous) => ({
        ...previous,
        [change.id]: message,
      }));

    } finally {
      setAiLoadingId(null);
    }
  }

  const visibleChanges = useMemo(() => {
    if (!result) return [];

    return result.changes.filter(
      (change) =>
        category === "all" || change.category === category
    );
  }, [result, category]);

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#111b2e] p-5 md:p-8">

      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Comparación documental
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Detecta texto modificado, añadido y eliminado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loading || aiLoadingId !== null}
            onClick={() => {
              void compareDocuments();
            }}
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {loading
              ? "Comparando documentos..."
              : "Comparar documentos"}
          </button>
        </div>

      </div>

      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-6" aria-live="polite">

          {result.status === "needs_review" ? (
            <p className="rounded-xl bg-amber-400/10 p-4 text-sm text-amber-200">
              {result.reason ?? "Es necesaria una revisión manual."}
            </p>
          ) : (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                {(["modified", "added", "removed"] as const).map(
                  (kind) => (
                    <div
                      key={kind}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                    >
                      <p className="text-2xl font-bold text-white">
                        {result.summary?.[kind] ?? 0}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {typeLabels[kind]}
                      </p>
                    </div>
                  )
                )}
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="change-category"
                  className="text-sm text-slate-300"
                >
                  Filtrar cambios:
                </label>

                <select
                  id="change-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value as
                        | ChangeCategory
                        | "all"
                    )
                  }
                  className="rounded-lg border border-slate-600 bg-[#0b1120] px-3 py-2 text-sm text-white"
                >
                  <option value="all">Todos</option>
                  {Object.entries(categoryLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Lista de cambios */}
              <div className="space-y-3">
                {visibleChanges.map((change) => (
                  <article
                    key={change.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-white">
                        {typeLabels[change.type]}
                      </h3>

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                        {categoryLabels[change.category]}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="min-w-0 rounded-lg bg-red-400/5 p-3">
                        <p className="mb-2 text-xs font-semibold text-red-300">
                          ORIGINAL
                        </p>

                        <p className="break-words text-sm text-slate-200">
                          {change.reference?.text ??
                            "No existe en el original"}
                        </p>

                        {change.reference && (
                          <p className="mt-2 text-xs text-slate-500">
                            Página {change.reference.page}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 rounded-lg bg-emerald-400/5 p-3">
                        <p className="mb-2 text-xs font-semibold text-emerald-300">
                          REVISADO
                        </p>

                        <p className="break-words text-sm text-slate-200">
                          {change.final?.text ??
                            "No existe en el revisado"}
                        </p>

                        {change.final && (
                          <p className="mt-2 text-xs text-slate-500">
                            Página {change.final.page}
                          </p>
                        )}
                      </div>
                    </div>

                    {change.ai && (
                      <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">

                          <p className="text-sm font-semibold text-cyan-300">
                            ✦ Interpretación de IA
                          </p>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              change.ai.priority === "high"
                                ? "bg-red-400/10 text-red-300"
                                : change.ai.priority === "medium"
                                  ? "bg-amber-400/10 text-amber-300"
                                  : change.ai.priority === "low"
                                    ? "bg-emerald-400/10 text-emerald-300"
                                    : "bg-white/10 text-slate-300"
                            }`}
                          >
                            {change.ai.priority === "high"
                              ? "Prioridad alta"
                              : change.ai.priority === "medium"
                                ? "Prioridad media"
                                : change.ai.priority === "low"
                                  ? "Prioridad baja"
                                  : "Sin prioridad asignada"}
                          </span>
                        </div>

                        <p className="mt-3 text-xs font-medium text-slate-300">
                          {change.ai.assessment === "equivalent"
                            ? "Redacción posiblemente equivalente"
                            : change.ai.assessment === "meaning_changed"
                              ? "Posible cambio de significado"
                              : "Significado pendiente de revisión"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          {change.ai.explanation}
                        </p>

                        <p className="mt-3 text-xs text-slate-500">
                          Evaluación automática. Verificar con las
                          evidencias originales.
                        </p>
                      </div>
                    )}

                    
                    <div className="mt-4 flex flex-wrap items-center gap-3">

                      <button
                        type="button"
                        onClick={() => onInspect(change)}
                        className="rounded-lg border border-cyan-400/30 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/10"
                      >
                        Ver evidencias
                      </button>

                      <button
                        type="button"
                        disabled={loading || aiLoadingId !== null}
                        onClick={() => {
                          void analyzeChange(change);
                        }}
                        className="rounded-lg bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20 disabled:opacity-50"
                      >
                        {aiLoadingId === change.id
                          ? "Analizando..."
                          : change.ai
                            ? "✦ Volver a analizar"
                            : "✦ Analizar con IA"}
                      </button>

                    </div>

                    {aiErrors[change.id] && (
                      <p role="alert" className="mt-3 text-sm text-red-400">
                        {aiErrors[change.id]}
                      </p>
                    )}

                  </article>
                ))}

                {visibleChanges.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No se han detectado cambios en esta categoría
                    con el método de comparación actual.
                  </p>
                )}
              </div>

              {result.summary &&
                result.summary.total > result.summary.shown && (
                  <p className="text-xs text-amber-300">
                    Se muestran los primeros{" "}
                    {result.summary.shown} cambios de{" "}
                    {result.summary.total}.
                  </p>
                )}
            </>
          )}

          {result.warnings?.map((warning, index) => (
            <p
              key={index}
              className="text-xs text-slate-500"
            >
              {warning}
            </p>
          ))}
        </div>
      )}
    </section>
  );
  function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}
}
