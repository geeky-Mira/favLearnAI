// --- Backend base URL ---
const BACKEND_URL = 'http://localhost:8001';
let pdfProcessed = false;

// --- Supported Gemini Models ---
const SUPPORTED_MODELS = [
    "gemini-2.0-flash-001",
    "gemini-2.5-pro",
    "gemini-2.5-flash"
];

/**
 * Sends the full extracted PDF text to the backend for RAG processing.
 * Called once after PDF is loaded and its full text is extracted.
 * @param {string} fullPdfText - Entire text of the loaded PDF.
 */
export async function processPdfForRAG(fullPdfText) {
    if (!fullPdfText || fullPdfText.trim().length === 0) {
        alert("❌ Cannot process empty PDF content.");
        return;
    }

    console.log("📤 Sending PDF text to backend for RAG processing...");
    pdfProcessed = false;

    try {
        const response = await fetch(`${BACKEND_URL}/process-pdf-for-rag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_pdf_text: fullPdfText }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Backend PDF processing failed: ${errorData.detail || response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ Backend PDF processing complete:", data.message);
        alert("✅ PDF processed by AI for smart querying!");
        pdfProcessed = true;
    } catch (error) {
        console.error("❌ Error sending PDF to backend for RAG:", error);
        alert(`Failed to process PDF for AI. Error: ${error.message}`);
        pdfProcessed = false;
    }
}

/**
 * Sends the user prompt and chat history to the backend for RAG-based Gemini response.
 * Supports custom model and API key.
 *
 * @param {string} prompt - Current user query or selected text.
 * @param {Array<Object>} chatHistory - Previous messages: { role: "user"|"model", parts: [{ text }] }
 * @param {string} apiKey - Gemini API key
 * @param {string} model - Selected Gemini model
 * @returns {Promise<string>} - AI's reply text.
 */
export async function chatWithRAG(prompt, chatHistory, apiKey, model) {
    if (!pdfProcessed) {
        alert("❌ Please wait for the PDF to finish processing before chatting.");
        return "PDF not processed yet.";
    }

    if (!prompt || prompt.trim().length === 0) {
        alert("❌ Prompt is empty. Please enter or select some text.");
        return "Prompt was empty. Nothing sent to AI.";
    }

    if (!Array.isArray(chatHistory)) {
        console.warn("⚠️ Invalid chat history format. Resetting to empty.");
        chatHistory = [];
    }

    // 🛡️ Clean and validate chat history
    const safeHistory = chatHistory.map(msg => ({
        role: msg.role === "user" || msg.role === "model" ? msg.role : "user",
        parts: Array.isArray(msg.parts)
            ? msg.parts.map(part => ({ text: part.text || "" }))
            : [],
    }));

    // ✅ Default fallback for model
    const usedModel = SUPPORTED_MODELS.includes(model) ? model : "gemini-2.0-flash-001";

    console.log(`🧠 Sending chat prompt using model: ${usedModel}...`);

    try {
        const response = await fetch(`${BACKEND_URL}/chat-with-rag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                history: safeHistory,
                api_key: apiKey,
                model: usedModel
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`❌ Chat backend failed: ${errorData.detail || response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ AI Response from backend:", data.response);
        return data.response;
    } catch (error) {
        console.error("❌ Error during chatWithRAG:", error);
        alert("⚠️ AI could not respond. Check your backend logs or network.");
        return "Sorry, I couldn't fetch a response. Please try again.";
    }
}

/**
 * Loads highlights from backend for a given PDF ID.
 * @param {string} pdfId
 * @returns {Promise<Array>}
 */
export async function loadHighlightsFromBackend(pdfId) {
    try {
        const response = await fetch(`${BACKEND_URL}/load_highlights/${pdfId}`);
        if (!response.ok) {
            throw new Error("Failed to load highlights.");
        }
        const data = await response.json();
        return data.highlights;
    } catch (error) {
        console.error("❌ Error loading highlights:", error);
        return [];
    }
}

/**
 * Saves highlights to the backend for a given PDF ID.
 * @param {string} pdfId
 * @param {Array} highlights
 * @returns {Promise<void>}
 */
export async function saveHighlightsToBackend(pdfId, highlights) {
    try {
        await fetch(`${BACKEND_URL}/save_highlights/${pdfId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ highlights }),
        });
        console.log("✅ Highlights saved to backend.");
    } catch (error) {
        console.error("❌ Failed to save highlights:", error);
    }
}
