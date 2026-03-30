# Mini-RAG Pipeline

A Retrieval-Augmented Generation chatbot that retrieves relevant information from Indecimal company documents and generates grounded answers. Built with a **FastAPI** backend, **React + Vite** frontend, and fully containerized via **Docker Compose**.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Models Used](#models-used)
- [Document Chunking & Retrieval](#document-chunking--retrieval)
- [Grounding to Retrieved Context](#grounding-to-retrieved-context)
- [Running Locally](#running-locally)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)

---

## Architecture Overview

```
Documents (doc1.md, doc2.md, doc3.md)
    ↓
Chunking (paragraph-aware, ~500 chars, 50-char overlap)
    ↓
Embeddings (OpenRouter API / text-embedding-3-small)
    ↓
FAISS Index (L2 similarity search)
    ↓
User Query → Retrieve Top-3 Chunks → Ollama LLM (llama3) → Grounded Answer
```

---

## Models Used

### Embedding Model — `openai/text-embedding-3-small` (via OpenRouter)

| Property   | Value                                  |
|------------|----------------------------------------|
| Provider   | OpenRouter (OpenAI-compatible API)     |
| Model      | `openai/text-embedding-3-small`        |
| Dimensions | 1536                                   |
| Purpose    | Convert text chunks & queries to vectors |

**Why this model?**
- **High quality at low cost** — `text-embedding-3-small` offers strong semantic understanding at a fraction of the cost of larger embedding models.
- **OpenRouter access** — Using OpenRouter provides a unified API gateway, making it easy to swap models without code changes.
- **OpenAI-compatible SDK** — The standard `openai` Python package works directly with OpenRouter, keeping dependencies minimal.

### LLM — Configurable (Ollama or API)

| Property    | Value                              |
|-------------|-------------------------------------|
| Provider    | Ollama (local) OR OpenRouter (API)  |
| Model       | `llama3` (local) OR `meta-llama/llama-3-8b-instruct` (API) |
| Temperature | `0.3` (low, for factual accuracy)   |
| Max Tokens  | `512`                               |

**Why this flexibility?**
- **Fully local & private (Ollama)** — Run the LLM on your machine. No document data is sent to external APIs during answer generation, and all inference is free.
- **Cloud API (OpenRouter)** — Don't have the RAM to run Llama 3 locally? You can easily switch to use OpenRouter's API for the LLM by changing `LLM_PROVIDER=api` in the `.env` file.
- **Instruction-following** — Llama 3 excels at following system prompts, which is critical for enforcing grounding constraints.

---

## Document Chunking & Retrieval

### Chunking Strategy

Documents are split using a **paragraph-aware, overlapping chunking** approach:

1. **Paragraph splitting** — Each markdown document is split on double newlines (`\n\n`), preserving logical paragraph boundaries.
2. **Size-based grouping** — Paragraphs are accumulated into chunks of approximately **500 characters** (`CHUNK_SIZE=500`). A new chunk is started when adding the next paragraph would exceed the limit.
3. **Overlapping windows** — The last **50 characters** (`CHUNK_OVERLAP=50`) of the previous chunk are carried forward into the next chunk. This prevents information loss at chunk boundaries.
4. **Metadata tagging** — Each chunk retains its source filename and a sequential `chunk_id` for traceability.

**Why this approach?**
- Splitting at paragraph boundaries keeps semantically coherent units together, unlike fixed-character splits that can cut mid-sentence.
- Overlap ensures that sentences spanning two chunks are still retrievable.
- Small chunk sizes (~500 chars) produce focused embeddings that match more precisely to user queries.

### Retrieval (Semantic Search)

Retrieval uses **FAISS** (`IndexFlatL2`) for exact nearest-neighbor search:

1. The user's query is embedded using the same `text-embedding-3-small` model.
2. FAISS computes **L2 (Euclidean) distance** between the query vector and all chunk vectors.
3. The **top-3** (`TOP_K=3`) closest chunks are returned, ranked by distance score.

**Why FAISS with `IndexFlatL2`?**
- **Exact search** — `IndexFlatL2` performs brute-force search with no approximation, giving the most accurate results for small document sets.
- **Zero configuration** — No training, tuning, or index parameters required.
- **Fast for small corpora** — With only a few dozen chunks, brute-force is effectively instant.

---

## Grounding to Retrieved Context

Grounding ensures the LLM only uses information from the retrieved documents, not its own training data. This is enforced through **three mechanisms**:

### 1. Strict System Prompt

The LLM receives a system prompt that explicitly constrains its behavior:

```
You are a helpful assistant for Indecimal, a home construction company.
You MUST answer the user's question ONLY using the provided context below.
Do NOT use any external knowledge or make up information.
If the provided context does not contain enough information to answer, say:
"I don't have enough information in the provided documents to answer this question."

Always cite which source document(s) your answer comes from.
Be clear, concise, and accurate.
```

### 2. Structured Prompt with Context Injection

The user prompt is structured to clearly separate retrieved context from the question:

```
Context (retrieved from company documents):
--- Source: doc1.md (Chunk #2) ---
[chunk text]
--- Source: doc3.md (Chunk #0) ---
[chunk text]

Question: [user's question]

Answer (based strictly on the above context):
```

Each context chunk includes its source filename and chunk ID, enabling the LLM to cite its sources.

### 3. Low Temperature Generation

The LLM temperature is set to **0.3**, which:
- Reduces creative/speculative outputs
- Favors high-probability tokens that stick closely to the provided context
- Minimizes hallucination risk

---

## Running Locally

### Prerequisites

- **Python 3.11+**
- **Node.js 20+** and **npm**
- **Ollama** — [Install from ollama.ai](https://ollama.ai)
- **OpenRouter API Key** — [Get one at openrouter.ai](https://openrouter.ai)
- **Docker & Docker Compose** (optional, for containerized deployment)

---

--

### Option 1: Run Without Docker

#### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Linux/macOS
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env and set your OPENROUTER_API_KEY
# Keep LLM_PROVIDER=api if you want to use the cloud LLM, 
# or change it to LLM_PROVIDER=ollama to run locally.
```

Optionally, if you are using `LLM_PROVIDER=ollama`, make sure Ollama is installed and running:

```bash
ollama serve
ollama pull llama3
```

Start the backend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at **http://localhost:5173** and proxies API requests to the backend at **http://localhost:8000**.

---

## API Endpoints

| Method | Endpoint  | Description                        |
|--------|-----------|------------------------------------|
| `GET`  | `/health` | Health check, returns pipeline status |
| `POST` | `/chat`   | Send a query, receive a grounded answer with sources |

### `POST /chat` — Example

**Request:**

```json
{
  "query": "What services does Indecimal offer?"
}
```

**Response:**

```json
{
  "answer": "Based on the company documents, Indecimal offers...",
  "sources": [
    {
      "source": "doc1.md",
      "chunk_id": 2,
      "score": 0.342,
      "rank": 1,
      "text_preview": "Indecimal provides comprehensive home construction..."
    }
  ]
}
```

---

# mini_RAG
# Mini-RAG Pipeline

A Retrieval-Augmented Generation chatbot that retrieves relevant information from Indecimal company documents and generates grounded answers. Built with a **FastAPI** backend, **React + Vite** frontend, and fully containerized via **Docker Compose**.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Models Used](#models-used)
- [Document Chunking & Retrieval](#document-chunking--retrieval)
- [Grounding to Retrieved Context](#grounding-to-retrieved-context)
- [Running Locally](#running-locally)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)

---

## Architecture Overview

```
Documents (doc1.md, doc2.md, doc3.md)
    ↓
Chunking (paragraph-aware, ~500 chars, 50-char overlap)
    ↓
Embeddings (OpenRouter API / text-embedding-3-small)
    ↓
FAISS Index (L2 similarity search)
    ↓
User Query → Retrieve Top-3 Chunks → Ollama LLM (llama3) → Grounded Answer
```

---

## Models Used

### Embedding Model — `openai/text-embedding-3-small` (via OpenRouter)

| Property   | Value                                  |
|------------|----------------------------------------|
| Provider   | OpenRouter (OpenAI-compatible API)     |
| Model      | `openai/text-embedding-3-small`        |
| Dimensions | 1536                                   |
| Purpose    | Convert text chunks & queries to vectors |

**Why this model?**
- **High quality at low cost** — `text-embedding-3-small` offers strong semantic understanding at a fraction of the cost of larger embedding models.
- **OpenRouter access** — Using OpenRouter provides a unified API gateway, making it easy to swap models without code changes.
- **OpenAI-compatible SDK** — The standard `openai` Python package works directly with OpenRouter, keeping dependencies minimal.

### LLM — Configurable (Ollama or API)

| Property    | Value                              |
|-------------|-------------------------------------|
| Provider    | Ollama (local) OR OpenRouter (API)  |
| Model       | `llama3` (local) OR `meta-llama/llama-3-8b-instruct` (API) |
| Temperature | `0.3` (low, for factual accuracy)   |
| Max Tokens  | `512`                               |

**Why this flexibility?**
- **Fully local & private (Ollama)** — Run the LLM on your machine. No document data is sent to external APIs during answer generation, and all inference is free.
- **Cloud API (OpenRouter)** — Don't have the RAM to run Llama 3 locally? You can easily switch to use OpenRouter's API for the LLM by changing `LLM_PROVIDER=api` in the `.env` file.
- **Instruction-following** — Llama 3 excels at following system prompts, which is critical for enforcing grounding constraints.

---

## Document Chunking & Retrieval

### Chunking Strategy

Documents are split using a **paragraph-aware, overlapping chunking** approach:

1. **Paragraph splitting** — Each markdown document is split on double newlines (`\n\n`), preserving logical paragraph boundaries.
2. **Size-based grouping** — Paragraphs are accumulated into chunks of approximately **500 characters** (`CHUNK_SIZE=500`). A new chunk is started when adding the next paragraph would exceed the limit.
3. **Overlapping windows** — The last **50 characters** (`CHUNK_OVERLAP=50`) of the previous chunk are carried forward into the next chunk. This prevents information loss at chunk boundaries.
4. **Metadata tagging** — Each chunk retains its source filename and a sequential `chunk_id` for traceability.

**Why this approach?**
- Splitting at paragraph boundaries keeps semantically coherent units together, unlike fixed-character splits that can cut mid-sentence.
- Overlap ensures that sentences spanning two chunks are still retrievable.
- Small chunk sizes (~500 chars) produce focused embeddings that match more precisely to user queries.

### Retrieval (Semantic Search)

Retrieval uses **FAISS** (`IndexFlatL2`) for exact nearest-neighbor search:

1. The user's query is embedded using the same `text-embedding-3-small` model.
2. FAISS computes **L2 (Euclidean) distance** between the query vector and all chunk vectors.
3. The **top-3** (`TOP_K=3`) closest chunks are returned, ranked by distance score.

**Why FAISS with `IndexFlatL2`?**
- **Exact search** — `IndexFlatL2` performs brute-force search with no approximation, giving the most accurate results for small document sets.
- **Zero configuration** — No training, tuning, or index parameters required.
- **Fast for small corpora** — With only a few dozen chunks, brute-force is effectively instant.

---

## Grounding to Retrieved Context

Grounding ensures the LLM only uses information from the retrieved documents, not its own training data. This is enforced through **three mechanisms**:

### 1. Strict System Prompt

The LLM receives a system prompt that explicitly constrains its behavior:

```
You are a helpful assistant for Indecimal, a home construction company.
You MUST answer the user's question ONLY using the provided context below.
Do NOT use any external knowledge or make up information.
If the provided context does not contain enough information to answer, say:
"I don't have enough information in the provided documents to answer this question."

Always cite which source document(s) your answer comes from.
Be clear, concise, and accurate.
```

### 2. Structured Prompt with Context Injection

The user prompt is structured to clearly separate retrieved context from the question:

```
Context (retrieved from company documents):
--- Source: doc1.md (Chunk #2) ---
[chunk text]
--- Source: doc3.md (Chunk #0) ---
[chunk text]

Question: [user's question]

Answer (based strictly on the above context):
```

Each context chunk includes its source filename and chunk ID, enabling the LLM to cite its sources.

### 3. Low Temperature Generation

The LLM temperature is set to **0.3**, which:
- Reduces creative/speculative outputs
- Favors high-probability tokens that stick closely to the provided context
- Minimizes hallucination risk

---

## Running Locally

### Prerequisites

- **Python 3.11+**
- **Node.js 20+** and **npm**
- **Ollama** — [Install from ollama.ai](https://ollama.ai)
- **OpenRouter API Key** — [Get one at openrouter.ai](https://openrouter.ai)
- **Docker & Docker Compose** (optional, for containerized deployment)

---

--

### Option 1: Run Without Docker

#### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Linux/macOS
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env and set your OPENROUTER_API_KEY
# Keep LLM_PROVIDER=api if you want to use the cloud LLM, 
# or change it to LLM_PROVIDER=ollama to run locally.
```

Optionally, if you are using `LLM_PROVIDER=ollama`, make sure Ollama is installed and running:

```bash
ollama serve
ollama pull llama3
```

Start the backend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at **http://localhost:5173** and proxies API requests to the backend at **http://localhost:8000**.

---

## API Endpoints

| Method | Endpoint  | Description                        |
|--------|-----------|------------------------------------|
| `GET`  | `/health` | Health check, returns pipeline status |
| `POST` | `/chat`   | Send a query, receive a grounded answer with sources |

### `POST /chat` — Example

**Request:**

```json
{
  "query": "What services does Indecimal offer?"
}
```

**Response:**

```json
{
  "answer": "Based on the company documents, Indecimal offers...",
  "sources": [
    {
      "source": "doc1.md",
      "chunk_id": 2,
      "score": 0.342,
      "rank": 1,
      "text_preview": "Indecimal provides comprehensive home construction..."
    }
  ]
}
```

---

# mini_RAG
