// --- SETTINGS TABS LOGIC ---
function switchSettingsTab(tabId) {
    const isMobile = window.innerWidth <= 600;
    
    // Update sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('onclick').includes(tabId));
    });
    
    // Update tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.toggle('active', tab.id === `tab-${tabId}`);
    });

    if(isMobile) {
        document.querySelector('.settings-sidebar').classList.add('hidden');
        document.querySelector('.settings-content').classList.add('active');
        document.getElementById('settings-back-btn').style.display = 'block';
        
        // Update header title to tab name
        const tabName = tabId.charAt(0).toUpperCase() + tabId.slice(1);
        document.getElementById('settings-header-title').textContent = tabName;
    }

    if(tabId === 'storage' || tabId === 'network') loadSystemStats();
    if(tabId === 'battery') updateBatteryStatus();
}

function showSettingsSidebar() {
    document.querySelector('.settings-sidebar').classList.remove('hidden');
    document.querySelector('.settings-content').classList.remove('active');
    document.getElementById('settings-back-btn').style.display = 'none';
    document.getElementById('settings-header-title').textContent = 'System Settings';
}

// Dock Reveal on bottom hover
document.addEventListener('mousemove', (e) => {
    if(e.clientY > window.innerHeight - 50) {
        document.querySelector('.dock-wrapper').classList.remove('hidden');
    }
});

async function loadSystemStats() {
    try {
        const res = await fetch('/duongdev/macos/api/system/info');
        const data = await res.json();
        
        // Update Network
        const ipEl = document.getElementById('net-ip');
        if(ipEl) ipEl.textContent = data.ip;
        
        // Update Storage
        const bar = document.getElementById('storage-bar');
        const pct = document.getElementById('storage-percent');
        if(bar) bar.style.width = data.storage.percent + '%';
        if(pct) pct.textContent = `${data.storage.used}GB of ${data.storage.total}GB used`;
        
        const ph = document.getElementById('stat-photos');
        const nt = document.getElementById('stat-notes');
        if(ph) ph.textContent = `${data.stats.photos} items`;
        if(nt) nt.textContent = `${data.stats.notes} items`;
        
    } catch(e) {}
}

async function updateBatteryStatus() {
    try {
        const battery = await navigator.getBattery();
        const updateUI = () => {
            const level = Math.round(battery.level * 100);
            const levelEl = document.getElementById('battery-level-big');
            const iconEl = document.getElementById('battery-icon-big');
            const textEl = document.getElementById('battery-status-text');
            
            if(levelEl) levelEl.textContent = level + '%';
            if(textEl) textEl.textContent = battery.charging ? "Power Adapter Connected" : "On Battery Power";
            if(iconEl) {
                iconEl.className = `fas fa-battery-${level > 80 ? 'full' : (level > 20 ? 'half' : 'quarter')}`;
                iconEl.style.color = battery.charging ? '#30D158' : (level > 20 ? '#fff' : '#FF3B30');
            }
        };
        updateUI();
        battery.addEventListener('levelchange', updateUI);
        battery.addEventListener('chargingchange', updateUI);
    } catch(e) {}
}

function runPingTest() {
    const url = document.getElementById('ping-url').value;
    const res = document.getElementById('ping-results');
    res.innerHTML = `Pinging ${url}...<br>`;
    
    // Giả lập ping (vì browser không cho phép ICMP thật)
    let start = Date.now();
    fetch(`https://${url}`, { mode: 'no-cors' })
        .then(() => {
            let latency = Date.now() - start;
            res.innerHTML += `Reply from ${url}: time=${latency}ms<br>Status: OK`;
        })
        .catch(() => {
            res.innerHTML += `Request timed out. (Web server might be blocking proxy pings)`;
        });
}
// SOCKET IO CONNECTION
const socket = io({
    path: '/duongdev/macos/socket.io',
    transports: ['websocket', 'polling']
});

socket.on('connect', () => console.log("Connected to Dương OS Stream"));

socket.on('system_alert', (data) => {
    showIslandNotification('fas fa-info-circle', data.title, data.msg);
    if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
});

function sendSystemPing() {
    socket.emit('system_ping');
    showIslandNotification('fas fa-paper-plane', 'Ping Sent', 'System is active');
}

let touchStartY = 0;
let touchEndY = 0;
const lockScreen = document.getElementById('lock-screen');
const wallpaper = document.getElementById('wallpaper');
const osInterface = document.getElementById('os-interface'); // Get interface for zoom effect

