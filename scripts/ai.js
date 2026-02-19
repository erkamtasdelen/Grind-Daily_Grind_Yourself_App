import { GoogleGenerativeAI } from "@google/generative-ai";

// API Configuration
const API_KEY = "AIzaSyAa6TNiz1E-5rsQr7bSdnju3vR86fWmoe0";
const API_BASE = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
const API_URL = API_BASE + "phps/api.php";
const genAI = new GoogleGenerativeAI(API_KEY);

// DOM Elements
const chatContainer = document.getElementById("chatContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const quickBtns = document.querySelectorAll(".quick-btn");
const quickActions = document.getElementById("quickActions");
const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const viewTitle = document.getElementById("viewTitle");
const currentDateEl = document.getElementById("currentDate");
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const streakCountEl = document.getElementById("streakCount");
const totalSessionsEl = document.getElementById("totalSessions");
const dailyProgressEl = document.getElementById("dailyProgress");
const addGoalBtn = document.getElementById("addGoalBtn");
const goalModal = document.getElementById("goalModal");
const closeModal = document.getElementById("closeModal");
const goalForm = document.getElementById("goalForm");
const goalsList = document.getElementById("goalsList");
const insightsList = document.getElementById("insightsList");
const dayCells = document.querySelectorAll(".day-cell");

// Mobile navigation elements
const mobileNavItems = document.querySelectorAll(".mobile-nav-item");
const sidebarOverlay = document.getElementById("sidebarOverlay");

// Insight suggestion elements
const insightSuggestion = document.getElementById("insightSuggestion");
const insightContent = document.getElementById("insightContent");
const saveInsightBtn = document.getElementById("saveInsight");
const dismissInsightBtn = document.getElementById("dismissInsight");
const closeInsightBtn = document.getElementById("closeInsight");

// State
let chatHistory = [];
let pendingInsight = null;
let userInsights = [];

// Base System Prompt - AI'in insight tespit etmesi icin guncellendi
const BASE_SYSTEM_PROMPT = `Sen şefkatli, anlayışlı ve derin düşünen bir rehbersin.
Hem bilge bir dost gibi konuşursun hem de disiplinli bir motivasyon koçusun.
Felsefen: "No Pain, No Gain" ve "Her gün %1 daha iyi."

İnsanı yargılamazsın.
Kırıcı, sert veya küçümseyici olmazsın.
Önce anlamaya çalışır, sonra yön gösterirsin.

Gerçekleri saklamazsın ama bunu yumuşak ve saygılı bir dille yaparsın.
Kişinin değerini değil, geliştirebileceği davranışlarını konuşursun.
Bahaneleri suçlayarak değil, farkındalık kazandırarak ele alırsin.

Konfor alanının sınırlarını nazikçe hatırlatır,
Disiplini korkutarak değil, bilinç oluşturarak öğretirsin.

Kısa ama sıcak cevaplar verirsin.
Gerektiğinde biraz daha açıklayıcı ve sohbet havasında olursun.
Umut satmazsın; sağlam, gerçekçi bir ilerleme perspektifi sunarsın.

Her gün %1 ilerlemenin bileşik etkisini sade bir şekilde hatırlatırsın.
Küçük ve sürdürülebilir adımların gücünü vurgularsın.

Ruh sağlığıyla ilgili hassas durumlarda anlayışlı olur,
Gerekirse profesyonel destek önerirsin..

ONEMLI: Eger kullanicinin soylediklerinden hayatına dair, kişiliği ile ilgili, onemli bir bilgi, hedef, karar veya taahhut tespit edersen, cevabinin SONUNA su formati ekle:

[INSIGHT]
kategori: hedef/karar/taahhut/ogrenme/alinti
baslik: Kisa baslik
icerik: Kaydedilecek bilgi
[/INSIGHT]

Ornek:
Kullanici: "Her gun 5 km kosacagim"
Sen: "Guzel karar. Sozunu tutarsan 30 gunde aliskanlık olur, 90 gunde yasam tarzi olur. Bahanelere yer yok.
[INSIGHT]
kategori: taahhut
baslik: Gunluk Kosu Hedefi
icerik: Her gun 5 km kosmaya karar verildi
[/INSIGHT]"

Her mesajda insight olmasina gerek yok. Sadece gercekten kaydedilmeye deger bilgilerde kullan.`;

// Dynamic system prompt with user insights
function getSystemPrompt() {
    let prompt = BASE_SYSTEM_PROMPT;
    
    if (userInsights.length > 0) {
        prompt += `\n\nKULLANICI HAKKINDA BILDIKLERIN:\n`;
        userInsights.forEach(insight => {
            prompt += `- [${insight.category}] ${insight.title}: ${insight.content}\n`;
        });
        prompt += `\nBu bilgileri konusmalarinda dikkate al ve gerektiginde referans ver.`;
    }
    
    return prompt;
}

// Initialize
async function init() {
    setupEventListeners();
    updateDate();
    await setupDatabase();
    await loadChatHistory();
    await loadUserInsights();
    loadStats();
    loadGoals();
    loadInsights();
    renderWeekProgress();
}

async function setupDatabase() {
    try {
        await fetch(API_BASE + "phps/setup_db.php");
    } catch (e) {
        console.log("DB setup check:", e);
    }
}

// Load chat history from database
async function loadChatHistory() {
    try {
        const result = await apiGet("get_chat_history&limit=10");
        if (result.success && result.data) {
            chatHistory = result.data.map(msg => ({
                role: msg.role === 'ai' ? 'model' : 'user',
                content: msg.message
            }));
            
            // Render previous messages in UI
            result.data.forEach(msg => {
                addMessage(msg.message, msg.role === 'ai' ? 'ai' : 'user', false);
            });
            
            // Scroll to bottom after loading history
            if (result.data.length > 0) {
                requestAnimationFrame(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
            }
        }
    } catch (e) {
        console.log("Chat history load:", e);
    }
}

// Load user insights for AI context
async function loadUserInsights() {
    try {
        const result = await apiGet("get_insights");
        if (result.success && result.data) {
            userInsights = result.data;
        }
    } catch (e) {
        console.log("User insights load:", e);
    }
}

function setupEventListeners() {
    // Send message
    sendBtn.addEventListener("click", handleSend);
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener("input", () => {
        userInput.style.height = "auto";
        userInput.style.height = userInput.scrollHeight + "px";
    });

    // Quick actions
    quickBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            userInput.value = btn.dataset.prompt;
            handleSend();
        });
    });

    // Navigation
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const viewId = item.dataset.view;
            switchView(viewId);
            closeSidebar();
        });
    });

    // Mobile bottom navigation
    mobileNavItems.forEach(item => {
        item.addEventListener("click", () => {
            const viewId = item.dataset.view;
            switchView(viewId);
        });
    });

    // Mobile menu
    menuToggle.addEventListener("click", toggleSidebar);
    
    // Sidebar overlay click to close
    sidebarOverlay.addEventListener("click", closeSidebar);
    
    // Swipe gesture for sidebar
    setupSwipeGestures();

    // Goals
    addGoalBtn.addEventListener("click", () => goalModal.classList.add("active"));
    closeModal.addEventListener("click", () => goalModal.classList.remove("active"));
    goalModal.addEventListener("click", (e) => {
        if (e.target === goalModal) goalModal.classList.remove("active");
    });
    goalForm.addEventListener("submit", handleAddGoal);

    // Week progress
    dayCells.forEach(cell => {
        cell.addEventListener("click", () => toggleDayComplete(cell));
    });

    // Insight actions
    saveInsightBtn.addEventListener("click", handleSaveInsight);
    dismissInsightBtn.addEventListener("click", hideInsightSuggestion);
    closeInsightBtn.addEventListener("click", hideInsightSuggestion);
}

