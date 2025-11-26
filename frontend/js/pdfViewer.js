// frontend/js/pdfViewer.js

import { processPdfForRAG } from './geminiBridge.js';
import { applyHighlightsOnLoad } from './highlight.js';
import {
    saveHighlightsToBackend,
    loadHighlightsFromBackend,
    exportPdfWithHighlights,
} from './utils.js';

export const PDF_RENDER_SCALE = 1.5; // 🔁 Shared scale for rendering + export

const pdfContainer = document.getElementById('pdf-canvas-container');
const pdfUploadInput = document.getElementById('pdf-upload');
const pdfFileNameSpan = document.getElementById('pdf-file-name');
const savePdfBtn = document.getElementById('save-pdf-btn');

// NEW: Progress bar
const progressBar = document.getElementById('pdf-load-progress');
const ragStatusSpan = document.getElementById('rag-status');

let currentPdfDoc = null;
let currentHighlights = [];
let fullPdfTextContent = [];
let currentPdfId = null;
let uploadedPdfFile = null;

// --- Render individual page ---
async function renderPage(pdfDoc, pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'pdf-page-wrapper';
    pageWrapper.style.width = `${viewport.width}px`;
    pageWrapper.style.height = `${viewport.height}px`;
    pageWrapper.style.position = 'relative';
    pageWrapper.setAttribute('data-page-num', pageNum);
    pageWrapper.style.setProperty('--scale-factor', viewport.scale);
    pdfContainer.appendChild(pageWrapper);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.className = 'pdf-page-canvas';
    pageWrapper.appendChild(canvas);

    await page.render({ canvasContext: context, viewport }).promise;

    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    pageWrapper.appendChild(textLayerDiv);

    const textContent = await page.getTextContent();
    fullPdfTextContent[pageNum - 1] = textContent.items.map(item => item.str).join(' ');

    await pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
        textDivs: [],
        enhanceTextSelection: true,
    });

    applyHighlightsOnLoad(pageWrapper, pageNum);

    console.log(`📝 Rendered page ${pageNum} of ${pdfDoc.numPages}`);
}


// --- Load PDF ---
async function loadPdf(file) {
    uploadedPdfFile = file;

    if (pdfFileNameSpan) {
        pdfFileNameSpan.textContent = file.name;
    }

    console.log(`📂 PDF selected: ${file.name}`);  // immediate log on selection

    const reader = new FileReader();
    reader.onload = async () => {
        const pdfData = new Uint8Array(reader.result);

        try {
            currentPdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            pdfContainer.innerHTML = '';
            fullPdfTextContent = new Array(currentPdfDoc.numPages).fill('');
            currentPdfId = file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            currentHighlights = [];

            for (let i = 1; i <= currentPdfDoc.numPages; i++) {
                await renderPage(currentPdfDoc, i);
            }

            console.log(`📄 PDF loaded: "${file.name}" with ${currentPdfDoc.numPages} pages.`);

            // immediately call backend for RAG
            processPdfForRAG(fullPdfTextContent.join('\n\n'))
                .then(() => console.log('🧠 RAG processing complete.'))
                .catch(err => console.error('❌ RAG processing failed:', err));

            const loadedHighlights = await loadHighlightsFromBackend(currentPdfId);
            currentHighlights = loadedHighlights;
            console.log(`🖍️ Loaded ${loadedHighlights.length} highlights from backend.`);
        } catch (error) {
            console.error('❌ Error loading PDF:', error);
        }
    };

    reader.readAsArrayBuffer(file);
}


// --- Event listeners ---
pdfUploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        loadPdf(file);
    }
});

savePdfBtn.addEventListener('click', async () => {
    if (!uploadedPdfFile || !currentHighlights.length) {
        alert("❌ No highlights or PDF loaded.");
        return;
    }

    try {
        const pdfBuffer = await uploadedPdfFile.arrayBuffer();
        await exportPdfWithHighlights(pdfBuffer, currentHighlights);
        console.log("📥 Annotated PDF saved successfully.");
    } catch (err) {
        console.error("❌ Failed to export highlighted PDF:", err);
        alert("Could not save highlighted PDF.");
    }
});

// --- Exported API ---
export function getPdfHighlights() {
    return currentHighlights;
}

export function setPdfHighlights(highlights) {
    currentHighlights = highlights;
}

export function getFullPdfTextContent() {
    return fullPdfTextContent.join('\n\n');
}

export function getCurrentPdfDocument() {
    return currentPdfDoc;
}

export function getCurrentPdfId() {
    return currentPdfId;
}

export { saveHighlightsToBackend, loadHighlightsFromBackend };
