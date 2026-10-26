
from collections import defaultdict
from difflib import SequenceMatcher
import re
import unicodedata


MAX_LINES_PER_DOCUMENT = 1200
MAX_VISIBLE_CHANGES = 80

DATE_RE = re.compile(
    r"\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b"
)

DATE_LABEL = re.compile(
    r"^\s*(?:fecha|vencimiento|plazo)\b",
    re.IGNORECASE
)

DURATION_RE = re.compile(
    r"\b\d+\s+(?:d[ií]as?|mes(?:es)?|a[nñ]os?|semanas?|horas?)\b",
    re.IGNORECASE
)

NAME_LABEL = re.compile(
    r"^\s*(?:nombre(?:\s+[^:]{1,35})?|cliente|proveedor|"
    r"representante|firmante|responsable|raz[oó]n social|"
    r"empresa)\s*:",
    re.IGNORECASE
)

AMOUNT_RE = re.compile(
    r"€|\bEUR\b|\beuros?\b",
    re.IGNORECASE
)

AMOUNT_LABEL = re.compile(
    r"^\s*(?:precio|importe|total|honorarios)\s*:",
    re.IGNORECASE
)


def normalize(text):
    """Normaliza espacios y caracteres Unicode."""
    return " ".join(
        unicodedata.normalize("NFKC", text).split()
    )


def document_lines(document):
    """Reconstruye lineas conservando su posicion en el PDF."""
    lines = []

    for page in document["pages"]:
        groups = defaultdict(list)

        for word in page["words"]:
            groups[
                (word["block"], word["line"])
            ].append(word)

        for group_key in sorted(groups):
            words = sorted(
                groups[group_key],
                key=lambda w: w["index"]
            )

            content = normalize(
                " ".join(w["text"] for w in words)
            )

            if not content:
                continue

            lines.append({
                "text": content,
                "page": page["page"],
                "bbox": [
                    min(w["bbox"][0] for w in words),
                    min(w["bbox"][1] for w in words),
                    max(w["bbox"][2] for w in words),
                    max(w["bbox"][3] for w in words),
                ],
                "pageWidth": page["width"],
                "pageHeight": page["height"],
                "rotation": page["rotation"],
            })

    return lines


def category_for(before, after):
    """Clasifica de forma orientativa un cambio."""
    texts = [
        item["text"]
        for item in (before, after)
        if item is not None
    ]

    if any(NAME_LABEL.search(t) for t in texts):
        return "nombre"

    if any(
        DATE_RE.search(t)
        or DATE_LABEL.search(t)
        or DURATION_RE.search(t)
        for t in texts
    ):
        return "fecha_plazo"

    if any(
        AMOUNT_RE.search(t) or AMOUNT_LABEL.search(t)
        for t in texts
    ):
        return "importe"

    return "texto"


def line_label(text):
    """Obtiene la etiqueta anterior a los dos puntos."""
    head, marker, _ = text.partition(":")

    if marker and len(head) <= 65:
        return normalize(head).casefold()

    return None


def similarity(old, new):
    """Calcula cuanto se parecen dos lineas."""
    old_label = line_label(old["text"])
    new_label = line_label(new["text"])

    if old_label and old_label == new_label:
        return 1.0

    return SequenceMatcher(
        None,
        old["text"].casefold(),
        new["text"].casefold()
    ).ratio()


def compare_documents(reference, final):
    """Compara dos documentos previamente extraidos."""
    old_lines = document_lines(reference)
    new_lines = document_lines(final)

    warnings = [
        "Comparacion textual preliminar: los cambios de "
        "formato, tablas o columnas pueden producir "
        "resultados imprecisos.",
        "Por ahora las evidencias corresponden a lineas "
        "completas, no solo a las palabras modificadas.",
    ]

    if any(
        page["rotation"] != 0
        for doc in (reference, final)
        for page in doc["pages"]
    ):
        warnings.append(
            "Hay paginas rotadas. Su resaltado visual "
            "todavia no esta implementado."
        )

    if not old_lines or not new_lines:
        return {
            "status": "needs_review",
            "reason": "No se ha podido extraer texto de ambos PDF.",
            "changes": [],
            "warnings": warnings,
        }

    if max(len(old_lines), len(new_lines)) > MAX_LINES_PER_DOCUMENT:
        return {
            "status": "needs_review",
            "reason": "Documento demasiado extenso para esta version.",
            "changes": [],
            "warnings": warnings,
        }

    changes = []

    def record(kind, before=None, after=None):
        changes.append({
            "id": f"change-{len(changes) + 1}",
            "type": kind,
            "category": category_for(before, after),
            "reference": before,
            "final": after,
        })

    diff = SequenceMatcher(
        None,
        [line["text"] for line in old_lines],
        [line["text"] for line in new_lines],
    )

    for tag, i1, i2, j1, j2 in diff.get_opcodes():
        before = old_lines[i1:i2]
        after = new_lines[j1:j2]

        if tag == "equal":
            continue

        if tag == "delete":
            for line in before:
                record("removed", before=line)

        elif tag == "insert":
            for line in after:
                record("added", after=line)

        elif tag == "replace":
            used_after = set()
            allow_pairs = len(before) * len(after) <= 900

            for old in before:
                choices = [
                    (similarity(old, new), j)
                    for j, new in enumerate(after)
                    if j not in used_after
                ] if allow_pairs else []

                if choices:
                    score, best = max(choices)
                else:
                    score, best = 0, -1

                if score >= 0.52:
                    used_after.add(best)

                    if old["text"] != after[best]["text"]:
                        record(
                            "modified",
                            before=old,
                            after=after[best]
                        )
                else:
                    record("removed", before=old)

            for j, new in enumerate(after):
                if j not in used_after:
                    record("added", after=new)

    by_type = {
        kind: sum(
            change["type"] == kind
            for change in changes
        )
        for kind in ("modified", "added", "removed")
    }

    return {
        "status": "different" if changes else "same",
        "summary": {
            **by_type,
            "total": len(changes),
            "shown": min(len(changes), MAX_VISIBLE_CHANGES),
        },
        "changes": changes[:MAX_VISIBLE_CHANGES],
        "warnings": warnings,
    }