// API Helper - GET istekleri icin
async function apiGet(action) {
    try {
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const text = await response.text();
        if (!text) return { success: false, error: 'Empty response' };
        return JSON.parse(text);
    } catch (error) {
        console.error("API GET Error:", error);
        return { success: false, error: error.message };
    }
}

// API Helper - POST istekleri icin
async function apiPost(action, data = {}) {
    try {
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const text = await response.text();
        if (!text) return { success: false, error: 'Empty response' };
        return JSON.parse(text);
    } catch (error) {
        console.error("API POST Error:", error);
        return { success: false, error: error.message };
    }
}

// Navigation
function switchView(viewId) {
    // Update sidebar nav items
    navItems.forEach(item => {
        item.classList.toggle("active", item.dataset.view === viewId);
    });
    
    // Update mobile nav items
    mobileNavItems.forEach(item => {
        item.classList.toggle("active", item.dataset.view === viewId);
    });

    views.forEach(view => {
        view.classList.toggle("active", view.id === viewId + "View");
    });

    const titles = {
        chat: "Koc",
        progress: "Ilerleme",
        goals: "Hedefler",
        insights: "Notlar"
    };
    viewTitle.textContent = titles[viewId] || "Koc";

    // Reload data when switching views
    if (viewId === "insights") loadInsights();
    if (viewId === "goals") loadGoals();
}

function toggleSidebar() {
    const isOpen = sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("active", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
    document.body.style.overflow = "";
}

// Swipe gestures for mobile
function setupSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    
    document.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    document.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = Math.abs(touchEndY - touchStartY);
        
        // Only trigger if horizontal swipe is dominant
        if (Math.abs(diffX) > 80 && diffY < 100) {
            // Swipe right from left edge to open sidebar
            if (diffX > 0 && touchStartX < 30) {
                toggleSidebar();
            }
            // Swipe left to close sidebar when open
            if (diffX < 0 && sidebar.classList.contains("open")) {
                closeSidebar();
            }
        }
    }, { passive: true });
}