// Clock Update
function updateSystemClock() {
    const now = new Date();
    
    // Lock Screen Clock
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${h}:${m}`;
    
    const lockTime = document.getElementById('lock-time');
    if(lockTime && lockTime.textContent !== timeStr) lockTime.textContent = timeStr;
    
    // Lock Screen Date
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', options);
    const lockDate = document.getElementById('lock-date');
    if(lockDate && lockDate.textContent !== dateStr) lockDate.textContent = dateStr;

    // Menu Bar Clock (Desktop)
    const menuClock = document.getElementById('menubar-clock');
    if(menuClock) {
        const menuDateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        menuClock.textContent = `${menuDateStr} ${timeStr}`;
    }
}

setInterval(updateSystemClock, 1000);
updateSystemClock();

// --- SETTINGS & WALLPAPER ---
let currentAccent = '#2997FF';

async function loadSettings() {
    try {
        const res = await fetch('/duongdev/macos/api/settings');
        const settings = await res.json();
        
        // Performance Settings
        if(settings.reduce_blur === 'true') {
            document.body.classList.add('reduce-blur');
            document.getElementById('perf-reduce-blur').checked = true;
        }
        if(settings.reduce_motion === 'true') {
            document.body.classList.add('reduce-motion');
            document.getElementById('perf-reduce-motion').checked = true;
        }

        // Default Wallpaper logic
        const defaultWP = '/duongdev/macos/static/images/Default.png';
        if(settings.wallpaper && settings.wallpaper !== '') {
            applyWallpaperUI(settings.wallpaper);
            const input = document.getElementById('setting-wallpaper');
            if(input) input.value = settings.wallpaper;
        } else {
            applyWallpaperUI(defaultWP);
        }

        if(settings.accent_color) {
            setAccent(settings.accent_color, false);
        }

        if(settings.user_name) {
            const input = document.getElementById('setting-name');
            if(input) input.value = settings.user_name;
            updateUserNameUI(settings.user_name);
        }
        
        initFakeSpecs();
    } catch(e) { console.error("Settings load failed", e); }
}

function initFakeSpecs() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const model = document.getElementById('sys-model-name');
    const os = document.getElementById('sys-os-version');
    const cpu = document.getElementById('sys-cpu');
    const serial = document.getElementById('sys-serial');
    
    if(isMobile) {
        if(model) model.textContent = "iPhone 16 Pro Max";
        if(os) os.textContent = "iOS 18.2";
        if(cpu) cpu.textContent = "Apple A18 Pro";
        if(serial) serial.textContent = "IP-16-Dương-IOS";
    } else {
        if(model) model.textContent = "MacBook Pro (M4 Max)";
        if(os) os.textContent = "macOS Sequoia 15.2";
        if(cpu) cpu.textContent = "Apple M4 Max (16-core)";
        if(serial) serial.textContent = "MB-M4-Dương-MAC";
    }
}

function setSystemVolume(val) {
    if(player && player.setVolume) {
        player.setVolume(val);
        showIslandNotification('fas fa-volume-up', 'Volume', val + '%');
    }
}

async function togglePerformanceSetting(key, enabled) {
    const className = key === 'reduce_blur' ? 'reduce-blur' : 'reduce-motion';
    
    if(enabled) document.body.classList.add(className);
    else document.body.classList.remove(className);
    
    try {
        await fetch('/duongdev/macos/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ [key]: enabled.toString() })
        });
        showIslandNotification('fas fa-tachometer-alt', 'Performance', 'Settings Saved');
    } catch(e) {}
}

async function deleteWallpaper() {
    if(!confirm("Xoá hình nền hiện tại và dùng mặc định?")) return;
    const defaultWP = '/duongdev/macos/static/images/Default.png';
    
    try {
        await fetch('/duongdev/macos/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ wallpaper: '' }) // Clear in DB
        });
        applyWallpaperUI(defaultWP);
        const input = document.getElementById('setting-wallpaper');
        if(input) input.value = '';
        showIslandNotification('fas fa-trash', 'Wallpaper', 'Reset to Default');
    } catch(e) { alert("Failed to delete wallpaper"); }
}

function applyWallpaperUI(url) {
    const wp = document.getElementById('wallpaper');
    if(wp) wp.style.backgroundImage = `url('${url}')`;
}

async function uploadWallpaper(input) {
    const file = input.files[0];
    if(!file) return;
    
    const formData = new FormData();
    formData.append('files[]', file);
    
    try {
        // Reuse existing photo upload endpoint
        const res = await fetch('/duongdev/macos/upload', {method:'POST', body:formData});
        const data = await res.json();
        if(data.success && data.new_media.length > 0) {
            const url = `/duongdev/macos/static/uploads/${data.new_media[0].filename}`;
            setWallpaper(url);
            showIslandNotification('fas fa-check-circle', 'Wallpaper Set', 'Image uploaded successfully');
        } else {
            showIslandNotification('fas fa-exclamation-triangle', 'Upload Failed', 'Could not save image');
        }
    } catch(e) { 
        showIslandNotification('fas fa-exclamation-triangle', 'Error', 'Network or server issue');
    }
}

function setWallpaper(url) {
    applyWallpaperUI(url);
    const input = document.getElementById('setting-wallpaper');
    if(input) input.value = url;
    saveSettings();
}

async function loadGalleryForSettings() {
    const container = document.getElementById('settings-gallery-preview');
    if(!container) return;
    
    // Simple way: get images from the Photos App grid
    const photos = document.querySelectorAll('#photo-grid img');
    container.innerHTML = '';
    
    photos.forEach(img => {
        const thumb = document.createElement('div');
        thumb.style.width = '60px';
        thumb.style.height = '60px';
        thumb.style.borderRadius = '8px';
        thumb.style.backgroundImage = `url('${img.src}')`;
        thumb.style.backgroundSize = 'cover';
        thumb.style.flexShrink = '0';
        thumb.style.cursor = 'pointer';
        thumb.style.border = '2px solid rgba(255,255,255,0.1)';
        
        thumb.onclick = () => setWallpaper(img.src);
        container.appendChild(thumb);
    });
    
    if(photos.length === 0) {
        container.innerHTML = '<div style="font-size:0.7rem; opacity:0.5;">No photos yet</div>';
    }
}

function setAccent(color, save=true) {
    currentAccent = color;
    document.documentElement.style.setProperty('--accent-blue', color);
    document.documentElement.style.setProperty('--accent-pink', color); // Unified theme
    
    // Update active swatch
    document.querySelectorAll('.color-swatch').forEach(el => {
        el.classList.toggle('active', el.style.backgroundColor === color || 
           rgbToHex(el.style.backgroundColor) === color.toLowerCase());
    });

    if(save) saveSettings();
}

function updateUserNameUI(name) {
    // Update Welcome Widget or other UI elements
    const welcome = document.getElementById('welcome-name');
    if(welcome) welcome.textContent = name;
}

// Helper for color comparison
function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb;
    let sep = rgb.indexOf(",") > -1 ? "," : " ";
    rgb = rgb.substr(4).split(")")[0].split(sep);
    let r = (+rgb[0]).toString(16), g = (+rgb[1]).toString(16), b = (+rgb[2]).toString(16);
    if (r.length == 1) r = "0" + r; if (g.length == 1) g = "0" + g; if (b.length == 1) b = "0" + b;
    return "#" + r + g + b;
}

async function saveSettings() {
    const wpInput = document.getElementById('setting-wallpaper');
    const nameInput = document.getElementById('setting-name');
    
    const payload = {
        wallpaper: wpInput ? wpInput.value : '',
        user_name: nameInput ? nameInput.value : '',
        accent_color: currentAccent
    };
    
    // Optimistic UI updates
    if(payload.wallpaper) document.getElementById('wallpaper').style.backgroundImage = `url('${payload.wallpaper}')`;
    if(payload.user_name) updateUserNameUI(payload.user_name);
    
    try {
        await fetch('/duongdev/macos/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
    } catch(e) { alert("Failed to save settings"); }
}

loadSettings(); // Call on startup

// --- REAL WEATHER API ---
async function fetchWeather() {
    let lat = 10.82, lon = 106.63; // Default HCM
    
    // Try to get real location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            updateWeather(pos.coords.latitude, pos.coords.longitude);
        }, err => {
            console.warn("Geolocation denied or error:", err);
            updateWeather(lat, lon); // Fallback
        }, {timeout: 5000});
    } else {
        console.warn("Geolocation not supported");
        updateWeather(lat, lon);
    }
}

async function updateWeather(lat, lon) {
    // Use relative path to work with DispatcherMiddleware
    const url = `api/weather?lat=${lat}&lon=${lon}`;

    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error("API Error");
        const data = await res.json();
        
        if(data.error) throw new Error(data.error);
        
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        
        const tempEl = document.getElementById('weather-temp');
        const descEl = document.getElementById('weather-desc');
        const iconEl = document.getElementById('weather-icon');
        
        if(tempEl) tempEl.textContent = `${temp}°C`;
        
        let icon = 'fa-sun';
        let desc = 'Sunny';
        
        if (code > 0) { desc = 'Clear Sky'; }
        if (code > 3) { icon = 'fa-cloud'; desc = 'Cloudy'; }
        if (code > 45) { icon = 'fa-smog'; desc = 'Foggy'; }
        if (code > 50) { icon = 'fa-cloud-rain'; desc = 'Rainy'; }
        if (code > 80) { icon = 'fa-bolt'; desc = 'Storm'; }
        
        if(descEl) descEl.textContent = desc;
        if(iconEl) iconEl.className = `fas ${icon}`;
        
    } catch (e) {
        console.error("Weather fetch failed", e);
        const descEl = document.getElementById('weather-desc');
        if(descEl) descEl.textContent = "Offline";
    }
}
fetchWeather(); // Call on load
setInterval(fetchWeather, 600000); // Refresh every 10 mins

// --- NOTES API ---
async function loadNotes() {
    const list = document.getElementById('notes-list');
    if(!list) return;
    list.innerHTML = '<div style="text-align:center; opacity:0.5;">Loading thoughts...</div>';
    
    try {
        const res = await fetch('/duongdev/macos/api/notes');
        const notes = await res.json();
        
        list.innerHTML = '';
        if(notes.length === 0) {
            list.innerHTML = '<div style="text-align:center; opacity:0.5; margin-top:20px;">No notes yet. Write something!</div>';
            return;
        }

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <div class="note-date">${note.date}</div>
                    <i class="fas fa-trash" style="font-size:0.8rem; color:#ff3b30; cursor:pointer;" onclick="deleteNote(${note.id})"></i>
                </div>
                <div class="note-content">${note.content}</div>
            `;
            list.appendChild(div);
        });
    } catch(e) {
        console.error(e);
    }
}

