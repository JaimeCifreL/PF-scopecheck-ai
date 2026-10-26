"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

import DocumentUploadCard from "@/components/DocumentUploadCard";
import EvidenceExplorer from "@/components/EvidenceExplorer";
import ComparisonPanel from "@/components/ComparisonPanel";

import type { DocumentKind, EvidenceHit } from "@/types/evidence";
import type { ComparisonLine, DocumentChange } from "@/types/comparison";

const documentOptions: {
  id: DocumentKind;
  title: string;
  description: string;
  eyebrow: string;
}[] = [
  {
    id: "reference",
    title: "Documento original",
    description: "Versión de referencia, propuesta o contrato anterior",
    eyebrow: "01 / REFERENCIA",
  },
  {
    id: "final",
    title: "Documento revisado",
    description: "Nueva versión del documento que quieres comparar",
    eyebrow: "02 / REVISIÓN",
  },
];

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-slate-800 bg-[#111b2e] text-sm text-slate-400">
      Cargando vista previa…
    </div>
  ),
});

function lineToEvidence(
  kind: DocumentKind,
  line: ComparisonLine | null,
): EvidenceHit | null {
  if (!line) return null;

  return {
    kind,
    page: line.page,
    text: line.text,
    bbox: line.bbox,
    pageWidth: line.pageWidth,
    pageHeight: line.pageHeight,
    rotation: line.rotation,
  };
}

