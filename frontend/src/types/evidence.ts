
export type DocumentKind = "reference" | "final";

export type BoundingBox = [
  number,
  number,
  number,
  number
];

export type ExtractedWord = {
  text: string;
  bbox: BoundingBox;
};

export type ExtractedPage = {
  page: number;
  width: number;
  height: number;
  rotation: number;
  words: ExtractedWord[];
};

export type ExtractedPdf = {
  filename: string;
  page_count: number;
  pages: ExtractedPage[];
};

export type EvidenceHit = {
  kind: DocumentKind;
  page: number;
  text: string;
  bbox: BoundingBox;
  pageWidth: number;
  pageHeight: number;
  rotation: number;
};