async function addNote() {
    const input = document.getElementById('new-note-input');
    const content = input.value.trim();
    if(!content) return;
    
    try {
        await fetch('/duongdev/macos/api/notes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({content})
        });
        input.value = '';
        loadNotes(); // Refresh
    } catch(e) { console.error(e); }
}

async function deleteNote(id) {
    if(!confirm('Delete this note?')) return;
    try {
        await fetch(`/duongdev/macos/api/notes/${id}`, {method:'DELETE'});
        loadNotes();
    } catch(e) { console.error(e); }
}
// Load settings initially
loadSettings(); 

// --- REAL WEATHER API ---
if(lockScreen) {
    lockScreen.addEventListener('touchstart', e => {
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    lockScreen.addEventListener('touchend', e => {
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, {passive: true});
    
    // Mouse fallback for desktop testing
    lockScreen.addEventListener('mousedown', e => { touchStartY = e.screenY; });
    lockScreen.addEventListener('mouseup', e => { 
        touchEndY = e.screenY; 
        if(touchStartY - touchEndY > 50) unlockSystem(); // Simple drag check
    });
}

function handleSwipe() {
    const sensitivity = 50;
    if (touchStartY - touchEndY > sensitivity) {
        unlockSystem();
    }
}

function unlockSystem() {
    if(lockScreen) {
        lockScreen.classList.add('unlocked');
        // Music will NOT play automatically to save resources and avoid browser blocks
    }
}

// --- 2. APP MANAGER ---
let activeApp = null;
let mapInstance = null;

// Shortcut to close app with ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeApp) {
        closeApp(activeApp);
    }
});

// --- MENU BAR LOGIC ---
function toggleMenu(menuId) {
    const allMenus = document.querySelectorAll('.dropdown-menu');
    const target = document.getElementById(menuId);
    
    const isOpen = target.classList.contains('active');
    allMenus.forEach(m => m.classList.remove('active'));
    
    if(!isOpen) target.classList.add('active');
}

