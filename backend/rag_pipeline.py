import os
import logging
from typing import List, Dict, Any, Union

from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain.chains.history_aware_retriever import create_history_aware_retriever
from langchain_core.prompts import ChatPromptTemplate

# --- Env & Logging ---
load_dotenv()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# --- Global FAISS store only (not LLM or chain) ---
vector_store = None

# --- Gemini API Key Init (sets default for non-user contexts) ---
def initialize_gemini(api_key: str):
    os.environ["GOOGLE_API_KEY"] = api_key
    logger.info("🔐 Gemini API initialized via LangChain.")

# --- PDF → Chunks → Embeddings → FAISS ---
async def process_pdf_text_for_rag(full_pdf_text: str, max_chunks: int = 150):
    global vector_store

    if not full_pdf_text.strip():
        logger.warning("⚠️ Received empty PDF text.")
        return

    logger.info("📄 Chunking PDF content...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", "!", "?", " "],
    )

    chunks = splitter.split_text(full_pdf_text)
    logger.info(f"✅ Total chunks created: {len(chunks)}")

    if max_chunks:
        chunks = chunks[:max_chunks]

    documents = [Document(page_content=chunk) for chunk in chunks]

    logger.info("📌 Generating Gemini embeddings...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    vector_store = FAISS.from_documents(documents, embedding=embeddings)
    logger.info("🧠 FAISS vector store built with embeddings.")

# --- RAG Chain Builder ---
def build_rag_chain(api_key: str, model: str):
    global vector_store
    if vector_store is None:
        raise ValueError("Vector store not initialized. PDF must be processed first.")

    os.environ["GOOGLE_API_KEY"] = api_key
    llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.1)

    contextualize_q_prompt = ChatPromptTemplate.from_messages([
        ("system", "Given chat history and a follow-up question, rewrite it as a standalone question."),
        ("human", "{chat_history}\n\nFollow-up: {input}\nStandalone:")
    ])

    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", "You're a helpful assistant. Use the retrieved documents to answer the question clearly."),
        ("human", "{context}\n\nQuestion: {input}")
    ])

    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 4})

    history_aware = create_history_aware_retriever(
        llm=llm,
        retriever=retriever,
        prompt=contextualize_q_prompt,
    )

    combine_docs_chain = create_stuff_documents_chain(llm, qa_prompt)

    return create_retrieval_chain(history_aware, combine_docs_chain)

# --- Chat with Gemini ---
async def query_gemini_with_rag(
    user_prompt: str,
    chat_history: List[Dict[str, Any]],
    api_key: str,
    model: str = "gemini-2.0-flash-001"
) -> str:
    logger.info(f"📨 Received user query: {user_prompt[:80]}...")

    try:
        rag_chain = build_rag_chain(api_key, model)
    except Exception as e:
        logger.exception("❌ Failed to build RAG chain.")
        return "⚠️ Error setting up the AI retrieval chain."

    formatted_history = []
    for msg in chat_history[-6:]:
        role = msg.get("role", "user")
        parts = msg.get("parts", [])
        text = "\n".join(part.get("text", "") for part in parts)
        formatted_history.append(("human" if role == "user" else "ai", text))

    enhanced_prompt = (
        "You're an expert educator and developer assistant who can make a dumb student into a smart one.\n"
        "You can explain anything even if you have little knowledge.\n\n"
        "Instructions:\n"
        "- Provide detailed breakdown of concepts\n"
        "- If needed then add definitions, use-cases, analogies\n"
        "- If code: explain it line-by-line\n"
        "- Avoid fluff, focus on clarity and precision\n\n"
        f"Input:\n{user_prompt}"
    )

    try:
        result = await rag_chain.ainvoke({
            "input": enhanced_prompt,
            "chat_history": formatted_history
        })
        logger.info("✅ Gemini RAG chain returned a response.")
        return result["answer"].strip() if isinstance(result, dict) else str(result).strip()
    except Exception as e:
        logger.exception("❌ Error invoking Gemini RAG chain:")
        return "⚠️ An error occurred while generating the AI response."

# --- Generate Notes from AI Responses ---
async def generate_structured_notes(
    chat_history: List[Union[Dict[str, Any], Any]],
    api_key: str,
    model: str = "gemini-2.0-flash-001"
) -> str:
    logger.info("📝 Generating structured notes from chat...")

    if not chat_history:
        return "⚠️ No chat history found to summarize."

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
        return "⚠️ No valid AI content to summarize."

    system_prompt = (
        "You are a helpful assistant that writes notes like a student. Based on the content below, "
        "generate structured, numbered study notes. Start with a heading like '## What I learned today'. "
        "Use clear markdown formatting, titles, and subpoints. Don't repeat. Be precise."
    )

    try:
        os.environ["GOOGLE_API_KEY"] = api_key
        llm = ChatGoogleGenerativeAI(model=f"models/{model}", temperature=0.3)
        response = await llm.ainvoke(system_prompt + "\n\n" + combined)
        logger.info("🧠 AI notes generated.")
        return response.content.strip()
    except Exception as e:
        logger.exception("❌ Failed to generate notes:")
        return "⚠️ Failed to generate structured notes."
