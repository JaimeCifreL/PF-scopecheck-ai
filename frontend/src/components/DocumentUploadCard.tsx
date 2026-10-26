"use client";

type DocumentUploadCardProps = {
    number: number;
    title: string;
    file: File | null;
    onSelect: (file?: File) => void;
    onRemove: () => void;
};

export default function DocumentUploadCard({
    number,
    title,
    file,
    onSelect,
    onRemove,
}: DocumentUploadCardProps) {
    return (
        <div className="rounded-xl border border-slate-700 bg-white/[0.03] p-4">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 p-5 text-center transition hover:border-cyan-400 hover:bg-cyan-400/5">
            <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(event) => {
                onSelect(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
            }}
            />

            <span className="mb-4 rounded-lg bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-400">
            PDF 0{number}
            </span>

            <h3 className="font-semibold">{title}</h3>

            <p className="mt-2 max-w-xs break-all text-sm text-slate-400">
            {file?.name}
            </p>

            <span className="mt-5 text-sm font-medium text-cyan-400">
            {file ? "Cambiar documento" : "Seleccionar PDF"}
            </span>
        </label>

        {file && (
            <button
            type="button"
            onClick={onRemove}
            className="mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-red-400/50 hover:text-red-400"
            >
            Quitar documento
            </button>
        )}
        </div>
    );
}