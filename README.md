## 🎮 What is favLearnAI?

favLearnAI is an AI-powered learning companion that helps you understand PDFs more deeply and interactively.  
Upload a document, highlight text, and ask questions — the system generates explanations, summaries, concept breakdowns, and structured notes.

It uses:

- **SentenceTransformer (MiniLM)** for embeddings  
- **Google Gemini models** for reasoning and answer generation  
- **FAISS** for fast vector search  
- **FastAPI** for a clean backend API

---

## 📖 Features

- 🔍 Select text and get contextual explanations  
- 🤖 Chat with any part of your PDF  
- 🧠 Accurate retrieval via SentenceTransformer embeddings  
- 🎨 Visual-style breakdowns for complex concepts  
- 📅 Highlighting + automatic note persistence  
- 📤 Export summaries for offline use

---

## 💡 How to Use

1. Open the Frontend  
   👉 **https://favlearnai-123.onrender.com**

2. Upload any PDF (textbooks, reports, research papers)

3. Enter your **Gemini API Key** and choose a model  
   - e.g., `gemini-2.0-flash-001`, `gemini-2.5-pro`

4. Highlight text inside the PDF viewer  
   - AI instantly explains or clarifies the selected content

5. Or simply **ask questions** to chat with the uploaded PDF

6. Export your AI-generated notes or summary

---

## 📁 Data Storage

- Chats and highlights are stored per-document
- No long-term storage — everything resets unless the user manually exports notes

---

## 🌟 Tech Stack

**Frontend:**  
- HTML  
- JavaScript  
- PDF.js  
- jsPDF  
- Gemini API

**Backend:**  
- FastAPI  
- FAISS Vector Store  
- SentenceTransformer Embeddings (`all-MiniLM-L6-v2`)  
- Google Gemini (via LangChain for LLM queries)  
- Dockerized deployment on Render

---

## 🚀 Live URLs

- **Frontend:** https://favlearnai-123.onrender.com  
- **Backend:** https://favlearnai-backend-fg6q.onrender.com

---

## 🛠 Backend Deployment Notes

The backend runs in a **Docker container** on Render:

- Embeddings are generated using **SentenceTransformer** inside the container  
- LLM queries (answering, intent detection, polishing) are handled via **Gemini API**  
- Large PDFs are supported via controlled chunking and embedding throttling  
- FAISS runs fully in-memory for speed

The updated backend stack ensures stable performance even for large PDFs (30–80 chunks).

---

## ❤️ Contribution

Have suggestions or ideas? Open a PR or issue — the project is active and evolving!

## 🎮 What is favLearnAI?

favLearnAI is an AI-powered learning companion that helps you understand PDFs more deeply and interactively.  
Upload a document, highlight text, and ask questions — the system generates explanations, summaries, concept breakdowns, and structured notes.

It uses:

- **SentenceTransformer (MiniLM)** for embeddings  
- **Google Gemini models** for reasoning and answer generation  
- **FAISS** for fast vector search  
- **FastAPI** for a clean backend API

---

## 📖 Features

- 🔍 Select text and get contextual explanations  
- 🤖 Chat with any part of your PDF  
- 🧠 Accurate retrieval via SentenceTransformer embeddings  
- 🎨 Visual-style breakdowns for complex concepts  
- 📅 Highlighting + automatic note persistence  
- 📤 Export summaries for offline use

---

## 💡 How to Use

1. Open the Frontend  
   👉 **https://favlearnai-123.onrender.com**

2. Upload any PDF (textbooks, reports, research papers)

3. Enter your **Gemini API Key** and choose a model  
   - e.g., `gemini-2.0-flash-001`, `gemini-2.5-pro`

4. Highlight text inside the PDF viewer  
   - AI instantly explains or clarifies the selected content

5. Or simply **ask questions** to chat with the uploaded PDF

6. Export your AI-generated notes or summary

---

## 📁 Data Storage

- Chats and highlights are stored per-document
- No long-term storage — everything resets unless the user manually exports notes

---

## 🌟 Tech Stack

**Frontend:**  
- HTML  
- JavaScript  
- PDF.js  
- jsPDF  
- Gemini API

**Backend:**  
- FastAPI  
- FAISS Vector Store  
- SentenceTransformer Embeddings (`all-MiniLM-L6-v2`)  
- Google Gemini (via LangChain for LLM queries)  
- Dockerized deployment on Render

---

## 🚀 Live URLs

- **Frontend:** https://favlearnai-123.onrender.com  
- **Backend:** https://favlearnai-backend-d.onrender.com

---

## 🛠 Backend Deployment Notes

The backend runs in a **Docker container** on Render:

- Embeddings are generated using **SentenceTransformer** inside the container  
- LLM queries (answering, intent detection, polishing) are handled via **Gemini API**  
- Large PDFs are supported via controlled chunking and embedding throttling  
- FAISS runs fully in-memory for speed

The updated backend stack ensures stable performance even for large PDFs (30–80 chunks).

---

## ❤️ Contribution

Have suggestions or ideas? Open a PR or issue — the project is active and evolving!