// Global click to close menus
document.addEventListener('click', (e) => {
    if(!e.target.closest('.menubar-left span') && !e.target.closest('.menubar-right i')) {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
    }
});

function openApp(appId) {
    const appWindow = document.getElementById(`app-${appId}`);
    
    if(appWindow) {
        activeApp = appId;
        appWindow.classList.remove('minimized');
        appWindow.classList.add('active');
        osInterface.classList.add('app-open');
        
        // Auto-hide Dock when app opens
        document.querySelector('.dock-wrapper').classList.add('hidden');
        
        // Add indicator to dock
        const dockItem = document.getElementById(`dock-${appId}`);
        if(dockItem) dockItem.classList.add('app-active');
        
        // Special App Initializations
        if(appId === 'music') updateMusicVisuals();
        if(appId === 'calendar') loadCalendar();
        if(appId === 'maps') initMap();
        if(appId === 'notes') loadNotes();
        if(appId === 'settings') {
            loadGalleryForSettings();
            showSettingsSidebar(); // Reset to sidebar on open
        }
        if(appId === 'wallet') loadWallet();
        if(appId === 'ai') loadAiHistory();
    }
}

function closeApp(appId) {
    const appWindow = document.getElementById(`app-${appId}`);
    
    if(appWindow) {
        appWindow.classList.remove('active', 'maximized', 'minimized');
        osInterface.classList.remove('app-open');
        activeApp = null;
        
        // Show Dock when all apps closed
        document.querySelector('.dock-wrapper').classList.remove('hidden');
        
        const dockItem = document.getElementById(`dock-${appId}`);
        if(dockItem) dockItem.classList.remove('app-active');
    }
}

function minimizeApp(appId) {
    const appWindow = document.getElementById(`app-${appId}`);
    if(appWindow) {
        appWindow.classList.add('minimized');
        osInterface.classList.remove('app-open');
        document.querySelector('.dock-wrapper').classList.remove('hidden');
    }
}

function maximizeApp(appId) {
    const appWindow = document.getElementById(`app-${appId}`);
    if(appWindow) {
        appWindow.classList.toggle('maximized');
    }
}

// --- 3. MUSIC PLAYER (REAL) ---
let player;
let isPlaying = false;
let progressInterval;
let currentPlaylist = [];

// Shuffle Helper
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// YouTube API
if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function() {
    if (typeof SONG_IDS === 'undefined' || !SONG_IDS || SONG_IDS.length === 0) {
        console.error("SONG_IDS is missing or empty!");
        return;
    }
    
    // Shuffle the playlist
    currentPlaylist = shuffleArray([...SONG_IDS]);
    const firstSongId = currentPlaylist[0];
    
    console.log("Initializing Player with Playlist:", currentPlaylist);
    
    player = new YT.Player('youtube-player', {
        height: '0', width: '0', videoId: firstSongId,
        playerVars: { 
            'autoplay': 0, 
            'controls': 0, 
            'loop': 1, 
            'playlist': currentPlaylist.join(','), // Join for playlist support
            'origin': window.location.origin
        },
        events: { 
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': (e) => console.error("YT Player Error:", e.data)
        }
    });
};

function updateMusicMeta() {
    if (!player || !player.getVideoData) return;
    
    try {
        const data = player.getVideoData();
        const videoId = data.video_id;
        
        // Update High Res Cover
        const url = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const cover = document.getElementById('music-cover');
        const bg = document.getElementById('music-bg');
        
        if(cover) cover.style.backgroundImage = `url(${url})`;
        if(bg) bg.style.backgroundImage = `url(${url})`;

        // Update Title & Artist
        if(data && data.title) {
            const h2 = document.querySelector('.player-ui h2');
            if(h2) h2.textContent = data.title;
        }
        if(data && data.author) {
            const p = document.querySelector('.player-ui p');
            if(p) p.textContent = data.author;
        }
    } catch(e) { console.error("Meta update failed", e); }
}

// --- AI ASSISTANT (SIRI) LOGIC ---
async function loadAiHistory() {
    const chatBox = document.getElementById('ai-chat-box');
    if(!chatBox) return;
    
    try {
        const res = await fetch('/duongdev/macos/api/ai/history');
        const history = await res.json();
        
        chatBox.innerHTML = '';
        if(history.length === 0) {
            chatBox.innerHTML = '<div style="opacity:0.4; text-align:center; margin-top:40px; font-size:0.9rem;">Ask Siri anything...</div>';
            return;
        }

        history.forEach(msg => renderAiMessage(msg.role, msg.content, msg.model));
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) { console.error("History load failed", e); }
}

function renderAiMessage(role, content, model = '') {
    const chatBox = document.getElementById('ai-chat-box');
    const div = document.createElement('div');
    div.style.margin = '20px 0';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = (role === 'user') ? 'flex-end' : 'flex-start';

    const bubble = document.createElement('div');
    bubble.style.padding = '12px 18px';
    bubble.style.borderRadius = '20px';
    bubble.style.maxWidth = '85%';
    bubble.style.fontSize = '1.05rem';
    bubble.style.lineHeight = '1.5';

    if(role === 'user') {
        bubble.style.background = 'var(--accent-blue)';
        bubble.style.color = 'white';
        bubble.style.borderBottomRightRadius = '4px';
    } else {
        bubble.style.background = 'rgba(255,255,255,0.1)';
        bubble.style.color = '#fff';
        bubble.style.borderBottomLeftRadius = '4px';
        
        if(model) {
            const modelTag = document.createElement('div');
            modelTag.style.fontSize = '0.65rem';
            modelTag.style.opacity = '0.4';
            modelTag.style.marginBottom = '4px';
            modelTag.style.textTransform = 'uppercase';
            modelTag.textContent = model;
            div.appendChild(modelTag);
        }
    }

    bubble.innerHTML = content.replace(/\n/g, '<br>');
    div.appendChild(bubble);
    chatBox.appendChild(div);
}

