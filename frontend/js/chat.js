import { chatWithRAG } from './geminiBridge.js';
import { generateNotePDF, getAPIKey, getSelectedModel } from './utils.js';

const aiAssistantSidebar = document.getElementById('ai-assistant-sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const chatMessagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const exportNotesBtn = document.getElementById('export-notes-btn');

let chatHistory = [];

//  Deployed backend URL
const BASE_URL = 'https://favlearnai-backend.onrender.com';

// --- Core Chat Message UI ---
export function addChatMessage(text, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'user-message' : 'ai-message';

    if (isUser) {
        messageDiv.textContent = text;
    } else {
        messageDiv.innerHTML = formatAiResponse(text);
        highlightCodeBlocks(messageDiv);
    }

    chatMessagesContainer.appendChild(messageDiv);

    chatHistory.push({
        role: isUser ? 'user' : 'model',
        parts: [{ text }]
    });

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function replaceLastAiMessage(newText) {
    const lastMsg = chatMessagesContainer.lastChild;
    if (lastMsg && lastMsg.classList.contains('ai-message')) {
        lastMsg.innerHTML = formatAiResponse(newText);
        highlightCodeBlocks(lastMsg);
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'model') {
            chatHistory[chatHistory.length - 1].parts[0].text = newText;
        }
    } else {
        addChatMessage(newText, false);
    }
}

// --- Chat Send Logic ---
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addChatMessage(message, true);
    userInput.value = '';
    addChatMessage("💬 AI is thinking...", false);

    try {
        const apiKey = getAPIKey();
        const model = getSelectedModel();
        const aiResponse = await chatWithRAG(message, chatHistory, apiKey, model);
        replaceLastAiMessage(aiResponse);
    } catch (error) {
        console.error("❌ Error in sendMessage:", error);
        replaceLastAiMessage("⚠️ AI couldn't respond. Please check your connection or try again.");
    }
}

// --- Highlight Selection Message Send ---
export async function sendSelectedMessage(selectedText) {
    if (!selectedText) return;

    if (aiAssistantSidebar.classList.contains('hidden')) {
        aiAssistantSidebar.classList.remove('hidden');
        toggleSidebarBtn.textContent = 'Hide AI Sidebar';
    }

    addChatMessage(`📌 (Selected) ${selectedText}`, true);
    addChatMessage("💬 AI is thinking...", false);

    try {
        const apiKey = getAPIKey();
        const model = getSelectedModel();
        const aiResponse = await chatWithRAG(selectedText, chatHistory, apiKey, model);
        replaceLastAiMessage(aiResponse);
    } catch (error) {
        console.error("❌ Error in sendSelectedMessage:", error);
        replaceLastAiMessage("⚠️ AI couldn't respond to your selection.");
    }
}

// --- Sidebar Toggle ---
export function toggleSidebar() {
    aiAssistantSidebar.classList.toggle('hidden');
    toggleSidebarBtn.textContent = aiAssistantSidebar.classList.contains('hidden') ? 'Show AI Sidebar' : 'Hide AI Sidebar';
}

// --- New Chat ---
function startNewChat() {
    chatHistory = [];
    chatMessagesContainer.innerHTML = '';
    addChatMessage("👋 Hello! I'm your favLearnAI PDF Assistant. Ask me anything from your uploaded document.", false);
    console.log("🔄 New chat started.");
}

// --- Export AI Summary Notes ---
async function exportSummaryNotes() {
    if (!chatHistory.length) {
        alert("⚠️ No chat available to summarize.");
        return;
    }

    try {
        const apiKey = getAPIKey();
        const model = getSelectedModel();

        const res = await fetch(`${BASE_URL}/generate_notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat: chatHistory,
                api_key: apiKey,
                model: model
            })
        });

        const data = await res.json();
        if (data.notes) {
            generateNotePDF(data.notes);
            alert("📝 Summary Notes exported!");
        } else {
            alert("⚠️ Failed to generate notes.");
        }
    } catch (err) {
        console.error("❌ Failed to fetch notes:", err);
        alert("⚠️ Failed to connect to the backend.");
    }
}

// --- Markdown Formatting ---
function formatAiResponse(text) {
    if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        return `<div class="ai-text-block">${marked.parse(text)}</div>`;
    } else {
        const escaped = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<div class="ai-text-block">${escaped.replace(/\n/g, "<br>")}</div>`;
    }
}

function highlightCodeBlocks(container) {
    if (typeof hljs !== 'undefined') {
        const blocks = container.querySelectorAll('pre code');
        blocks.forEach(block => {
            hljs.highlightElement(block);
        });
    }
}

// --- Bind Events ---
toggleSidebarBtn?.addEventListener('click', toggleSidebar);
sendChatBtn?.addEventListener('click', sendMessage);
userInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});
newChatBtn?.addEventListener('click', startNewChat);
exportNotesBtn?.addEventListener('click', exportSummaryNotes);

document.addEventListener('DOMContentLoaded', startNewChat);
