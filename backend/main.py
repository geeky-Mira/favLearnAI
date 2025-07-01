from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import json
import logging
from dotenv import load_dotenv
import re

# --- Load .env ---
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- RAG Pipeline Import ---
from rag_pipeline import (
    initialize_gemini,
    process_pdf_text_for_rag,
    query_gemini_with_rag,
    generate_structured_notes
)

# --- FastAPI App Init ---
app = FastAPI()

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Use restricted origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class ProcessPdfRequest(BaseModel):
    full_pdf_text: str

class ChatMessage(BaseModel):
    role: str
    parts: List[Dict[str, str]]

class ChatQuery(BaseModel):
    prompt: str
    history: Optional[List[ChatMessage]] = []
    api_key: Optional[str] = None
    model: Optional[str] = None

class ChatStorageRequest(BaseModel):
    chat: List[ChatMessage]

class HighlightStorageRequest(BaseModel):
    highlights: List[Dict]

class NotesRequest(BaseModel):
    chat: List[ChatMessage]
    api_key: Optional[str] = None
    model: Optional[str] = None

# --- PDF ID Validation ---
def is_valid_pdf_id(pdf_id: str) -> bool:
    return re.match(r'^[a-zA-Z0-9_\-]+$', pdf_id) is not None

# --- Startup Hook ---
@app.on_event("startup")
async def startup_event():
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        logger.warning("⚠️ GEMINI_API_KEY not set in environment.")
    else:
        initialize_gemini(gemini_api_key)
        logger.info("✅ Gemini API initialized for default usage.")

# --- Health Check ---
@app.get("/")
async def root():
    return {"message": "✅ favLearnAI PDF Assistant backend is running!"}

# --- PDF RAG Processing ---
@app.post("/process-pdf-for-rag")
async def process_pdf_endpoint(request_data: ProcessPdfRequest):
    try:
        if not request_data.full_pdf_text.strip():
            raise HTTPException(status_code=400, detail="Empty PDF text provided.")
        logger.info(f"📄 Processing PDF text ({len(request_data.full_pdf_text)} chars)...")
        await process_pdf_text_for_rag(request_data.full_pdf_text)
        return {"message": "✅ PDF processed and stored in vector database."}
    except Exception as e:
        logger.exception("❌ PDF processing failed.")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

# --- Chat with RAG ---
@app.post("/chat-with-rag")
async def chat_with_rag_endpoint(query: ChatQuery):
    try:
        api_key = query.api_key or os.getenv("GEMINI_API_KEY")
        model = query.model or os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")

        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured.")

        logger.info(f"🤖 Chat prompt received. Prompt: {query.prompt[:80]}...")
        dict_history = [msg.dict() for msg in query.history or []]

        response_text = await query_gemini_with_rag(
            user_prompt=query.prompt,
            chat_history=dict_history,
            api_key=api_key,
            model=model
        )
        return {"response": response_text}
    except Exception as e:
        logger.exception("❌ Chat processing failed.")
        raise HTTPException(status_code=500, detail=f"AI response error: {str(e)}")

# --- Save Chat ---
@app.post("/save_chat/{pdf_id}")
async def save_chat(pdf_id: str, request: ChatStorageRequest):
    if not is_valid_pdf_id(pdf_id):
        raise HTTPException(status_code=400, detail="Invalid PDF ID format.")
    try:
        os.makedirs("data/chats", exist_ok=True)
        path = f"data/chats/{pdf_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump([msg.dict() for msg in request.chat], f, indent=2)
        logger.info(f"💾 Chat saved for PDF ID: {pdf_id}")
        return {"message": "✅ Chat history saved."}
    except Exception as e:
        logger.exception("❌ Failed to save chat.")
        raise HTTPException(status_code=500, detail="Failed to save chat.")

# --- Load Chat ---
@app.get("/load_chat/{pdf_id}")
async def load_chat(pdf_id: str):
    if not is_valid_pdf_id(pdf_id):
        raise HTTPException(status_code=400, detail="Invalid PDF ID format.")
    path = f"data/chats/{pdf_id}.json"
    try:
        if not os.path.exists(path):
            return {"chat": []}
        with open(path, "r", encoding="utf-8") as f:
            chat_data = json.load(f)
        logger.info(f"📂 Chat loaded for PDF ID: {pdf_id}")
        return {"chat": chat_data}
    except Exception as e:
        logger.exception("❌ Failed to load chat.")
        raise HTTPException(status_code=500, detail="Failed to load chat.")

# --- Save Highlights ---
@app.post("/save_highlights/{pdf_id}")
async def save_highlights(pdf_id: str, request: HighlightStorageRequest):
    if not is_valid_pdf_id(pdf_id):
        raise HTTPException(status_code=400, detail="Invalid PDF ID format.")
    try:
        os.makedirs("data/highlights", exist_ok=True)
        path = f"data/highlights/{pdf_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(request.highlights, f, indent=2)
        logger.info(f"🖍️ Highlights saved for PDF ID: {pdf_id}")
        return {"message": "✅ Highlights saved."}
    except Exception as e:
        logger.exception("❌ Failed to save highlights.")
        raise HTTPException(status_code=500, detail="Failed to save highlights.")

# --- Load Highlights ---
@app.get("/load_highlights/{pdf_id}")
async def load_highlights(pdf_id: str):
    if not is_valid_pdf_id(pdf_id):
        raise HTTPException(status_code=400, detail="Invalid PDF ID format.")
    path = f"data/highlights/{pdf_id}.json"
    try:
        if not os.path.exists(path):
            return {"highlights": []}
        with open(path, "r", encoding="utf-8") as f:
            highlights = json.load(f)
        logger.info(f"📂 Highlights loaded for PDF ID: {pdf_id}")
        return {"highlights": highlights}
    except Exception as e:
        logger.exception("❌ Failed to load highlights.")
        raise HTTPException(status_code=500, detail="Failed to load highlights.")

# --- Generate Structured Notes ---
@app.post("/generate_notes")
async def generate_notes(request: NotesRequest):
    try:
        api_key = request.api_key or os.getenv("GEMINI_API_KEY")
        model = request.model or os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")

        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured.")

        notes = await generate_structured_notes([msg.dict() for msg in request.chat], api_key, model)
        return {"notes": notes}
    except Exception as e:
        logger.exception("❌ Failed to generate structured notes.")
        raise HTTPException(status_code=500, detail="Failed to generate notes.")
