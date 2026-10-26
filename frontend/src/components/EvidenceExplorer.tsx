
"use client";

import { useMemo, useState } from "react";

import type {
  EvidenceHit,
  ExtractedPdf,
} from "@/types/evidence";

type EvidenceExplorerProps = {
  referenceFile: File;
  finalFile: File;
  onSelectEvidence: (hit: EvidenceHit) => void;
};

const API_URL = "http://127.0.0.1:8010";

async function extractPdf(file: File): Promise<ExtractedPdf> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/extract`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo procesar ${file.name}. HTTP ${response.status}`
    );
  }

  return (await response.json()) as ExtractedPdf;
}

export default function EvidenceExplorer({
  referenceFile,
  finalFile,
  onSelectEvidence,
}: EvidenceExplorerProps) {
  const [documents, setDocuments] = useState<{
    reference: ExtractedPdf;
    final: ExtractedPdf;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeDocuments() {
    setLoading(true);
    setError("");
    setDocuments(null);

    try {
      const [reference, final] = await Promise.all([
        extractPdf(referenceFile),
        extractPdf(finalFile),
      ]);

      setDocuments({ reference, final });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido durante la extracción."
      );
    } finally {
      setLoading(false);
    }
  }

  const results = useMemo(() => {
    if (!documents || search.trim().length < 2) {
      return [];
    }

    const needle = search.trim().toLocaleLowerCase("es");
    const matches: EvidenceHit[] = [];

    for (const kind of ["reference", "final"] as const) {
      for (const page of documents[kind].pages) {
        // Primera versión: páginas sin rotación
        if (page.rotation !== 0) continue;

        for (const word of page.words) {
          if (
            word.text.toLocaleLowerCase("es").includes(needle)
          ) {
            matches.push({
              kind,
              page: page.page,
              text: word.text,
              bbox: word.bbox,
              pageWidth: page.width,
              pageHeight: page.height,
              rotation: page.rotation,
            });

            if (matches.length >= 20) {
              return matches;
            }
          }
        }
      }
    }

    return matches;
  }, [documents, search]);

  const totalWords = documents
    ? Object.values(documents).reduce(
        (total, document) =>
          total +
          document.pages.reduce(
            (subtotal, page) => subtotal + page.words.length,
            0
          ),
        0
      )
    : 0;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#111b2e] p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Explorador de evidencias
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Extrae texto y localiza palabras en tus PDF.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void analyzeDocuments();
          }}
          className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          {loading ? "Extrayendo..." : "Extraer evidencias"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}

      {documents && (
        <div className="mt-7 space-y-5">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
            <p className="text-sm font-medium text-cyan-300">
              Extracción completada
            </p>

            <p className="mt-1 text-sm text-slate-300">
              {totalWords.toLocaleString("es-ES")} palabras
              localizadas en los dos documentos.
            </p>
          </div>

          <div>
            <label
              htmlFor="evidence-search"
              className="mb-2 block text-sm font-medium text-white"
            >
              Buscar palabra
            </label>

            <input
              id="evidence-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ejemplo: contrato, precio, plazo..."
              className="w-full rounded-xl border border-slate-600 bg-[#0b1120] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
            />
          </div>

          {search.trim().length >= 2 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                Mostrando hasta 20 coincidencias
              </p>

              {results.length === 0 && (
                <p className="text-sm text-slate-400">
                  No se encontraron coincidencias en
                  las páginas admitidas.
                </p>
              )}

              {results.map((hit, index) => (
                <button
                  key={`${hit.kind}-${hit.page}-${index}`}
                  type="button"
                  onClick={() => onSelectEvidence(hit)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition hover:border-cyan-400/60"
                >
                  <div>
                    <p className="font-medium text-white">
                      {hit.text}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {hit.kind === "reference"
                        ? "Documento de referencia"
                        : "Documento a revisar"}
                      {" · Página "}
                      {hit.page}
                    </p>
                  </div>

                  <span className="text-xs font-medium text-cyan-400">
                    Localizar →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Extracción local · Sin análisis mediante IA
      </p>
    </section>
  );
}
