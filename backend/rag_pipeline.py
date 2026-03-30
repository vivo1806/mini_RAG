

import os
import sys
import json
import logging
import numpy as np
import faiss
import requests
from openai import OpenAI
from dotenv import load_dotenv

logger = logging.getLogger(__name__)



load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Choose between "ollama" or "api"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()

# Ollama configuration
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# API configuration
API_LLM_MODEL = os.getenv("API_LLM_MODEL", "meta-llama/llama-3-8b-instruct")
EMBEDDING_MODEL = "openai/text-embedding-3-small"


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCUMENT_PATHS = [
    os.path.join(SCRIPT_DIR, "doc1.md"),
    os.path.join(SCRIPT_DIR, "doc2.md"),
    os.path.join(SCRIPT_DIR, "doc3.md"),
]


CHUNK_SIZE = 500       # characters per chunk
CHUNK_OVERLAP = 50     # overlap between consecutive chunks
TOP_K = 3              # number of chunks to retrieve




def load_documents(paths: list[str]) -> list[dict]:
    
    documents = []
    for path in paths:
        if not os.path.exists(path):
            logger.warning(f"File not found — {path}")
            continue
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        filename = os.path.basename(path)
        documents.append({"filename": filename, "content": content})
        logger.info(f"Loaded {filename} ({len(content)} chars)")
    return documents



def chunk_document(doc: dict, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    
    text = doc["content"]
    filename = doc["filename"]
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks = []
    current_chunk = ""
    chunk_id = 0

    for para in paragraphs:
        if current_chunk and len(current_chunk) + len(para) + 2 > chunk_size:
            chunks.append({
                "text": current_chunk.strip(),
                "source": filename,
                "chunk_id": chunk_id,
            })
            chunk_id += 1
            if overlap > 0 and len(current_chunk) > overlap:
                current_chunk = current_chunk[-overlap:] + "\n\n" + para
            else:
                current_chunk = para
        else:
            current_chunk = current_chunk + "\n\n" + para if current_chunk else para

    if current_chunk.strip():
        chunks.append({
            "text": current_chunk.strip(),
            "source": filename,
            "chunk_id": chunk_id,
        })

    return chunks


def chunk_all_documents(documents: list[dict]) -> list[dict]:
    """Chunk all loaded documents and return a flat list of chunks."""
    all_chunks = []
    for doc in documents:
        doc_chunks = chunk_document(doc)
        all_chunks.extend(doc_chunks)
        logger.info(f"Chunked {doc['filename']} → {len(doc_chunks)} chunks")
    return all_chunks




def get_openrouter_client() -> OpenAI:
    """Create an OpenAI-compatible client pointed at OpenRouter."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set. Add it to your .env file.")

    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )


def generate_embeddings(texts: list[str], client: OpenAI) -> np.ndarray:
    """Generate embeddings for a list of texts using OpenRouter's embeddings API."""
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    embeddings = [item.embedding for item in response.data]
    return np.array(embeddings, dtype="float32")




def build_faiss_index(chunks: list[dict], client: OpenAI) -> tuple[faiss.IndexFlatL2, np.ndarray]:
    """Build a FAISS flat L2 index over the document chunk embeddings."""
    texts = [chunk["text"] for chunk in chunks]

    logger.info(f"Generating embeddings for {len(texts)} chunks via OpenRouter...")
    embeddings = generate_embeddings(texts, client)
    logger.info(f"Embeddings generated — shape: {embeddings.shape}")

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)
    logger.info(f"FAISS index built — {index.ntotal} vectors indexed (dim={dimension})")

    return index, embeddings




def retrieve_relevant_chunks(
    query: str,
    index: faiss.IndexFlatL2,
    chunks: list[dict],
    client: OpenAI,
    top_k: int = TOP_K,
) -> list[dict]:
    """Retrieve the top-k most relevant document chunks for a given query."""
    query_embedding = generate_embeddings([query], client)
    distances, indices = index.search(query_embedding, top_k)

    results = []
    for rank, (dist, idx) in enumerate(zip(distances[0], indices[0])):
        if idx < 0:
            continue
        chunk = chunks[idx].copy()
        chunk["score"] = float(dist)
        chunk["rank"] = rank + 1
        results.append(chunk)

    return results




def generate_answer(query: str, retrieved_chunks: list[dict], client: OpenAI = None) -> str:
    """Generate an answer using a local Ollama LLM or API, grounded in retrieved context."""
    context_block = ""
    for chunk in retrieved_chunks:
        context_block += f"\n--- Source: {chunk['source']} (Chunk #{chunk['chunk_id']}) ---\n"
        context_block += chunk["text"] + "\n"

    system_prompt = """You are a helpful assistant for Indecimal, a home construction company.
You MUST answer the user's question ONLY using the provided context below.
Do NOT use any external knowledge or make up information.
If the provided context does not contain enough information to answer, say:
"I don't have enough information in the provided documents to answer this question."

Always cite which source document(s) your answer comes from.
Be clear, concise, and accurate."""

    user_prompt = f"""Context (retrieved from company documents):
{context_block}

Question: {query}

Answer (based strictly on the above context):"""

    if LLM_PROVIDER == "api":
        if not client:
            client = get_openrouter_client()
        try:
            api_response = client.chat.completions.create(
                model=API_LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=512,
            )
            return api_response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"Error calling LLM API: {e}")

    else:
        url = f"{OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": user_prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 512,
            },
        }

        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            result = response.json()
            return result.get("response", "Error: No response generated.")
        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                f"Could not connect to Ollama at {OLLAMA_BASE_URL}. "
                f"Make sure Ollama is running: `ollama serve`"
            )
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Error calling Ollama: {e}")




class RAGPipeline:
    

    def __init__(self):
        self.client = None
        self.index = None
        self.chunks = None
        self.is_ready = False

    def initialize(self):
        
        logger.info("Initializing RAG pipeline...")

        documents = load_documents(DOCUMENT_PATHS)
        if not documents:
            raise RuntimeError("No documents loaded. Ensure doc1.md, doc2.md, doc3.md exist.")

        logger.info(f"{len(documents)} documents loaded.")

        self.chunks = chunk_all_documents(documents)
        logger.info(f"{len(self.chunks)} total chunks created.")

        self.client = get_openrouter_client()
        self.index, _ = build_faiss_index(self.chunks, self.client)

        self.is_ready = True
        logger.info("RAG pipeline initialized and ready.")

    def get_response(self, query: str) -> dict:
        
        if not self.is_ready:
            raise RuntimeError("Pipeline not initialized. Call initialize() first.")

        logger.info(f"Processing query: {query[:100]}...")

        # Retrieve relevant chunks
        retrieved = retrieve_relevant_chunks(
            query, self.index, self.chunks, self.client, top_k=TOP_K
        )

        # Generate answer
        answer = generate_answer(query, retrieved, client=self.client)

        # Build source info
        sources = [
            {
                "source": chunk["source"],
                "chunk_id": chunk["chunk_id"],
                "score": chunk["score"],
                "rank": chunk["rank"],
                "text_preview": chunk["text"][:150] + "..." if len(chunk["text"]) > 150 else chunk["text"],
            }
            for chunk in retrieved
        ]

        return {"answer": answer, "sources": sources}
