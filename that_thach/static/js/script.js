const socketPath = window.location.pathname.replace(/\/$/, "") + '/socket.io';
const socket = io({
    path: socketPath,
    transports: ['websocket', 'polling']
});

let players = [];
let currentIndex = -1;
let isGameStarted = false;

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const playerNamesInput = document.getElementById('player-names');
const startBtn = document.getElementById('start-game');
const currentPlayerDisplay = document.getElementById('current-player-name');
const aiToggle = document.getElementById('ai-toggle');

const btnTruth = document.getElementById('btn-truth');
const btnDare = document.getElementById('btn-dare');
const loadingOverlay = document.getElementById('loading-overlay');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const resultContent = document.getElementById('result-content');
const resultHeader = document.getElementById('result-header-bg');
const closeResultBtn = document.getElementById('close-result');
const backToSetupBtn = document.getElementById('back-to-setup');

// Socket.io sync
socket.on('connect', () => {
    socket.emit('join_room');
});

socket.on('update_players', (serverPlayers) => {
    if (!isGameStarted && serverPlayers && serverPlayers.length > 0) {
        playerNamesInput.value = serverPlayers.join('\n');
    }
});

// Start Game
startBtn.addEventListener('click', () => {
    const input = playerNamesInput.value.trim();
    if (!input) {
        alert('Chưa có ai chơi sao? Nhập tên vào đi nào! 😅');
        return;
    }

    players = input.split('\n').map(name => name.trim()).filter(name => name !== '');
    if (players.length === 0) return;

    socket.emit('update_player_list', players);

    isGameStarted = true;
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    currentIndex = -1;
    nextTurn();
});

function nextTurn() {
    if (players.length === 0) return;
    
    if (currentIndex === -1) {
        currentIndex = Math.floor(Math.random() * players.length);
    } else {
        currentIndex = (currentIndex + 1) % players.length;
    }
    
    currentPlayerDisplay.innerText = players[currentIndex];
    
    // Hiệu ứng đổi tên mượt mà
    const wrapper = document.querySelector('.player-name-wrapper');
    wrapper.classList.remove('animate__animated', 'animate__bounceIn');
    void wrapper.offsetWidth; 
    wrapper.classList.add('animate__animated', 'animate__bounceIn');
}

// Get Question
async function fetchQuestion(type) {
    const isAI = aiToggle.checked;
    
    // Nếu dùng AI, hiện overlay loading "quay quay"
    if (isAI) {
        loadingOverlay.classList.remove('hidden');
    }

    // Thiết lập màu sắc card theo loại
    if (type === 'truth') {
        resultHeader.style.background = "var(--truth-grad)";
        resultTitle.innerText = "THẬT THÀ NÀO! 💬";
    } else {
        resultHeader.style.background = "var(--dare-grad)";
        resultTitle.innerText = "THÁCH ĐẤY, LÀM ĐI! 🔥";
    }

    try {
        const response = await fetch('api/get-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: type,
                is_ai: isAI
            })
        });
        const data = await response.json();
        
        // Giả lập trễ nhẹ nếu là Local để UX mượt hơn
        if (!isAI) await new Promise(r => setTimeout(r, 400));

        resultContent.innerText = data.question;
        loadingOverlay.classList.add('hidden');
        resultOverlay.classList.remove('hidden');
    } catch (error) {
        loadingOverlay.classList.add('hidden');
        alert("Có biến rồi! AI đang bận đi trà sữa, chọn Local chơi tạm nha!");
    }
}

btnTruth.addEventListener('click', () => fetchQuestion('truth'));
btnDare.addEventListener('click', () => fetchQuestion('dare'));

closeResultBtn.addEventListener('click', () => {
    resultOverlay.classList.add('hidden');
    nextTurn();
});

backToSetupBtn.addEventListener('click', () => {
    isGameStarted = false;
    setupScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
});
