// frontend/js/highlight.js

import {
    setPdfHighlights,
    getPdfHighlights,
    saveHighlightsToBackend,
    loadHighlightsFromBackend
} from './pdfViewer.js';
import { sendSelectedMessage, toggleSidebar } from './chat.js';
import { getAPIKey } from './utils.js';

const pdfViewerContainer = document.getElementById('pdf-viewer-container');
const selectionPopup = document.getElementById('selection-popup');
const highlightBtn = document.getElementById('highlight-btn');
const askAiBtn = document.getElementById('ask-ai-btn');

let currentSelectionText = null;
let currentSelectionRects = [];
let currentSelectionPageNum = null;
let highlightHistory = [];

// --- Helpers ---
function getSelectionRects() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().length === 0) return [];
    return Array.from(selection.getRangeAt(0).getClientRects());
}

function getCurrentPageNum(rect) {
    const pages = document.querySelectorAll('.pdf-page-wrapper');
    for (const page of pages) {
        const bounds = page.getBoundingClientRect();
        if (
            rect.top < bounds.bottom &&
            rect.bottom > bounds.top &&
            rect.left < bounds.right &&
            rect.right > bounds.left
        ) {
            return parseInt(page.dataset.pageNum, 10);
        }
    }
    return null;
}

function showSelectionPopup() {
    const rects = getSelectionRects();
    if (rects.length > 0) {
        const firstRect = rects[0];
        const popupX = firstRect.left + firstRect.width / 2;
        const popupY = firstRect.top - selectionPopup.offsetHeight - 10;

        selectionPopup.style.left = `${popupX}px`;
        selectionPopup.style.top = `${popupY}px`;
        selectionPopup.style.display = 'flex';

        currentSelectionText = window.getSelection().toString();
        currentSelectionRects = rects;
        currentSelectionPageNum = getCurrentPageNum(firstRect);

        document.querySelectorAll('.textLayer > div').forEach(div => {
            div.style.background = 'none';
        });
    } else {
        hideSelectionPopup();
    }
}

function hideSelectionPopup() {
    selectionPopup.style.display = 'none';
    currentSelectionText = null;
    currentSelectionRects = [];
    currentSelectionPageNum = null;

    document.querySelectorAll('.textLayer > div').forEach(div => {
        div.style.background = 'none';
    });
}

// --- Highlight logic ---
function applyHighlightOverlay() {
    if (!currentSelectionRects.length || !currentSelectionText || currentSelectionPageNum === null) return;

    const pageWrapper = document.querySelector(`.pdf-page-wrapper[data-page-num="${currentSelectionPageNum}"]`);
    if (!pageWrapper) return;

    const wrapperBounds = pageWrapper.getBoundingClientRect();
    const createdDivs = [];

    const relRects = currentSelectionRects.map(rect => {
        const div = document.createElement('div');
        div.className = 'highlight-overlay';
        div.style.left = `${rect.left - wrapperBounds.left}px`;
        div.style.top = `${rect.top - wrapperBounds.top}px`;
        div.style.width = `${rect.width}px`;
        div.style.height = `${rect.height}px`;
        pageWrapper.appendChild(div);
        createdDivs.push(div);
        return {
            left: rect.left - wrapperBounds.left,
            top: rect.top - wrapperBounds.top,
            width: rect.width,
            height: rect.height
        };
    });

    const newHighlight = {
        text: currentSelectionText,
        rects: relRects,
        pageNum: currentSelectionPageNum,
        elements: createdDivs
    };

    const updatedHighlights = [...getPdfHighlights(), newHighlight];
    setPdfHighlights(updatedHighlights);
    saveHighlightsToBackend(updatedHighlights);
    highlightHistory.push(newHighlight);

    console.log("🔖 Highlighted:", currentSelectionText);
    hideSelectionPopup();
    window.getSelection().removeAllRanges();
}

export function applyHighlightsOnLoad(pageWrapper, pageNum) {
    getPdfHighlights()
        .filter(h => h.pageNum === pageNum)
        .forEach(highlight => {
            const divs = [];
            highlight.rects.forEach(rect => {
                const div = document.createElement('div');
                div.className = 'highlight-overlay';
                div.style.left = `${rect.left}px`;
                div.style.top = `${rect.top}px`;
                div.style.width = `${rect.width}px`;
                div.style.height = `${rect.height}px`;
                pageWrapper.appendChild(div);
                divs.push(div);
            });
            highlight.elements = divs;
        });
}

function undoLastHighlight() {
    const last = highlightHistory.pop();
    if (!last) return;
    last.elements.forEach(div => div.remove());

    const updated = getPdfHighlights().filter(h => h !== last);
    setPdfHighlights(updated);
    saveHighlightsToBackend(updated);
    console.log("↩️ Undo last highlight");
}

// --- Event bindings ---
document.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (
        selectedText.length > 0 &&
        selection.rangeCount > 0 &&
        pdfViewerContainer.contains(e.target)
    ) {
        const range = selection.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const isInTextLayer =
            (node.nodeType === Node.ELEMENT_NODE && node.closest('.textLayer')) ||
            (node.nodeType === Node.TEXT_NODE && node.parentElement?.closest('.textLayer'));

        if (isInTextLayer) {
            setTimeout(showSelectionPopup, 50);
        } else {
            hideSelectionPopup();
        }
    } else {
        setTimeout(() => {
            if (
                !selectionPopup.contains(e.target) &&
                window.getSelection().toString().trim().length === 0
            ) {
                hideSelectionPopup();
            }
        }, 50);
    }
});

highlightBtn.addEventListener('click', () => {
    if (currentSelectionText) applyHighlightOverlay();
});

askAiBtn.addEventListener('click', () => {
    const text = window.getSelection()?.toString().trim();
    if (text?.length > 0) {
        if (!getAPIKey()) {
            alert("❌ Please set your Gemini API Key.");
            hideSelectionPopup();
            return;
        }
        toggleSidebar();
        sendSelectedMessage(text);
        hideSelectionPopup();
        console.log("🧠 Asking AI about:", text);
    } else {
        alert("⚠️ No text selected. Try again.");
        hideSelectionPopup();
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastHighlight();
    }
});
