import re
from collections import defaultdict
from decimal import Decimal
from typing import Any


AMOUNT_PATTERN = re.compile(
    r"(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?"
)

CURRENCY_WORDS = {"€", "eur", "euro", "euros"}


def _amount_from_word(text: str) -> Decimal | None:
    cleaned = text.strip().strip(";:().").replace("€", "")

    if not AMOUNT_PATTERN.fullmatch(cleaned):
        return None

    return Decimal(
        cleaned.replace(".", "").replace(",", ".")
    )


def _has_euro(words: list[dict[str, Any]]) -> bool:
    for word in words:
        token = word["text"].strip(".,;:() ").casefold()

        if token in CURRENCY_WORDS or "€" in word["text"]:
            return True

    return False


def _find_prices(document: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = []

    for page in document["pages"]:
        if page["rotation"] != 0:
            continue

        lines = defaultdict(list)

        # Agrupamos las palabras de cada linea
        for word in page["words"]:
            lines[(word["block"], word["line"])].append(word)

        for line_words in lines.values():
            line_words.sort(key=lambda word: word["index"])

            for position, word in enumerate(line_words):
                label = word["text"].strip(" :.").casefold()

                if label not in {"precio", "importe"}:
                    continue

                # Buscamos un importe cercano a la etiqueta
                context = line_words[position + 1:position + 8]

                if not _has_euro(context):
                    continue

                for amount_word in context:
                    value = _amount_from_word(amount_word["text"])

                    if value is None:
                        continue

                    candidates.append({
                        "value": float(value),
                        "page": page["page"],
                        "bbox": amount_word["bbox"],
                        "pageWidth": page["width"],
                        "pageHeight": page["height"],
                        "rotation": page["rotation"],
                        "evidence": " ".join(
                            w["text"] for w in line_words
                        ),
                    })

                    break

    return candidates


def compare_prices(
    reference: dict[str, Any],
    final: dict[str, Any]
) -> dict[str, Any]:

    reference_prices = _find_prices(reference)
    final_prices = _find_prices(final)

    # Evitamos concluir cuando faltan datos
    # o existen varios importes candidatos
    if len(reference_prices) != 1 or len(final_prices) != 1:
        return {
            "status": "needs_review",
            "reason": (
                "No se ha encontrado un unico importe en euros "
                "en cada PDF, en una linea con la etiqueta "
                "'Precio' o 'Importe'."
            ),
            "candidates": {
                "reference": len(reference_prices),
                "final": len(final_prices),
            },
        }

    original = reference_prices[0]
    revised = final_prices[0]

    amount_before = Decimal(str(original["value"]))
    amount_after = Decimal(str(revised["value"]))

    change = amount_after - amount_before

    percentage = (
        float(
            (change / amount_before * 100).quantize(
                Decimal("0.01")
            )
        )
        if amount_before != 0
        else None
    )

    return {
        "status": "different" if change else "same",
        "field": "precio",
        "reference": original,
        "final": revised,
        "difference": float(change),
        "percentage": percentage,
        "warning": (
            "Comparacion preliminar: comprobar que ambos "
            "importes se refieren al mismo concepto."
        ),
    }
