"""
Mini-RAG Chatbot — FastAPI Backend
===================================
Exposes the RAG pipeline as a REST API with a /chat endpoint.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from rag_pipeline import RAGPipeline

# ──────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Pipeline singleton
# ──────────────────────────────────────────────

pipeline = RAGPipeline()


# ──────────────────────────────────────────────
# App lifespan (startup / shutdown)
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the RAG pipeline on startup."""
    logger.info("Starting up — initializing RAG pipeline...")
    try:
        pipeline.initialize()
        logger.info("RAG pipeline ready.")
    except Exception as e:
        logger.error(f"Failed to initialize pipeline: {e}")
        raise
    yield
    logger.info("Shutting down.")


# ──────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────

app = FastAPI(
    title="Mini-RAG Chatbot API",
    description="Retrieval-Augmented Generation chatbot for Indecimal",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Request / Response models
# ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User question")


class SourceInfo(BaseModel):
    source: str
    chunk_id: int
    score: float
    rank: int
    text_preview: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "pipeline_ready": pipeline.is_ready,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat query through the RAG pipeline.
    Returns a grounded answer with source citations.
    """
    if not pipeline.is_ready:
        raise HTTPException(
            status_code=503,
            detail="RAG pipeline is not initialized yet. Please try again shortly.",
        )

    logger.info(f"Received query: {request.query[:100]}...")

    try:
        result = pipeline.get_response(request.query)
        logger.info("Response generated successfully.")
        return result
    except ConnectionError as e:
        logger.error(f"Ollama connection error: {e}")
        raise HTTPException(
            status_code=502,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error processing query: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing your query: {str(e)}",
        )