export default function Home() {
  const [files, setFiles] = useState<Record<DocumentKind, File | null>>({
    reference: null,
    final: null,
  });
  const [error, setError] = useState("");
  const [documentsVersion, setDocumentsVersion] = useState(0);
  const [currentPages, setCurrentPages] = useState<Record<DocumentKind, number>>({
    reference: 1,
    final: 1,
  });
  const [totalPages, setTotalPages] = useState<
    Record<DocumentKind, number | null>
  >({
    reference: null,
    final: null,
  });
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceHit | null>(
    null,
  );
  const [comparisonHighlights, setComparisonHighlights] = useState<
    Record<DocumentKind, EvidenceHit | null>
  >({
    reference: null,
    final: null,
  });

  const viewersRef = useRef<HTMLDivElement>(null);
  const ready = Boolean(files.reference && files.final);
  const loadedCount = Number(Boolean(files.reference)) + Number(Boolean(files.final));

  function clearHighlights() {
    setSelectedEvidence(null);
    setComparisonHighlights({ reference: null, final: null });
  }

  function selectFile(kind: DocumentKind, file?: File) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Solo se admiten archivos PDF.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("El archivo no puede superar los 15 MB.");
      return;
    }

    setFiles((previous) => ({ ...previous, [kind]: file }));
    setDocumentsVersion((previous) => previous + 1);
    setCurrentPages((previous) => ({ ...previous, [kind]: 1 }));
    setTotalPages((previous) => ({ ...previous, [kind]: null }));
    setError("");
    clearHighlights();
  }

  function removeFile(kind: DocumentKind) {
    setFiles((previous) => ({ ...previous, [kind]: null }));
    setDocumentsVersion((previous) => previous + 1);
    setCurrentPages((previous) => ({ ...previous, [kind]: 1 }));
    setTotalPages((previous) => ({ ...previous, [kind]: null }));
    setError("");
    clearHighlights();
  }

  function handlePageChange(kind: DocumentKind, requestedPage: number) {
    const maximum = totalPages[kind] ?? 1;
    const validPage = Math.max(1, Math.min(requestedPage, maximum));

    setCurrentPages((previous) => ({ ...previous, [kind]: validPage }));
    clearHighlights();
  }

  function handlePagesLoaded(kind: DocumentKind, total: number) {
    setTotalPages((previous) => ({ ...previous, [kind]: total }));
    setCurrentPages((previous) => ({
      ...previous,
      [kind]: Math.max(1, Math.min(previous[kind], total)),
    }));
  }

  function handleEvidenceSelect(hit: EvidenceHit) {
    setCurrentPages((previous) => ({ ...previous, [hit.kind]: hit.page }));
    setSelectedEvidence(hit);
    setComparisonHighlights({ reference: null, final: null });

    viewersRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleComparisonInspect(change: DocumentChange) {
    const referenceHit = lineToEvidence("reference", change.reference);
    const finalHit = lineToEvidence("final", change.final);

    setComparisonHighlights({ reference: referenceHit, final: finalHit });
    setCurrentPages((previous) => ({
      reference: referenceHit?.page ?? previous.reference,
      final: finalHit?.page ?? previous.final,
    }));
    setSelectedEvidence(null);

    viewersRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="min-h-screen bg-[#0d1117] font-sans text-slate-100">
      {/* Cabecera de aplicacion, sin hero comercial */}
      <header className="border-b border-slate-800/80 bg-[#111720]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-[#202a36] text-xs font-bold tracking-tight text-slate-100"
            >
              SC
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-[-0.015em] text-white">
                ScopeCheck
              </span>
              <span className="block text-[11px] text-slate-400">
                Document review
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>Espacio de trabajo local</span>
            <span className="ml-3 hidden border-l border-slate-700 pl-3 text-slate-500 sm:inline">
              Versión de prueba
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 pb-14 sm:px-8">
        {/* Titulo compacto y acciones de seccion, como una aplicacion B2B */}
        <div className="flex flex-col justify-between gap-5 border-b border-slate-800 py-7 sm:flex-row sm:items-end sm:py-8">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
              Área de revisión
            </p>
            <h1 className="text-[26px] font-semibold tracking-[-0.035em] text-white sm:text-[30px]">
              Comparación de documentos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Detecta cambios entre dos versiones, consulta las evidencias y
              analiza individualmente los hallazgos que necesites.
            </p>
          </div>
          <p className="shrink-0 text-xs text-slate-500">
            PDF · Hasta 15 MB por archivo
          </p>
        </div>

        <nav aria-label="Secciones" className="flex items-center gap-6 border-b border-slate-800/80 py-4 text-[13px]">
          <a href="#documentos" className="font-medium text-slate-200 transition hover:text-white">
            Documentos
          </a>
          {ready && (
            <>
              <a href="#comparacion" className="text-slate-400 transition hover:text-white">
                Resultados
              </a>
              <a href="#busqueda" className="text-slate-400 transition hover:text-white">
                Buscar evidencia
              </a>
            </>
          )}
        </nav>

        {/* Documentos: herramienta principal desde la primera pantalla */}
        <section id="documentos" className="scroll-mt-5 pt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-100">
                Documentos
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Selecciona la versión original y la versión que quieres revisar.
              </p>
            </div>
            <span className="text-xs tabular-nums text-slate-500">
              {loadedCount} de 2 archivos
            </span>
          </div>

          <div
            ref={viewersRef}
            className="grid scroll-mt-20 grid-cols-1 items-start gap-5 lg:grid-cols-2"
          >
            {documentOptions.map((option, index) => {
              const file = files[option.id];

              return (
                <div key={option.id} className="min-w-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-400">
                      {option.eyebrow}
                    </p>
                    {file && (
                      <span className="max-w-[52%] truncate text-xs text-slate-500" title={file.name}>
                        {file.name}
                      </span>
                    )}
                  </div>
                  {file ? (
                    <PdfViewer
                      file={file}
                      title={option.title}
                      pageNumber={currentPages[option.id]}
                      numPages={totalPages[option.id]}
                      onPageChange={(page) => handlePageChange(option.id, page)}
                      onPagesLoaded={(total) => handlePagesLoaded(option.id, total)}
                      onRemove={() => removeFile(option.id)}
                      highlight={
                        comparisonHighlights[option.id] ??
                        (selectedEvidence?.kind === option.id ? selectedEvidence : null)
                      }
                      highlightTone={
                        comparisonHighlights[option.id]
                          ? option.id === "reference"
                            ? "red"
                            : "green"
                          : "yellow"
                      }
                    />
                  ) : (
                    <DocumentUploadCard
                      number={index + 1}
                      title={option.title}
                      file={null}
                      onSelect={(selected) => selectFile(option.id, selected)}
                      onRemove={() => removeFile(option.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-start gap-2 border-t border-slate-800/70 pt-4 text-xs text-slate-400">
            <span
              aria-hidden="true"
              className={`mt-1 size-1.5 shrink-0 rounded-full ${
                ready ? "bg-emerald-400" : "bg-slate-500"
              }`}
            />
            {ready
              ? "Documentos preparados. Ejecuta la comparación en la sección Resultados."
              : "Añade los dos PDF para habilitar la comparación documental."}
          </div>
        </section>

        {/* La comparacion es el flujo principal; la busqueda queda como utilidad */}
        {files.reference && files.final && (
          <section id="comparacion" className="scroll-mt-6 pt-10">
            <ComparisonPanel
              key={`comparison-${documentsVersion}`}
              referenceFile={files.reference}
              finalFile={files.final}
              onInspect={handleComparisonInspect}
            />
          </section>
        )}

        {files.reference && files.final && (
          <section id="busqueda" className="scroll-mt-6 pt-7">
            <EvidenceExplorer
              key={`explorer-${documentsVersion}`}
              referenceFile={files.reference}
              finalFile={files.final}
              onSelectEvidence={handleEvidenceSelect}
            />
          </section>
        )}

        <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-slate-800 py-5 text-xs text-slate-500">
          <span>ScopeCheck · Vista de revisión documental</span>
          <span>Los hallazgos y análisis de IA requieren validación.</span>
        </footer>
      </div>
    </main>
  );
}
