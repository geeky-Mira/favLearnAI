const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const apiKeyStatusSpan = document.getElementById('api-key-status');
const modelSelect = document.getElementById('gemini-model');

// --- Supported Gemini Models ---
const SUPPORTED_MODELS = [
    "gemini-2.0-flash-001",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
];

// --- API Key Management ---
export function getAPIKey() {
    return sessionStorage.getItem('gemini_api_key');
}

export function setAPIKey(key) {
    sessionStorage.setItem('gemini_api_key', key);
    checkAPIKeyStatus();
}

// --- Model Selection Management ---
export function getSelectedModel() {
    const model = sessionStorage.getItem('gemini_model');
    return SUPPORTED_MODELS.includes(model) ? model : "gemini-2.0-flash-001";
}

export function setSelectedModel(model) {
    if (SUPPORTED_MODELS.includes(model)) {
        sessionStorage.setItem('gemini_model', model);
    } else {
        console.warn(`❗ Unsupported model "${model}". Falling back to default.`);
        sessionStorage.setItem('gemini_model', "gemini-2.0-flash-001");
    }
}

export function checkAPIKeyStatus() {
    const key = getAPIKey();
    if (apiKeyInput && apiKeyStatusSpan) {
        if (key && key.trim() !== '') {
            apiKeyStatusSpan.textContent = 'API Key Set';
            apiKeyStatusSpan.className = 'status-ok';
            apiKeyInput.value = '********';
            apiKeyInput.placeholder = '********';
        } else {
            apiKeyStatusSpan.textContent = 'API Key Not Set';
            apiKeyStatusSpan.className = 'status-not-set';
            apiKeyInput.value = '';
            apiKeyInput.placeholder = 'Enter Gemini API Key';
        }
    }

    // Show the selected model in dropdown
    if (modelSelect) {
        modelSelect.value = getSelectedModel();
    }
}

// --- Save Button Logic ---
if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            setAPIKey(key);
            alert("✅ Gemini API Key saved for this session.");
        } else {
            sessionStorage.removeItem('gemini_api_key');
            checkAPIKeyStatus();
            alert("⚠️ API Key cleared. AI features will not be available.");
        }

        if (modelSelect) {
            const selectedModel = modelSelect.value.trim();
            if (SUPPORTED_MODELS.includes(selectedModel)) {
                setSelectedModel(selectedModel);
            } else {
                alert("⚠️ Invalid model selected. Falling back to default.");
                setSelectedModel("gemini-2.0-flash-001");
                modelSelect.value = "gemini-2.0-flash-001";
            }
        }
    });
}

// --- Sanitize PDF ID ---
function sanitizePdfId(pdfId) {
    return pdfId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// --- Highlight Save/Load ---
export async function saveHighlightsToBackend(highlights) {
    let pdfId = sessionStorage.getItem('current_pdf_id');
    if (!pdfId || !Array.isArray(highlights)) return;

    pdfId = sanitizePdfId(pdfId);
    try {
        await fetch(`http://localhost:8001/save_highlights/${pdfId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ highlights }),
        });
        console.log("✅ Highlights saved to backend.");
    } catch (err) {
        console.error("❌ Failed to save highlights:", err);
    }
}

export async function loadHighlightsFromBackend(pdfId) {
    if (!pdfId) pdfId = sessionStorage.getItem('current_pdf_id');
    if (!pdfId) return [];

    pdfId = sanitizePdfId(pdfId);
    try {
        const res = await fetch(`http://localhost:8001/load_highlights/${pdfId}`);
        if (!res.ok) throw new Error("Failed to fetch highlights.");
        const data = await res.json();
        return data.highlights || [];
    } catch (err) {
        console.error("❌ Failed to load highlights from backend:", err);
        return [];
    }
}

// --- Chat Save/Load ---
export async function saveChatToBackend(chatHistory) {
    let pdfId = sessionStorage.getItem('current_pdf_id');
    if (!pdfId || !Array.isArray(chatHistory)) return;

    pdfId = sanitizePdfId(pdfId);
    try {
        await fetch(`http://localhost:8001/save_chat/${pdfId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat: chatHistory }),
        });
        console.log("💾 Chat saved to backend.");
    } catch (err) {
        console.error("❌ Failed to save chat to backend:", err);
    }
}

export async function loadChatFromBackend(pdfId) {
    if (!pdfId) pdfId = sessionStorage.getItem('current_pdf_id');
    if (!pdfId) return [];

    pdfId = sanitizePdfId(pdfId);
    try {
        const res = await fetch(`http://localhost:8001/load_chat/${pdfId}`);
        if (!res.ok) throw new Error("Failed to fetch chat.");
        const data = await res.json();
        return data.chat || [];
    } catch (err) {
        console.error("❌ Failed to load chat from backend:", err);
        return [];
    }
}

// --- Chat PDF Export ---
export function generateChatPDF(chatHistory) {
    if (typeof window.jspdf === 'undefined') {
        console.error("❌ jsPDF not found.");
        alert("PDF export not available. Include jsPDF library.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    let y = 15;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("favLearnAI PDF Assistant – AI Summary Notes", 15, y);
    y += 10;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);

    chatHistory.forEach(msg => {
        if (!msg.isUser) {
            let content = msg.text.replace(/📌|👋|💬|⚠️|Ø=Ü|Ì/g, "").trim();
            const lines = doc.splitTextToSize(content, 180);
            lines.forEach(line => {
                if (y + lineHeight > pageHeight - 15) {
                    doc.addPage();
                    y = 15;
                }
                doc.text(line, 15, y);
                y += lineHeight;
            });
            y += 5;
        }
    });

    doc.save('ai_summary_notes.pdf');
}

// --- Final Notes Export ---
export function generateNotePDF(notesText) {
    if (typeof window.jspdf === 'undefined') {
        console.error("❌ jsPDF not found.");
        alert("PDF export not available. Include jsPDF library.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    let y = 15;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("📘 favLearnAI PDF Assistant – Final Notes", 15, y);
    y += 10;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);

    const lines = doc.splitTextToSize(notesText.trim(), 180);
    lines.forEach(line => {
        if (y + lineHeight > pageHeight - 15) {
            doc.addPage();
            y = 15;
        }
        doc.text(line, 15, y);
        y += lineHeight;
    });

    doc.save('favLearnAI_pdf_notes.pdf');
}

// --- Annotated PDF Export ---
export async function exportPdfWithHighlights(originalPdfBytes, highlights) {
    if (typeof PDFLib === 'undefined') {
        alert("❌ PDF-Lib not loaded. Please include pdf-lib.min.js in index.html.");
        return;
    }

    const scaleFactor = 1.5;
    const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();

    highlights.forEach(h => {
        const page = pages[h.pageNum - 1];
        h.rects.forEach(rect => {
            const scaledX = rect.left / scaleFactor;
            const scaledY = (rect.top + rect.height) / scaleFactor;
            const scaledWidth = rect.width / scaleFactor;
            const scaledHeight = rect.height / scaleFactor;

            page.drawRectangle({
                x: scaledX,
                y: page.getHeight() - scaledY,
                width: scaledWidth,
                height: scaledHeight,
                color: PDFLib.rgb(1, 1, 0),
                opacity: 0.4,
            });
        });
    });

    const modifiedBytes = await pdfDoc.save();
    const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const filename = sanitizePdfId(sessionStorage.getItem('current_pdf_id') || 'highlighted') + '_annotated.pdf';
    a.download = filename;
    a.click();
}