// Date
function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    currentDateEl.textContent = now.toLocaleDateString('tr-TR', options);
}

// Stats
async function loadStats() {
    const result = await apiGet("get_stats");
    if (result.success) {
        streakCountEl.textContent = result.data.streak || 0;
        totalSessionsEl.textContent = result.data.total_sessions || 0;
    }
}

async function incrementSession() {
    await apiPost("increment_session");
    loadStats();
}

// Week Progress
async function renderWeekProgress() {
    const result = await apiGet("get_week_progress");
    if (result.success) {
        const completedDates = result.data.map(d => new Date(d.date).getDay());
        dayCells.forEach((cell, index) => {
            const dayNum = (index + 1) % 7; // Monday = 0 -> 1, Sunday = 6 -> 0
            const isCompleted = completedDates.includes(dayNum === 0 ? 0 : dayNum);
            cell.classList.toggle("completed", isCompleted);
        });
    }
}

async function toggleDayComplete(cell) {
    const dayIndex = parseInt(cell.dataset.day);
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIndex);
    
    const dateStr = targetDate.toISOString().split('T')[0];
    
    await apiPost("toggle_day", { date: dateStr });
    cell.classList.toggle("completed");
    loadStats();
}

// Goals
async function loadGoals() {
    const result = await apiGet("get_goals");
    if (result.success) {
        renderGoals(result.data);
    }
}

function renderGoals(goals) {
    if (!goals || goals.length === 0) {
        goalsList.innerHTML = `
            <div class="empty-goals">
                <p>Henuz hedef eklenmedi</p>
                <span>Ilk hedefini ekleyerek basla</span>
            </div>
        `;
        return;
    }

    goalsList.innerHTML = goals.map(goal => `
        <div class="goal-item ${goal.completed ? 'completed' : ''}" data-id="${goal.id}">
            <div class="goal-check" onclick="toggleGoal(${goal.id})"></div>
            <div class="goal-info">
                <div class="goal-title">${goal.title}</div>
                ${goal.description ? `<div class="goal-desc">${goal.description}</div>` : ''}
                ${goal.deadline ? `<div class="goal-deadline">Hedef: ${formatDate(goal.deadline)}</div>` : ''}
            </div>
            <button class="goal-delete" onclick="deleteGoal(${goal.id})">x</button>
        </div>
    `).join('');
}

async function handleAddGoal(e) {
    e.preventDefault();
    const title = document.getElementById("goalTitle").value.trim();
    const description = document.getElementById("goalDesc").value.trim();
    const deadline = document.getElementById("goalDeadline").value;

    if (!title) return;

    await apiPost("save_goal", { title, description, deadline });
    loadGoals();
    goalModal.classList.remove("active");
    goalForm.reset();
}

window.toggleGoal = async function(id) {
    await apiPost("toggle_goal", { id });
    loadGoals();
};

window.deleteGoal = async function(id) {
    await apiPost("delete_goal", { id });
    loadGoals();
};

// Insights
async function loadInsights() {
    const result = await apiGet("get_insights");
    if (result.success) {
        renderInsights(result.data);
    }
}

function renderInsights(insights) {
    if (!insights || insights.length === 0) {
        insightsList.innerHTML = `
            <div class="empty-insights">
                <p>Henuz not kaydedilmedi</p>
                <span>AI senin icin onemli bilgileri tespit edecek</span>
            </div>
        `;
        return;
    }

    insightsList.innerHTML = insights.map(insight => `
        <div class="insight-item" data-id="${insight.id}">
            <div class="insight-item-header">
                <span class="insight-category">${insight.category}</span>
                <div>
                    <span class="insight-date">${formatDate(insight.created_at)}</span>
                    <button class="insight-item-delete" onclick="deleteInsight(${insight.id})">x</button>
                </div>
            </div>
            ${insight.title ? `<div class="insight-item-title">${insight.title}</div>` : ''}
            <div class="insight-item-content">${insight.content}</div>
        </div>
    `).join('');
}

function showInsightSuggestion(insight) {
    pendingInsight = insight;
    insightContent.textContent = insight.content;
    insightSuggestion.classList.add("active");
    
    // Quick action olarak da goster
    addSaveQuickAction();
}

function hideInsightSuggestion() {
    insightSuggestion.classList.remove("active");
    pendingInsight = null;
    removeSaveQuickAction();
}

