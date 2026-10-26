
from fastapi import FastAPI, HTTPException, UploadFile
import pymupdf
from fastapi.middleware.cors import CORSMiddleware
from app.comparison import compare_prices
from app.document_diff import compare_documents
from app.ai_review import semantic_review
from typing import Literal
from pydantic import BaseModel, Field

app = FastAPI(
    title="ScopeCheck AI API",
    version="0.1.0",
    description="Backend de análisis documental"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


MAX_FILE_SIZE = 15 * 1024 * 1024
MAX_PAGES = 30


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "scopecheck-backend"
    }


@app.post("/extract")
def extract_pdf(file: UploadFile):

    # 1. Comprobar el nombre del archivo
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Debes enviar un archivo PDF."
        )

    # 2. Leer el archivo con un limite de tamaño
    try:
        pdf_bytes = file.file.read(MAX_FILE_SIZE + 1)
    finally:
        file.file.close()

    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="El PDF supera los 15 MB."
        )

    # 3. Comprobar la cabecera del archivo
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="El archivo no tiene una cabecera PDF valida."
        )

    # 4. Abrir y procesar el documento
    try:
        with pymupdf.open(
            stream=pdf_bytes,
            filetype="pdf"
        ) as document:

            if document.needs_pass:
                raise HTTPException(
                    status_code=400,
                    detail="El PDF requiere una contraseña."
                )

            if document.page_count > MAX_PAGES:
                raise HTTPException(
                    status_code=413,
                    detail="La demo admite un maximo de 30 paginas."
                )

            pages = []

            for page in document:

                words = []

                for word in page.get_text("words"):

                    words.append({
                        "text": word[4],
                        "bbox": [
                            round(float(value), 2)
                            for value in word[:4]
                        ],
                        "block": word[5],
                        "line": word[6],
                        "index": word[7]
                    })


                pages.append({
                    "page": page.number + 1,
                    "width": round(page.rect.width, 2),
                    "height": round(page.rect.height, 2),
                    "rotation": page.rotation,
                    "words": words
                })

            return {
                "filename": file.filename,
                "page_count": document.page_count,
                "pages": pages
            }

    except pymupdf.FileDataError as exc:
        raise HTTPException(
            status_code=400,
            detail="No se ha podido interpretar el PDF."
        ) from exc


@app.post("/compare-price")
def compare_price_documents(
    reference: UploadFile,
    final: UploadFile
):
    # Reutilir la extraccion y validaciones existentes
    reference_data = extract_pdf(reference)
    final_data = extract_pdf(final)

    # Comparar los datos obtenidos
    return compare_prices(
        reference_data,
        final_data
    )


@app.post("/compare")
def compare_document_files(
    reference: UploadFile,
    final: UploadFile
):
    # Reutilizar el extractor existente
    reference_data = extract_pdf(reference)
    final_data = extract_pdf(final)

    # Ejecutar el comparador general
    return compare_documents(
        reference_data,
        final_data
    )


@app.post("/analyze-ai")
def analyze_with_ai(
    reference: UploadFile,
    final: UploadFile
):
    # 1. Extraer ambos documentos
    reference_data = extract_pdf(reference)
    final_data = extract_pdf(final)

    # 2. Comparacion textual existente
    comparison = compare_documents(
        reference_data,
        final_data
    )

    # 3. Comprobar si la extraccion fue suficiente
    if comparison["status"] == "needs_review":
        return {
            "status": "needs_review",
            "reason": comparison["reason"],
            "changes": [],
            "warnings": comparison.get("warnings", [])
        }

    # 4. Evitar llamadas innecesarias a la IA
    if not comparison["changes"]:
        return {
            "status": "same",
            "total_detected": 0,
            "reviewed": 0,
            "partial": False,
            "changes": [],
            "warnings": comparison.get("warnings", [])
        }

    # 5. Interpretacion semantica
    return semantic_review(comparison)


class AnalyzeChangeRequest(BaseModel):
    type: Literal["modified", "added", "removed"]
    referenceText: str | None = Field(
        default=None,
        max_length=1500
    )
    finalText: str | None = Field(
        default=None,
        max_length=1500
    )


@app.post("/analyze-change")
def analyze_single_change(data: AnalyzeChangeRequest):
    before = (data.referenceText or "").strip()
    after = (data.finalText or "").strip()

    # Validar que cada tipo tenga sus textos esperados
    if data.type == "modified" and (not before or not after):
        raise HTTPException(
            status_code=422,
            detail="Un cambio modificado necesita ambos textos."
        )

    if data.type == "added" and (before or not after):
        raise HTTPException(
            status_code=422,
            detail="Un cambio añadido solo necesita texto final."
        )

    if data.type == "removed" and (not before or after):
        raise HTTPException(
            status_code=422,
            detail="Un cambio eliminado solo necesita texto original."
        )

    # Convertir el cambio al formato que ya usa la IA
    comparison = {
        "changes": [
            {
                "id": "selected",
                "type": data.type,
                "reference": (
                    {"text": before} if before else None
                ),
                "final": (
                    {"text": after} if after else None
                ),
            }
        ],
        "summary": {"total": 1},
        "warnings": [],
    }

    # Reutilizar nuestro analizador de Ollama
    result = semantic_review(comparison)

    return {
        "ai": result["changes"][0]["ai"]
    }
