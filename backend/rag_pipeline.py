import os
import logging
import warnings
from typing import List, Dict, Any, Optional

# Suppress noisy FAISS/multiprocessing warnings
warnings.filterwarnings(
    "ignore",
    message=r".*resource_tracker: There appear to be .* leaked semaphore objects.*"
)

from dotenv import load_dotenv

# ---------------------------
# LangChain / RAG Imports
# ---------------------------
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.embeddings import SentenceTransformerEmbeddings

# ---------------------------
# Logging Setup
# ---------------------------
load_dotenv()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ---------------------------
# Global FAISS store
# ---------------------------
vector_store: Optional[FAISS] = None

# ---------------------------
# Gemini / AI Initialization
# ---------------------------
def initialize_gemini(api_key: str):
    """Set GOOGLE_API_KEY env var for LangChain."""
    os.environ["GOOGLE_API_KEY"] = api_key
    logger.info("🔐 Gemini API initialized via LangChain.")

# ---------------------------
# PDF -> Chunks -> Embeddings -> FAISS (batch-safe)
# ---------------------------
async def process_pdf_text_for_rag(full_pdf_text: str, max_chunks: int = 100, batch_size: int = 8):
    """
    Process a PDF text into FAISS embeddings safely for Docker/Render.

    - max_chunks: limit total chunks to prevent OOM
    - batch_size: number of chunks embedded at a time
    """
    global vector_store
    logger.info("🚀 Starting PDF processing...")

    if not full_pdf_text or not full_pdf_text.strip():
        logger.warning("⚠️ Empty PDF text received.")
        return

    # Split text into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", "!", "?", " "]
    )
    chunks = splitter.split_text(full_pdf_text)
    logger.info(f"✅ Total chunks created: {len(chunks)}")

    if max_chunks and len(chunks) > max_chunks:
        chunks = chunks[:max_chunks]
        logger.info(f"✂️ Truncated to max_chunks={max_chunks}")

    documents = [Document(page_content=c) for c in chunks]
    texts = [d.page_content for d in documents]

    # Initialize embedder on CPU
    hf_token = os.getenv("HF_API_TOKEN") or None
    embedder = SentenceTransformerEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu", "token": hf_token},
        encode_kwargs={"normalize_embeddings": True},
    )

    # Batch embedding to reduce memory footprint
    embeddings = []
    logger.info(f"⚙️ Generating embeddings in batches of {batch_size}...")
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        try:
            batch_embeds = embedder.embed_documents(batch_texts)
            embeddings.extend(batch_embeds)
            logger.info(f"🟢 Embedded batch {i//batch_size + 1} ({len(batch_texts)} chunks)")
        except Exception:
            logger.exception(f"⚠️ Embedding failed for batch {i//batch_size + 1}, skipping")

    # Build FAISS vector store
    logger.info("🧠 Building FAISS vector index...")
    vector_store = FAISS.from_embeddings(
        text_embeddings=list(zip(texts, embeddings)),
        embedding=embedder,
    )
    logger.info("✅ FAISS store ready. PDF processing complete!")

# ---------------------------
# Intent Classifier
# ---------------------------
async def classify_intent(user_prompt: str, api_key: str, model: str) -> str:
    os.environ["GOOGLE_API_KEY"] = api_key
    llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.0)

    classification_prompt = (
        "Classify the User Query into GREETING, SIMPLE_FACT, or COMPLEX_TOPIC.\n\n"
        "1. GREETING: Short conversational inputs (Hi, Hello, Bye, Thanks).\n"
        "2. SIMPLE_FACT: Direct metadata or factual lookups (author, title, date).\n"
        "3. COMPLEX_TOPIC: Explanations, definitions, summaries, or technical terms.\n\n"
        f"User Query: {user_prompt}\n\n"
        "Reply ONLY with GREETING, SIMPLE_FACT, or COMPLEX_TOPIC."
    )

    try:
        resp = await llm.ainvoke(classification_prompt)
        intent = resp.content.strip().upper()
        if "GREETING" in intent:
            return "GREETING"
        if "SIMPLE_FACT" in intent:
            return "SIMPLE_FACT"
        return "COMPLEX_TOPIC"
    except Exception:
        logger.exception("⚠️ Intent classification failed, defaulting to COMPLEX_TOPIC.")
        return "COMPLEX_TOPIC"