async function sendAiMessage() {
    const input = document.getElementById('ai-input');
    const chatBox = document.getElementById('ai-chat-box');
    const modelSelect = document.getElementById('ai-model-select');
    const prompt = input.value.trim();
    
    if(!prompt) return;
    
    // Clear initial text if empty
    if(chatBox.querySelector('div[style*="opacity:0.4"]')) chatBox.innerHTML = '';
    
    input.value = '';
    renderAiMessage('user', prompt);
    
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'ai-loading';
    loadingMsg.style.margin = '10px 0';
    loadingMsg.style.opacity = '0.5';
    loadingMsg.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Siri is thinking...';
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    try {
        const res = await fetch('/duongdev/macos/api/ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, model: modelSelect.value })
        });
        const data = await res.json();
        
        loadingMsg.remove();
        
        if(data.output) {
            renderAiMessage('assistant', data.output, modelSelect.value);
            showIslandNotification('fas fa-comment-dots', 'Siri', 'Message received');
        } else if(data.error) {
            throw new Error(data.error);
        }
    } catch(e) {
        loadingMsg.remove();
        renderAiMessage('assistant', `⚠️ Error: ${e.message}`);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function clearAiChat() {
    if(!confirm("Clear all Siri history?")) return;
    try {
        await fetch('/duongdev/macos/api/ai/clear', {method:'POST'});
        loadAiHistory();
    } catch(e) {}
}
function navigateBrowser() {
    const input = document.getElementById('browser-url-input');
    const iframe = document.getElementById('browser-iframe');
    let url = input.value.trim();
    
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    iframe.src = url;
}

function browserGoHome() {
    const iframe = document.getElementById('browser-iframe');
    iframe.src = '/duongdev'; // Default home page (the app list)
}

function onPlayerReady(event) {
    updateMusicMeta();
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        isPlaying = true;
        updateMusicUI(true);
        updateMusicMeta(); // Update meta whenever a new song starts in playlist
        startProgressLoop();
    } else {
        isPlaying = false;
        updateMusicUI(false);
        stopProgressLoop();
    }
}

function togglePlay() {
    if(!player || !player.playVideo) return;
    if(isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function playMusic() {
    if(player && player.playVideo && !isPlaying) {
        player.playVideo();
        player.setVolume(60);
    }
}

function updateMusicUI(playing) {
    const btn = document.getElementById('play-btn');
    const container = document.querySelector('.player-ui');
    const viz = document.getElementById('wave-viz');
    const island = document.getElementById('dynamic-island');
    
    if(playing) {
        if(btn) { btn.className = 'fas fa-pause-circle'; }
        if(container) container.classList.add('playing');
        if(viz) viz.style.opacity = '1';
        if(island) {
            island.classList.add('playing');
            // Show song info in island when playing
            const data = player.getVideoData();
            if(data && data.title) {
                const islandText = island.querySelector('.di-content span');
                if(islandText) islandText.textContent = data.title;
            }
        }
    } else {
        if(btn) { btn.className = 'fas fa-play-circle'; }
        if(container) container.classList.remove('playing');
        if(viz) viz.style.opacity = '0';
        if(island) {
            island.classList.remove('playing');
            const islandText = island.querySelector('.di-content span');
            if(islandText) islandText.textContent = "System";
        }
    }
}

function updateMusicVisuals() {
    if(isPlaying) updateMusicUI(true);
}

// Music Progress Real
function startProgressLoop() {
    stopProgressLoop();
    progressInterval = setInterval(() => {
        if(!player || !player.getCurrentTime) return;
        const curr = player.getCurrentTime();
        const dur = player.getDuration();
        if(!dur) return;
        
        const pct = (curr / dur) * 100;
        document.getElementById('music-progress').style.width = `${pct}%`;
        document.getElementById('music-curr').textContent = formatTime(curr);
        document.getElementById('music-dur').textContent = formatTime(dur);
    }, 1000);
}

function stopProgressLoop() {
    clearInterval(progressInterval);
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,'0')}`;
}

function seekMusic(e) {
    if(!player || !player.seekTo) return;
    const bar = e.currentTarget;
    const clickX = e.offsetX;
    const width = bar.clientWidth;
    const dur = player.getDuration();
    
    const seekTime = (clickX / width) * dur;
    player.seekTo(seekTime, true);
}

// --- 4. PHOTOS & SLIDESHOW (Optimized for iOS Style) ---
const uploadInput = document.getElementById('upload-input');
const photoGrid = document.getElementById('photo-grid');
let currentLightboxMedia = { url: '', type: '', id: '' };
let cropper = null;

function openCropper(imageUrl) {
    const modal = document.getElementById('cropper-modal');
    const image = document.getElementById('cropper-image');
    image.src = imageUrl;
    modal.classList.add('active');
    
    if(cropper) cropper.destroy();
    
    // Use window ratio for wallpaper
    const ratio = window.innerWidth / window.innerHeight;
    
    setTimeout(() => {
        cropper = new Cropper(image, {
            aspectRatio: ratio,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            restore: false,
            guides: false,
            center: true,
            highlight: false,
            cropBoxMovable: false,
            cropBoxResizable: false,
            toggleDragModeOnDblclick: false,
        });
    }, 100);
}

function closeCropper() {
    document.getElementById('cropper-modal').classList.remove('active');
    if(cropper) cropper.destroy();
}

function applyCrop() {
    if(!cropper) return;
    const canvas = cropper.getCroppedCanvas({
        width: 1080, // High quality
        height: 1920
    });
    const croppedUrl = canvas.toDataURL('image/jpeg', 0.9);
    setWallpaper(croppedUrl);
    closeCropper();
    closeLightbox();
}

function openLightbox(url, type, id) {
    const lb = document.getElementById('lightbox');
    const container = document.getElementById('lightbox-container');
    lb.classList.add('active');
    currentLightboxMedia = { url, type, id };

    const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(type.toLowerCase());
    if (isVideo) {
        container.innerHTML = `<video src="${url}" controls autoplay class="lightbox-content"></video>`;
    } else {
        container.innerHTML = `<img src="${url}" class="lightbox-content">`;
    }
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.getElementById('lightbox-container').innerHTML = '';
}

async function handleLightboxAction(action) {
    const { url, id, type } = currentLightboxMedia;
    
    if (action === 'wallpaper') {
        const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(type.toLowerCase());
        if(isVideo) {
            alert("Videos cannot be used as wallpaper.");
            return;
        }
        openCropper(url);
    } else if (action === 'delete') {
        if (!confirm("Delete this media permanently?")) return;
        try {
            const res = await fetch(`/duongdev/macos/api/photos/${id}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (data.success) {
                // Remove from DOM without reload
                const el = document.querySelector(`.media-item[data-id="${id}"]`);
                if(el) {
                    el.style.transition = 'opacity 0.3s, transform 0.3s';
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0.8)';
                    setTimeout(() => el.remove(), 300);
                }
                closeLightbox();
                showIslandNotification('fas fa-trash', 'Deleted', 'Memory removed');
                
                // Refresh slideshow list
                setTimeout(initMemoriesSlideshow, 1000);
            } else {
                alert("Delete failed: " + (data.error || "Unknown error"));
            }
        } catch (e) { 
            console.error(e);
            alert("Delete failed. Check console for details.");
        }
    }
}

