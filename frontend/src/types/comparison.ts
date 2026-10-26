
import type { BoundingBox } from "@/types/evidence";

export type ChangeType =
  | "modified"
  | "added"
  | "removed";

export type ChangeCategory =
  | "nombre"
  | "fecha_plazo"
  | "importe"
  | "texto";

export type ComparisonLine = {
  text: string;
  page: number;
  bbox: BoundingBox;
  pageWidth: number;
  pageHeight: number;
  rotation: number;
};

export type DocumentChange = {
  id: string;
  type: ChangeType;
  category: ChangeCategory;
  reference: ComparisonLine | null;
  final: ComparisonLine | null;
  ai?: AIInterpretation;
};

export type ComparisonResult = {
  status: "different" | "same" | "needs_review";
  reason?: string;
  summary?: {
    modified: number;
    added: number;
    removed: number;
    total: number;
    shown: number;
  };
  changes: DocumentChange[];
  warnings?: string[];
};


export type AIInterpretation = {
  assessment:
    | "equivalent"
    | "meaning_changed"
    | "uncertain";

  priority:
    | "low"
    | "medium"
    | "high"
    | "unknown";

  explanation: string;
};

export type AIReviewResult = {
  status: "ok" | "same" | "needs_review";
  reason?: string;
  model?: string;
  total_detected?: number;
  reviewed?: number;
  partial?: boolean;
  changes: DocumentChange[];
  warnings?: string[];
};
