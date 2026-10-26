
"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { EvidenceHit } from "@/types/evidence";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";


function centerEvidence(
  container: HTMLDivElement | null,
  marker: HTMLDivElement | null
) {
  if (!container || !marker) return;

  const containerRect = container.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  const targetTop =
    container.scrollTop +
    markerRect.top -
    containerRect.top -
    (container.clientHeight - markerRect.height) / 2;

  container.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
}


// Configuracion del procesador PDF
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();


type PdfViewerProps = {
  file: File;
  title: string;
  onRemove: () => void;
  pageNumber: number;
  numPages: number | null;
  onPageChange: (page: number) => void;
  onPagesLoaded: (total: number) => void;
  highlight: EvidenceHit | null;
  highlightTone?: "yellow" | "red" | "green";
};


export default function PdfViewer({
  file,
  title,
  onRemove,
  pageNumber,
  numPages,
  onPageChange,
  onPagesLoaded,
  highlight,
  highlightTone = "yellow",
}: PdfViewerProps) {

  
    const containerRef = useRef<HTMLDivElement>(null);
    const evidenceRef = useRef<HTMLDivElement>(null);
    const [pageWidth, setPageWidth] = useState(440);

    useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const updateWidth = () => {
        const availableWidth = container.clientWidth - 32;

        setPageWidth(
        Math.max(150, Math.min(700, availableWidth))
        );
    };

    const observer = new ResizeObserver(updateWidth);

    observer.observe(container);
    updateWidth();

    return () => observer.disconnect();
    }, []);

    
    useEffect(() => {
    if (!highlight || highlight.page !== pageNumber) {
        return;
    }

    centerEvidence(
        containerRef.current,
        evidenceRef.current
    );
    }, [highlight, pageNumber]);

  
    function previousPage() {
        onPageChange(Math.max(1, pageNumber - 1));
    }

    function nextPage() {
        onPageChange(
            Math.min(numPages ?? pageNumber, pageNumber + 1)
        );
    }


  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111b2e]">

      
        {/* Cabecera del visor */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white">
            {title}
            </h3>

            <p className="mt-1 truncate text-xs text-slate-400">
            {file.name}
            </p>
        </div>

        <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-400/10"
        >
            Quitar documento
        </button>
        </div>

      {/* Navegacion */}
      <div className="flex flex-wrap items-center justify-center gap-4 border-b border-white/10 p-3">

        <button
          type="button"
          onClick={previousPage}
          disabled={pageNumber <= 1}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Anterior
        </button>

        <span
          aria-live="polite"
          className="text-sm text-slate-300"
        >
          {pageNumber} / {numPages ?? "..."}
        </span>

        <button
          type="button"
          onClick={nextPage}
          disabled={!numPages || pageNumber >= numPages}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Siguiente
        </button>
      </div>

      {/* Documento */}
      <div ref={containerRef} className="max-h-[65vh] overflow-auto bg-slate-200 p-4">
        <div className="mx-auto w-fit shadow-xl">
          <Document
            file={file}
            suspense={false}
            loading={
              <p className="p-6 text-sm text-slate-700">
                Cargando documento...
              </p>
            }
            error={
              <p className="p-6 text-sm text-red-700">
                No se ha podido abrir este PDF.
              </p>
            }
            onLoadSuccess={({ numPages: total }) => {
                onPagesLoaded(total);
            }}
          >
            
        <Page
        pageNumber={pageNumber}
        width={pageWidth}
        renderTextLayer={true}
        renderAnnotationLayer={false}
        onRenderSuccess={() => {
            if (highlight?.page === pageNumber) {
            centerEvidence(
                containerRef.current,
                evidenceRef.current
            );
            }
        }}
        >
        {highlight &&
            highlight.page === pageNumber &&
            highlight.rotation === 0 &&
            highlight.pageWidth > 0 &&
            highlight.pageHeight > 0 && (
            <div
                ref={evidenceRef}
                className={`pointer-events-none absolute z-20 rounded-sm border-2 ${
                highlightTone === "red"
                    ? "border-rose-500 bg-rose-300/40"
                    : highlightTone === "green"
                    ? "border-emerald-500 bg-emerald-300/40"
                    : "border-amber-500 bg-yellow-300/50"
                }`}
                style={{
                left: `${
                    (highlight.bbox[0] / highlight.pageWidth) * 100
                }%`,

                top: `${
                    (highlight.bbox[1] / highlight.pageHeight) * 100
                }%`,

                width: `${
                    ((highlight.bbox[2] - highlight.bbox[0]) /
                    highlight.pageWidth) *
                    100
                }%`,

                height: `${
                    ((highlight.bbox[3] - highlight.bbox[1]) /
                    highlight.pageHeight) *
                    100
                }%`,
                }}
            />
            )}
        </Page>

          </Document>
        </div>
      </div>

      <div className="border-t border-white/10 p-3 text-center text-xs text-slate-400">
        Visor PDF · ScopeCheck Evidence Mode
      </div>

    </article>
  );
}