// Memories Slideshow (Restored)
function initMemoriesSlideshow() {
    const container = document.getElementById('memories-slideshow');
    if(!container) return;
    
    // Pick only images for the slideshow
    const mediaItems = document.querySelectorAll('#photo-grid .media-item img');
    if(mediaItems.length === 0) return;
    
    let currentIndex = 0;
    const photoUrls = Array.from(mediaItems).map(img => img.src);
    
    const updateSlide = () => {
        container.innerHTML = `<div class="memory-slide active" style="background-image: url('${photoUrls[currentIndex]}');"></div>`;
        currentIndex = (currentIndex + 1) % photoUrls.length;
    };
    
    updateSlide();
    setInterval(updateSlide, 6000);
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initMemoriesSlideshow, 1000);
});

if (uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const formData = new FormData();
        files.forEach(file => formData.append('files[]', file));

        const progressContainer = document.getElementById('upload-progress-container');
        const progressBar = document.getElementById('upload-bar');
        const progressText = document.getElementById('upload-pc');
        
        if(progressContainer) progressContainer.style.display = 'block';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/duongdev/macos/upload', true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                if(progressBar) progressBar.style.width = percent + '%';
                if(progressText) progressText.textContent = percent + '%';
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if(data.success && data.new_media) {
                        if(progressContainer) progressContainer.style.display = 'none';
                        
                        data.new_media.forEach(media => {
                            photoGrid.prepend(createMediaElement(media));
                        });
                        
                        showIslandNotification('fas fa-cloud-upload-alt', 'Upload Complete', `Added ${data.new_media.length} items`);
                    } else {
                        alert("Upload failed");
                        if(progressContainer) progressContainer.style.display = 'none';
                    }
                } catch(e) {
                    console.error(e);
                    location.reload(); // Fallback
                }
            } else {
                alert("Upload failed");
                if(progressContainer) progressContainer.style.display = 'none';
            }
        };

        xhr.onerror = () => {
            alert("Upload error");
            if(progressContainer) progressContainer.style.display = 'none';
        };

        xhr.send(formData);
    });
}

// --- 5. CALENDAR REAL ---
async function loadCalendar() {
    const view = document.getElementById('calendar-view');
    const list = document.getElementById('events-list');
    
    // Build Grid Header (Su Mo Tu...)
    view.innerHTML = '';
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    days.forEach(d => {
        view.innerHTML += `<div style="color:#666; font-size:0.8rem; padding:10px 0;">${d}</div>`;
    });
    
    // Fill Days
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    
    // Empty slots
    for(let i=0; i<firstDay; i++) {
        view.innerHTML += `<div></div>`;
    }
    
    // Days
    for(let i=1; i<=daysInMonth; i++) {
        let isToday = (i === now.getDate()) ? 'background:#FF3B30; color:white; border-radius:50%;' : '';
        view.innerHTML += `
            <div style="height:40px; display:flex; align-items:center; justify-content:center; position:relative;">
                <span style="width:30px; height:30px; line-height:30px; display:block; ${isToday}">${i}</span>
                <div class="dot-event hidden" id="day-${i}" style="width:4px; height:4px; background:#2997FF; border-radius:50%; position:absolute; bottom:5px;"></div>
            </div>`;
    }

    // Load Events
    try {
        const res = await fetch('/duongdev/macos/api/events');
        const events = await res.json();
        list.innerHTML = '';
        
        events.forEach(e => {
            // Mark dot on calendar
            const eDate = new Date(e.date);
            if(eDate.getMonth() === now.getMonth() && eDate.getFullYear() === now.getFullYear()) {
                const dot = document.getElementById(`day-${eDate.getDate()}`);
                if(dot) dot.classList.remove('hidden');
            }
            
            // Add to list
            list.innerHTML += `
                <div class="settings-item">
                    <div style="display:flex; flex-direction:column;">
                        <span class="settings-label">${e.title}</span>
                        <span style="font-size:0.8rem; color:#888;">${e.date}</span>
                    </div>
                </div>`;
        });
    } catch(err) { console.error(err); }
}