# ---------------------------
# Relevance Checker
# ---------------------------
async def is_query_relevant(user_prompt: str, top_docs: List[str], api_key: str, model: str) -> bool:
    os.environ["GOOGLE_API_KEY"] = api_key
    llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.0)
    context = "\n".join(top_docs[:3])

    relevance_prompt = (
        f"Determine if the user's query is related to the following content:\n\n{context}\n\n"
        f"User query: {user_prompt}\n\nAnswer YES or NO."
    )

    try:
        res = await llm.ainvoke(relevance_prompt)
        return "YES" in res.content.upper()
    except Exception:
        logger.exception("⚠️ Relevance check failed. Defaulting to True")
        return True

# ---------------------------
# Editor Agent
# ---------------------------
async def polish_answer(answer_text: str, api_key: str, model: str) -> str:
    os.environ["GOOGLE_API_KEY"] = api_key
    llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.2)

    editor_prompt = (
        "You are an expert tutor. Improve clarity, structure, and add short examples if helpful. "
        "Keep factual content intact.\n\n"
        f"Original answer:\n{answer_text}"
    )

    try:
        res = await llm.ainvoke(editor_prompt)
        return res.content.strip()
    except Exception:
        logger.exception("⚠️ Polish agent failed — returning original answer")
        return answer_text

# ---------------------------
# Main RAG Query
# ---------------------------
async def query_gemini_with_rag(
    user_prompt: str,
    chat_history: List[Dict[str, Any]],
    api_key: str,
    model: str
):
    logger.info(f"📨 User query received: {user_prompt[:80]}...")

    if vector_store is None:
        return "⚠️ No PDF loaded. Please upload a document first."

    intent = await classify_intent(user_prompt, api_key, model)
    logger.info(f"🧭 Intent: {intent}")

    if intent == "GREETING":
        llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.6)
        try:
            res = await llm.ainvoke(f"The user said: '{user_prompt}'. Reply briefly and politely.")
            return res.content.strip()
        except Exception:
            return "👋 Hello! I'm here to help you with your document."

    formatted_history = [
        (msg.get("role", "user"), "\n".join(p.get("text", "") for p in msg.get("parts", [])))
        for msg in chat_history[-6:]
    ]

    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 4})
    top_docs_objs = await retriever.ainvoke(user_prompt)
    top_texts = [getattr(d, "page_content", "") for d in top_docs_objs]

    relevant = await is_query_relevant(user_prompt, top_texts, api_key, model)
    if not relevant:
        return "🤖 Your query seems unrelated to the uploaded document."

    context = "\n\n---\n\n".join(top_texts)
    system_instructions = (
        "You are a helpful document assistant. Use ONLY the provided context to answer. "
        "If the answer is not in the context, say you don't know. Return concise, correct answers."
    )
    user_prompt_full = (
        f"{system_instructions}\n\nCONTEXT:\n{context}\n\nQUESTION:\n{user_prompt}\n\n"
        "Answer concisely and, if possible, list which context passages (by number) you used."
    )

    llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.1)
    try:
        resp = await llm.ainvoke(user_prompt_full)
        answer_text = resp.content.strip()
    except Exception:
        logger.exception("⚠️ RAG LLM invocation failed.")
        answer_text = "⚠️ Error generating answer from LLM."

    if intent == "COMPLEX_TOPIC":
        answer_text = await polish_answer(answer_text, api_key, model)

    return answer_text

# ---------------------------
# Structured Notes Generator
# ---------------------------
async def generate_structured_notes(chat_history, api_key: str, model: str):
    logger.info("📝 Generating structured notes...")
    ai_texts = []
    for msg in chat_history:
        role = msg.get("role", "")
        parts = msg.get("parts", [])
        if role == "model":
            for part in parts:
                text = part.get("text", "").strip()
                if text:
                    ai_texts.append(text)

    combined = "\n\n".join(ai_texts).strip()
    if not combined:
        return "⚠️ No valid content to summarize."

    os.environ["GOOGLE_API_KEY"] = api_key
    llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.3)

    notes_prompt = (
        "Generate structured, numbered study notes based on the AI's previous responses. "
        "Start with '## What I learned today', use clear Markdown formatting, "
        "include definitions, examples, subpoints, and avoid repetition. "
        f"Content:\n{combined}"
    )

    try:
        response = await llm.ainvoke(notes_prompt)
        logger.info("✅ Notes generated.")
        return response.content.strip()
    except Exception:
        logger.exception("⚠️ Notes generation failed.")
        return "⚠️ Failed to generate notes."
