let drawnCards = [];
let chatHistory = [];
let currentQuestion = "";

// DOM Elements
const el = {
    question: document.getElementById('user-question'),
    deckType: document.getElementById('deck-type'),
    aiSpeed: document.getElementById('ai-speed'),
    btnDraw: document.getElementById('btn-draw'),
    spread: document.getElementById('spread'),
    readingPanel: document.getElementById('reading-panel'),
    chatBox: document.getElementById('chat-box'),
    btnChat: document.getElementById('btn-chat'),
    chatInput: document.getElementById('chat-input'),
    btnDownload: document.getElementById('btn-download'),
    btnReset: document.getElementById('btn-reset'),
    loading: document.getElementById('loading-indicator'),
    loadingText: document.getElementById('loading-text')
};

async function startReading() {
    const question = el.question.value.trim();
    if (!question) return alert("Hỡi người tìm kiếm, hãy nhập câu hỏi của bạn.");

    el.btnDraw.disabled = true;
    el.loading.classList.remove('hidden');
    el.spread.innerHTML = "";
    el.readingPanel.classList.remove('hidden'); 
    el.chatBox.innerHTML = "<div class='msg ai-msg'>🔮 Bậc thầy đang chuẩn bị...</div>";
    
    // Đổi text loading tùy model
    if (el.aiSpeed.value === 'deep') el.loadingText.innerText = "Đang kết nối Claude 4.5 Opus (Sâu sắc - Có thể mất 30-40s)...";
    else if (el.aiSpeed.value === 'balanced') el.loadingText.innerText = "Đang kết nối GPT-4o (Cân bằng - Có thể mất 10-15s)...";
    else el.loadingText.innerText = "Đang kết nối GPT-4o-mini (Thần tốc - Phản hồi ngay)...";

    currentQuestion = question;
    drawnCards = [];
    chatHistory = [];
    
    try {
        const res = await fetch('/draw', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ deck_type: el.deckType.value })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        drawnCards = data.cards;
        renderCards(drawnCards);
        
        await getAIReading();
        
    } catch (err) {
        addMessage('ai', `⚠️ Lỗi: ${err.message}`);
    } finally {
        el.btnDraw.disabled = false;
        el.loading.classList.add('hidden');
    }
}

function renderCards(cards) {
    el.spread.innerHTML = "";
    cards.forEach((card, index) => {
        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="card" id="card-${index}">
                <div class="card-face card-front"></div>
                <div class="card-face card-back">
                    <div class="card-emoji">${card.emoji}</div>
                    <div class="card-name">${card.name}</div>
                    <div style="font-size:0.8rem; color:gold">${card.is_reversed ? '(Ngược)' : '(Xuôi)'}</div>
                </div>
            </div>
        `;
        el.spread.appendChild(container);
        
        setTimeout(() => {
            const cardEl = document.getElementById(`card-${index}`);
            if (card.is_reversed) cardEl.classList.add('is-reversed');
            else cardEl.classList.add('is-flipped');
        }, 500 + (index * 600));
    });
}

async function getAIReading() {
    try {
        const res = await fetch('/read', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                question: currentQuestion, 
                cards: drawnCards, 
                history: chatHistory,
                ai_speed: el.aiSpeed.value // Gửi lựa chọn model
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        if (data.output) {
            el.chatBox.innerHTML = "";
            addMessage('ai', data.output);
            chatHistory.push({"role": "assistant", "content": data.output});
        }
    } catch (e) {
        addMessage('ai', `Lỗi AI: ${e.message}.`);
    }
}

async function sendChatMessage() {
    const text = el.chatInput.value.trim();
    if (!text) return;
    
    addMessage('user', text);
    el.chatInput.value = "";
    el.btnChat.disabled = true;
    
    try {
        const res = await fetch('/read', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                question: text, 
                cards: drawnCards, 
                history: chatHistory,
                ai_speed: el.aiSpeed.value 
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        if (data.output) {
            addMessage('ai', data.output);
            chatHistory.push({"role": "user", "content": text});
            chatHistory.push({"role": "assistant", "content": data.output});
        }
    } catch (e) { 
        addMessage('ai', "Có lỗi khi kết nối với AI.");
    } finally { el.btnChat.disabled = false; }
}

function addMessage(type, content) {
    const div = document.createElement('div');
    div.className = `msg ${type}-msg`;
    let text = typeof content === 'string' ? content : JSON.stringify(content);
    
    if (type === 'ai' && typeof marked !== 'undefined') {
        div.innerHTML = marked.parse(text);
    } else {
        div.innerHTML = text.replace(/\n/g, '<br>');
    }
    
    el.chatBox.appendChild(div);
    el.chatBox.scrollTop = el.chatBox.scrollHeight;
}

function downloadReading() {
    let content = "🔮 BẢN GIẢI MÃ TAROT MULTI-AI 🔮\n";
    content += "========================================\n\n";
    content += `Chế độ AI: ${el.aiSpeed.options[el.aiSpeed.selectedIndex].text}\n`;
    content += `Câu hỏi của bạn: ${currentQuestion}\n\n`;
    content += "CÁC LÁ BÀI ĐÃ RÚT:\n";
    drawnCards.forEach((c, i) => {
        content += `- Lá thứ ${i+1}: ${c.emoji} ${c.name} (${c.is_reversed ? 'Ngược' : 'Xuôi'})\n`;
    });
    content += "\n========================================\n\n";
    content += "CHI TIẾT GIẢI MÃ & ĐỐI THOẠI:\n\n";
    
    chatHistory.forEach(msg => {
        const role = msg.role === 'user' ? 'BẠN' : (msg.role === 'assistant' ? 'AI' : 'HỆ THỐNG');
        content += `[${role}]: ${msg.content}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tarot_Reading_${new Date().getTime()}.txt`;
    a.click();
}

el.btnDraw.addEventListener('click', startReading);
el.btnChat.addEventListener('click', sendChatMessage);
el.btnDownload.addEventListener('click', downloadReading);
el.btnReset.addEventListener('click', () => location.reload());
el.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});