async function addEventPrompt() {
    const title = prompt("Event Title:");
    if(!title) return;
    const date = prompt("Date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if(!date) return;
    
    try {
        await fetch('/duongdev/macos/api/events', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title, date})
        });
        loadCalendar();
    } catch(e) {}
}

// --- 6. MAPS REAL ---
function initMap() {
    if(mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 300); // Fix rendering glitch
        return;
    }
    
    // Default center
    mapInstance = L.map('map-container').setView([10.8231, 106.6297], 13);
    
    // Dark Mode Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapInstance);
    
    loadLocations();
    
    // Click to add
    mapInstance.on('click', async (e) => {
        if(confirm("Mark this location?")) {
            const name = prompt("Name this place:", "Our Spot");
            if(name) {
                await addLocation(name, e.latlng.lat, e.latlng.lng);
            }
        }
    });
}

async function loadLocations() {
    try {
        const res = await fetch('/duongdev/macos/api/locations');
        const locs = await res.json();
        
        locs.forEach(l => {
            L.marker([l.lat, l.lng])
             .addTo(mapInstance)
             .bindPopup(`<b>${l.name}</b><br>${l.desc}`);
        });
    } catch(e) {}
}

async function addLocation(name, lat, lng) {
    try {
        await fetch('/duongdev/macos/api/locations', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, lat, lng, desc: "Memorable place"})
        });
        loadLocations();
    } catch(e) {}
}

function addCurrentLocation() {
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const {latitude, longitude} = pos.coords;
            mapInstance.setView([latitude, longitude], 15);
            L.marker([latitude, longitude]).addTo(mapInstance).bindPopup("You are here").openPopup();
        });
    } else {
        alert("Geolocation not supported.");
    }
}

// --- 7. SETTINGS REAL ---
async function updateSong(val) {
    if(!val) return;
    try {
        const res = await fetch('/duongdev/macos/api/settings/song', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({song_id: val})
        });
        const data = await res.json();
        if(data.success) {
            alert("Song updated! Please restart system.");
        }
    } catch(e) {
        alert("Failed to update song.");
    }
}

// --- Dynamic Island Interaction ---
function toggleIsland() {
    const di = document.getElementById('dynamic-island');
    di.classList.toggle('expanded');
}

// --- 8. WALLET REAL ---
let walletChart = null;

async function loadWallet() {
    const list = document.getElementById('transaction-list');
    const totalEl = document.getElementById('wallet-total');
    if(!list) return;

    try {
        const res = await fetch('/duongdev/macos/api/transactions');
        const txs = await res.json();
        
        // Calculate Total
        const total = txs.reduce((sum, t) => sum + t.amount, 0);
        totalEl.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total);

        // Render List
        list.innerHTML = '';
        if(txs.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No transactions yet</div>';
        } else {
            txs.forEach(t => {
                const div = document.createElement('div');
                div.className = 'settings-item'; // Reuse styling
                div.style.borderBottom = '1px solid #f0f0f0';
                
                const iconMap = {
                    'food': 'fa-utensils',
                    'gift': 'fa-gift',
                    'travel': 'fa-plane',
                    'other': 'fa-shopping-bag'
                };
                const colorMap = {
                    'food': '#FF9500',
                    'gift': '#FF2D55',
                    'travel': '#5856D6',
                    'other': '#8E8E93'
                };
                
                div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:40px; height:40px; border-radius:50%; background:${colorMap[t.category] || '#999'}; display:flex; align-items:center; justify-content:center; color:white;">
                            <i class="fas ${iconMap[t.category] || 'fa-shopping-bag'}"></i>
                        </div>
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:600; color:#000;">${t.title}</span>
                            <span style="font-size:0.8rem; color:#888;">${t.date}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-weight:600; color:#000;">-${new Intl.NumberFormat('vi-VN').format(t.amount)}₫</span>
                        <i class="fas fa-trash" style="color:#ff3b30; font-size:0.8rem; cursor:pointer;" onclick="deleteTransaction(${t.id})"></i>
                    </div>
                `;
                list.appendChild(div);
            });
        }
        
        renderChart(txs);

    } catch(e) { console.error(e); }
}

function renderChart(txs) {
    const ctx = document.getElementById('spendingChart');
    if(!ctx) return;
    
    // Group by Category
    const categories = {};
    txs.forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    
    const labels = Object.keys(categories).map(k => k.charAt(0).toUpperCase() + k.slice(1));
    const data = Object.values(categories);
    const colors = Object.keys(categories).map(k => {
        const map = { 'food': '#FF9500', 'gift': '#FF2D55', 'travel': '#5856D6', 'other': '#8E8E93' };
        return map[k] || '#8E8E93';
    });

    if(walletChart) walletChart.destroy();
    
    walletChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, font: {size: 11} } }
            },
            cutout: '70%'
        }
    });
}

// --- 9. DYNAMIC ISLAND & UI ENHANCEMENTS ---
let islandTimeout;
let defaultIslandContent = '';

// Capture default content on load
window.addEventListener('DOMContentLoaded', () => {
    const diContent = document.querySelector('#dynamic-island .di-content');
    if(diContent) defaultIslandContent = diContent.innerHTML;
});

function showIslandNotification(iconClass, title, subtitle) {
    const di = document.getElementById('dynamic-island');
    const content = di.querySelector('.di-content');
    
    // Capture default if not yet captured (fallback)
    if(!defaultIslandContent && content.innerHTML.trim() !== '') {
        defaultIslandContent = content.innerHTML;
    }

    // Set Content
    content.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; width:100%;">
            <div style="width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center;">
                <i class="${iconClass}" style="font-size:0.9rem; color:#fff;"></i>
            </div>
            <div style="display:flex; flex-direction:column; justify-content:center;">
                <span style="font-weight:600; font-size:0.85rem; line-height:1.2;">${title}</span>
                <span style="font-size:0.75rem; opacity:0.6; line-height:1.2;">${subtitle}</span>
            </div>
        </div>
    `;
    
    di.classList.add('expanded');
    
    clearTimeout(islandTimeout);
    islandTimeout = setTimeout(() => {
        di.classList.remove('expanded');
        setTimeout(() => {
            // Restore default content
            if(defaultIslandContent) {
                content.innerHTML = defaultIslandContent;
            }
            
            // Re-apply state
            if(isPlaying) updateMusicUI(true);
            else updateMusicUI(false);
            
        }, 400);
    }, 2500);
}

// Update Wallet Add to use Notification
async function addTransactionPrompt() {
    const title = prompt("Spent on what?");
    if(!title) return;
    const amountStr = prompt("Amount (VND):");
    if(!amountStr) return;
    const cat = prompt("Category (food, gift, travel, other):", "food");
    
    try {
        await fetch('/duongdev/macos/api/transactions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                title, 
                amount: parseFloat(amountStr),
                category: cat.toLowerCase()
            })
        });
        loadWallet();
        showIslandNotification('fas fa-wallet', 'Payment Successful', `-${new Intl.NumberFormat('vi-VN').format(parseFloat(amountStr))}₫`);
    } catch(e) { alert("Invalid input"); }
}