function addSaveQuickAction() {
    // Varsa eski kaydet butonunu kaldir
    removeSaveQuickAction();
    
    const saveBtn = document.createElement("button");
    saveBtn.className = "quick-btn save-action";
    saveBtn.textContent = "Bunu Kaydet";
    saveBtn.style.background = "#3d5a3d";
    saveBtn.style.borderColor = "#4a7c4a";
    saveBtn.style.color = "#c8e6c8";
    saveBtn.onclick = handleSaveInsight;
    quickActions.appendChild(saveBtn);
}

function removeSaveQuickAction() {
    const existing = quickActions.querySelector(".save-action");
    if (existing) existing.remove();
}

async function handleSaveInsight() {
    if (!pendingInsight) return;
    
    await apiPost("save_insight", {
        category: pendingInsight.category,
        title: pendingInsight.title,
        content: pendingInsight.content,
        importance: "high"
    });
    
    // Refresh user insights for AI context
    await loadUserInsights();
    
    hideInsightSuggestion();
    
    // Kullaniciya bildir
    addMessage("Bilgi kaydedildi. Notlar sekmesinden gorebilirsin.", "ai");
}

window.deleteInsight = async function(id) {
    await apiPost("delete_insight", { id });
    loadInsights();
};

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// Chat
async function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;

    // Remove welcome card
    const welcomeCard = document.querySelector(".welcome-card");
    if (welcomeCard) welcomeCard.remove();

    // Add user message
    addMessage(message, "user");

    // Clear input
    userInput.value = "";
    userInput.style.height = "auto";

    // Hide any pending insight
    hideInsightSuggestion();

    // Show loading
    showLoading(true);

    try {
        const response = await getAIResponse(message);
        
        // Parse insight from response
        const { cleanResponse, insight } = parseInsight(response);
        
        addMessage(cleanResponse, "ai");
        
        // If insight detected, show suggestion
        if (insight) {
            showInsightSuggestion(insight);
        }
        
        incrementSession();
    } catch (error) {
        console.error("Send Error:", error);
        const errorMsg = error.message || "Bilinmeyen hata";
        if (errorMsg.includes("API_KEY") || errorMsg.includes("key")) {
            addMessage("API anahtari hatasi. Lutfen daha sonra tekrar dene.", "ai");
        } else if (errorMsg.includes("network") || errorMsg.includes("fetch") || errorMsg.includes("Failed")) {
            addMessage("Baglanti hatasi. Internet baglantini kontrol et.", "ai");
        } else if (errorMsg.includes("quota") || errorMsg.includes("limit")) {
            addMessage("API limiti asildi. Biraz bekleyip tekrar dene.", "ai");
        } else {
            addMessage(`Bir hata olustu: ${errorMsg}`, "ai");
        }
    } finally {
        showLoading(false);
    }
}

function parseInsight(response) {
    const insightRegex = /\[INSIGHT\]([\s\S]*?)\[\/INSIGHT\]/;
    const match = response.match(insightRegex);
    
    if (!match) {
        return { cleanResponse: response, insight: null };
    }
    
    const cleanResponse = response.replace(insightRegex, '').trim();
    const insightText = match[1];
    
    // Parse insight fields
    const categoryMatch = insightText.match(/kategori:\s*(.+)/i);
    const titleMatch = insightText.match(/baslik:\s*(.+)/i);
    const contentMatch = insightText.match(/icerik:\s*(.+)/i);
    
    const insight = {
        category: categoryMatch ? categoryMatch[1].trim() : 'genel',
        title: titleMatch ? titleMatch[1].trim() : '',
        content: contentMatch ? contentMatch[1].trim() : ''
    };
    
    return { cleanResponse, insight };
}

function addMessage(text, sender, scrollToBottom = true) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `<div class="message-bubble">${text}</div>`;
    chatContainer.appendChild(messageDiv);
    if (scrollToBottom) {
        // Smooth scroll to bottom
        requestAnimationFrame(() => {
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
    }
}

// Save message to database
async function saveChatMessage(role, message) {
    try {
        await apiPost("save_chat", { role, message });
    } catch (e) {
        console.log("Chat save error:", e);
    }
}

async function getAIResponse(userMessage) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: getSystemPrompt()
        });

        const history = chatHistory.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 600,
                temperature: 0.8,
            }
        });

        const result = await chat.sendMessage(userMessage);
        const response = result.response;
        const responseText = response.text();

        // Update local history
        chatHistory.push(
            { role: "user", content: userMessage },
            { role: "model", content: responseText }
        );

        // Save to database (don't await so it doesn't block)
        saveChatMessage("user", userMessage);
        saveChatMessage("ai", responseText);

        // Keep only last 10 messages in memory
        if (chatHistory.length > 10) {
            chatHistory = chatHistory.slice(-10);
        }

        return responseText;
    } catch (error) {
        console.error("AI Response Error:", error);
        throw new Error(error.message || "Baglanti hatasi");
    }
}

function showLoading(show) {
    loadingOverlay.classList.toggle("active", show);
    sendBtn.disabled = show;
}

// Start
init();
