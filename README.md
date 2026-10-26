# ScopeCheck AI

Comparador de documentos PDF con revisión asistida por IA **local**. Sube una versión original y una versión revisada (contrato, propuesta, presupuesto…), detecta qué ha cambiado, localiza cada cambio sobre el propio PDF y, si quieres, pide a un modelo local que interprete si el significado ha cambiado.

> **Estado:** versión de prueba (v0.1.0). Los resultados son orientativos y requieren validación humana. No sustituyen una revisión jurídica.

## Características

- **Comparación línea a línea** entre dos PDF, con cambios clasificados como *modificado*, *añadido* o *eliminado*.
- **Categorías orientativas:** nombres, fechas y plazos, importes y texto general.
- **Evidencia visual:** cada cambio se resalta sobre el PDF (rojo en el original, verde en el revisado).
- **Buscador de evidencia:** busca texto en ambos documentos y salta a la página y la posición exacta.
- **Interpretación con IA bajo demanda:** analiza un cambio concreto y devuelve una valoración (`equivalent`, `meaning_changed`, `uncertain`), una prioridad potencial y una explicación breve en español.
- **Privacidad:** la IA corre en local con [Ollama](https://ollama.com). Los documentos no salen de tu máquina.
- **Comparación de precios** (endpoint de API): detecta un único importe en euros junto a las etiquetas "Precio" o "Importe" y calcula la diferencia.

## Arquitectura

```
scopecheck-ai/
├── backend/            API FastAPI (extracción, comparación e IA)
│   └── app/
│       ├── main.py           Endpoints y validaciones de entrada
│       ├── document_diff.py  Comparación textual de líneas
│       ├── comparison.py     Comparación de importes
│       └── ai_review.py      Interpretación semántica con Ollama
└── frontend/           Interfaz Next.js (React + Tailwind + react-pdf)
```

Flujo: el frontend envía los PDF al backend → PyMuPDF extrae palabras con sus coordenadas → Python detecta las diferencias y conserva la posición de cada línea → la IA solo interpreta el texto de los cambios que el usuario selecciona, nunca inventa coordenadas ni referencias.

## Requisitos

- Python 3.10 o superior
- Node.js 20 o superior y npm
- [Ollama](https://ollama.com) (solo para el análisis con IA)

## Puesta en marcha

### 1. Backend

```
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # opcional: ajusta modelo o host de Ollama
uvicorn app.main:app --reload --port 8010
```

La API queda en `http://127.0.0.1:8010` y la documentación interactiva en `http://127.0.0.1:8010/docs`.

> El frontend apunta al puerto **8010**. Si usas otro puerto, cambia la constante `API_URL` en `frontend/src/components/ComparisonPanel.tsx` y `frontend/src/components/EvidenceExplorer.tsx`.

### 2. Modelo de IA (opcional)

```
ollama pull qwen3:1.7b
ollama serve                     # si no se está ejecutando ya
```

Sin Ollama, la comparación y la búsqueda de evidencias funcionan igual; solo falla el botón de análisis con IA.

### 3. Frontend

```
cd frontend
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Configuración

Variables del backend (archivo `backend/.env`, ver `backend/.env.example`):

| Variable | Por defecto | Descripción |
|---|---|---|
| `SCOPECHECK_AI_MODEL` | `qwen3:1.7b` | Modelo de Ollama usado para interpretar cambios |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | URL del servidor Ollama |

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio |
| `POST` | `/extract` | Extrae palabras y coordenadas de un PDF (`file`) |
| `POST` | `/compare` | Compara dos PDF (`reference`, `final`) y lista los cambios |
| `POST` | `/compare-price` | Compara el importe en euros de dos PDF |
| `POST` | `/analyze-ai` | Comparación + interpretación por IA (`reference`, `final`) |
| `POST` | `/analyze-change` | Interpreta un único cambio (JSON: `type`, `referenceText`, `finalText`) |

Ejemplo:

```
curl -X POST http://127.0.0.1:8010/compare \
  -F "reference=@original.pdf" \
  -F "final=@revisado.pdf"
```

## Límites actuales

- Solo PDF con capa de texto (sin OCR para documentos escaneados).
- Máximo 15 MB y 30 páginas por archivo; PDF sin contraseña.
- Hasta 1200 líneas por documento y 80 cambios mostrados.
- La evidencia corresponde a líneas completas, no solo a las palabras modificadas.
- El resaltado visual aún no está implementado en páginas rotadas.
- Tablas y maquetaciones por columnas pueden dar resultados imprecisos.
- La IA analiza un cambio cada vez y trunca fragmentos de más de 600 caracteres (en ese caso marca el cambio como incierto).
- CORS limitado a `localhost:3000` y `127.0.0.1:3000`.

## Seguridad y privacidad

- Los textos de los documentos se tratan como **datos no fiables** en el prompt del modelo, para mitigar inyecciones de instrucciones dentro del PDF.
- La respuesta de la IA se valida con un esquema y solo se aceptan los identificadores enviados.
- No subas documentos confidenciales a un servidor Ollama remoto que no controles.
- Los archivos `.env` están en `.gitignore`; no los publiques.

## Desarrollo

```
# Frontend
cd frontend
npm run lint
npm run build
```

## Hoja de ruta

- Resaltado a nivel de palabra
- Soporte para páginas rotadas
- OCR para PDF escaneados
- URL del backend configurable por variable de entorno
- Tests automáticos

# ScopeCheck AI · Frontend

Interfaz web de ScopeCheck AI, construida con Next.js, React, Tailwind CSS y react-pdf.

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Necesita el backend en `http://127.0.0.1:8010` (ver el [README principal](../README.md)).

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Análisis con ESLint |

## Estructura

```
src/
├── app/            Página principal, layout y estilos globales
├── components/     Carga de PDF, visor, comparación y buscador de evidencia
└── types/          Tipos de comparación y evidencia
```

## Configuración

La URL del backend está definida como constante `API_URL` en `src/components/ComparisonPanel.tsx` y `src/components/EvidenceExplorer.tsx`.