// Enable Drag & Drop for App Grid
const appGrid = document.querySelector('.app-grid');
if(appGrid) {
    new Sortable(appGrid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        delay: 200, // Touch delay to prevent conflict with click
        delayOnTouchOnly: true
    });
}

// --- CONTEXT MENU & LONG PRESS LOGIC ---
let contextTarget = null;
let longPressTimer;

// Global Click to Hide
document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
        document.getElementById('gallery-context-menu')?.classList.remove('active');
    }
});

// Event Delegation for Grid
const grid = document.getElementById('photo-grid');
if (grid) {
    // Right Click
    grid.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.media-item');
        if (item) {
            e.preventDefault();
            showCtxMenu(e.clientX, e.clientY, item);
        }
    });

    // Long Press
    grid.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.media-item');
        if (item) {
            longPressTimer = setTimeout(() => {
                const touch = e.touches[0];
                showCtxMenu(touch.clientX, touch.clientY, item);
            }, 600);
        }
    }, {passive: true});

    grid.addEventListener('touchend', () => clearTimeout(longPressTimer));
    grid.addEventListener('touchmove', () => clearTimeout(longPressTimer));
}

function showCtxMenu(x, y, item) {
    contextTarget = {
        url: item.dataset.url,
        type: item.dataset.type,
        id: item.dataset.id
    };
    
    const menu = document.getElementById('gallery-context-menu');
    
    // Boundary checks
    if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
    if (y + 120 > window.innerHeight) y = window.innerHeight - 130;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('active');
    
    if(navigator.vibrate) navigator.vibrate(50);
}

function handleContextMenuAction(action) {
    if (!contextTarget) return;
    const { url, type, id } = contextTarget;
    
    // Reuse Lightbox logic
    currentLightboxMedia = { url, type, id }; 
    handleLightboxAction(action);
    
    document.getElementById('gallery-context-menu').classList.remove('active');
}

// --- SYNC HELPER & LISTENERS ---
function createMediaElement(media) {
    const div = document.createElement('div');
    div.className = 'media-item';
    const url = `/duongdev/macos/static/uploads/${media.filename}`;
    
    div.dataset.url = url;
    div.dataset.type = media.type;
    div.dataset.id = media.id;
    
    div.onclick = () => openLightbox(url, media.type, media.id);
    
    if(['mp4', 'mov', 'avi', 'webm'].includes(media.type)) {
        div.innerHTML = `<video src="${url}#t=0.1" preload="none" muted playsinline style="pointer-events:none;"></video>
                         <div class="video-badge"><i class="fas fa-play" style="font-size:0.7rem;"></i></div>`;
    } else {
        div.innerHTML = `<img src="${url}">`;
    }
    return div;
}

socket.on('sync_settings', (data) => {
    if(data.wallpaper) {
        applyWallpaperUI(data.wallpaper);
        showIslandNotification('fas fa-image', 'Wallpaper Updated', 'System background changed');
    }
    if(data.user_name) document.getElementById('setting-name').value = data.user_name;
    if(data.accent_color) setAccent(data.accent_color, false);
});

socket.on('sync_new_media', (data) => {
    data.media.forEach(m => {
        if(document.getElementById('photo-grid')) document.getElementById('photo-grid').prepend(createMediaElement(m));
    });
    showIslandNotification('fas fa-camera', 'New Files', `${data.media.length} items added to system`);
});

socket.on('sync_delete_media', (data) => {
    const el = document.querySelector(`.media-item[data-id="${data.id}"]`);
    if(el) {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    }
});

socket.on('sync_wallet', () => {
    if(typeof loadWallet === 'function') {
        loadWallet();
        showIslandNotification('fas fa-wallet', 'Wallet Update', 'Transaction data updated');
    }
});


async function deleteTransaction(id) {
    if(!confirm("Delete this transaction?")) return;
    try {
        await fetch(`/duongdev/macos/api/transactions/${id}`, {method:'DELETE'});
        loadWallet();
    } catch(e) {}
}
