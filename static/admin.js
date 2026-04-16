// static/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements for Config Editor ---
    const configEditorElement = document.getElementById('config-editor');
    const saveConfigBtn = document.getElementById('save-config-btn');

    // --- Elements for File Editor ---
    const fileBrowser = document.getElementById('file-browser');
    const fileEditorElement = document.getElementById('file-editor');
    const saveFileBtn = document.getElementById('save-file-btn');
    const currentFilepathEl = document.getElementById('current-filepath');

    // --- Elements for System Metrics ---
    const cpuValue = document.getElementById('cpu-value');
    const cpuProgress = document.getElementById('cpu-progress');
    const ramValue = document.getElementById('ram-value');
    const ramProgress = document.getElementById('ram-progress');
    const diskValue = document.getElementById('disk-value');
    const diskProgress = document.getElementById('disk-progress');

    // --- Elements for Log Viewer ---
    const logContentPre = document.getElementById('log-content');
    const refreshLogBtn = document.getElementById('refresh-log-btn');

    // --- Elements for Restart Server ---
    const restartServerBtn = document.getElementById('restart-server-btn');
    const confirmRestartModal = document.getElementById('confirm-restart-modal');
    const confirmRestartBtn = document.getElementById('confirm-restart-btn');


    // --- CodeMirror Instances ---
    let configEditorCM, fileEditorCM;

    // Initialize CodeMirror for config editor
    if (configEditorElement) {
        configEditorCM = CodeMirror.fromTextArea(configEditorElement, {
            mode: "application/json",
            theme: "dracula",
            lineNumbers: true,
            matchBrackets: true,
            autoRefresh: true,
            indentUnit: 2,
            tabSize: 2,
            indentWithTabs: false
        });
        // Make sure CodeMirror updates its internal value when the underlying textarea value changes
        // or when the user changes content directly
        configEditorCM.on('change', () => {
            configEditorElement.value = configEditorCM.getValue();
        });
    }

    // Initialize CodeMirror for file editor
    if (fileEditorElement) {
        fileEditorCM = CodeMirror.fromTextArea(fileEditorElement, {
            mode: "python", // Default mode, will be updated
            theme: "dracula",
            lineNumbers: true,
            matchBrackets: true,
            autoRefresh: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false
        });
        fileEditorCM.on('change', () => {
            fileEditorElement.value = fileEditorCM.getValue();
        });
    }

    // --- Helper to show TOAST messages ---
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : 'success'}`;
        toast.dataset.type = isError ? 'error' : 'success'; // For CSS theming
        toast.textContent = message;
        
        toastContainer.prepend(toast); // Add to top

        setTimeout(() => {
            toast.classList.add('show');
        }, 10); // Small delay to trigger CSS transition

        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide'); // For fade-out effect
            toast.addEventListener('transitionend', () => toast.remove()); // Remove after transition
        }, 5000); // Remove after 5 seconds
    }

    // --- SYSTEM METRICS LOGIC ---
    async function updateSystemMetrics() {
        try {
            const response = await fetch('/admin/api/system-metrics');
            if (!response.ok) {
                // Don't show a big error, just fail silently
                console.error('Failed to fetch system metrics');
                return;
            }
            const metrics = await response.json();
            
            cpuValue.textContent = metrics.cpu.toFixed(1);
            cpuProgress.style.width = `${metrics.cpu}%`;

            ramValue.textContent = metrics.ram.toFixed(1);
            ramProgress.style.width = `${metrics.ram}%`;

            diskValue.textContent = metrics.disk.toFixed(1);
            diskProgress.style.width = `${metrics.disk}%`;

        } catch (error) {
            console.error('Error updating system metrics:', error);
        }
    }

    // --- CONFIG EDITOR LOGIC ---
    async function loadConfig() {
        try {
            const response = await fetch('/admin/api/config');
            if (!response.ok) throw new Error((await response.json()).error || 'Network error');
            const config = await response.json();
            // configEditor.value = JSON.stringify(config, null, 2); // Replaced
            configEditorCM.setValue(JSON.stringify(config, null, 2));
        } catch (error) {
            showToast(`Lỗi khi tải config: ${error.message}`, true);
        }
    }


    saveConfigBtn.addEventListener('click', async () => {
        let newConfig;
        try {
            // newConfig = JSON.parse(configEditor.value); // Replaced
            newConfig = JSON.parse(configEditorCM.getValue());
        } catch (error) {
            showToast('Lỗi: Nội dung không phải là JSON hợp lệ.', true);
            return;
        }

        try {
            const response = await fetch('/admin/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showToast(result.message || 'Cập nhật thành công!');
            await loadConfig();
        } catch (error) {
            showToast(`Lỗi khi lưu config: ${error.message}`, true);
        }
    });

    // --- FILE EDITOR LOGIC ---
    
    let currentOpenFilePath = '';

    function getCodeMirrorMode(filepath) {
        if (filepath.endsWith('.py')) return 'python';
        if (filepath.endsWith('.js')) return 'javascript';
        if (filepath.endsWith('.json')) return 'application/json';
        if (filepath.endsWith('.css')) return 'css';
        if (filepath.endsWith('.html')) return 'htmlmixed';
        if (filepath.endsWith('.md')) return 'gfm'; // Github Flavored Markdown
        return 'text'; // Default
    }

    async function loadFileList(path = '.') {
        try {
            const response = await fetch(`/admin/api/files?path=${encodeURIComponent(path)}`);
            if (!response.ok) throw new Error((await response.json()).error || 'Network error');
            const items = await response.json();
            renderFileBrowser(items, path);
        } catch (error) {
            showToast(`Lỗi khi tải danh sách file: ${error.message}`, true);
        }
    }
    
    function renderFileBrowser(items, currentPath) {
        fileBrowser.innerHTML = '';
        const ul = document.createElement('ul');

        // Add "go up" link if not in root
        if (currentPath !== '.') {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '.';
            const li = document.createElement('li');
            li.innerHTML = `<span class="icon">⬆️</span> ..`;
            li.dataset.path = parentPath;
            li.dataset.type = 'directory';
            ul.appendChild(li);
        }

        items.forEach(item => {
            const li = document.createElement('li');
            const icon = item.type === 'directory' ? '📁' : '📄';
            li.innerHTML = `<span class="icon">${icon}</span> ${item.name}`;
            li.dataset.path = `${currentPath}/${item.name}`.replace('./', '');
            li.dataset.type = item.type;
            ul.appendChild(li);
        });
        fileBrowser.appendChild(ul);
    }
    
    async function loadFileContent(filepath) {
        try {
            const response = await fetch(`/admin/api/file-content?filepath=${encodeURIComponent(filepath)}`);
            if (!response.ok) throw new Error((await response.json()).error || 'Network error');
            const data = await response.json();
            // fileEditor.value = data.content; // Replaced
            fileEditorCM.setValue(data.content);
            fileEditorCM.setOption("mode", getCodeMirrorMode(data.filepath)); // Set mode dynamically
            currentOpenFilePath = data.filepath;
            currentFilepathEl.textContent = data.filepath;
            showToast(`Đã mở file: ${data.filepath}`);
        } catch (error) {
            showToast(`Lỗi khi mở file: ${error.message}`, true);
        }
    }

    fileBrowser.addEventListener('click', e => {
        const target = e.target.closest('li');
        if (!target) return;
        
        const path = target.dataset.path;
        const type = target.dataset.type;

        if (type === 'directory') {
            loadFileList(path);
        } else if (type === 'file') {
            loadFileContent(path);
        }
    });

    saveFileBtn.addEventListener('click', async () => {
        if (!currentOpenFilePath) {
            showToast('Lỗi: Chưa có file nào được mở.', true);
            return;
        }
        
        // const content = fileEditor.value; // Replaced
        const content = fileEditorCM.getValue();

        try {
            const response = await fetch('/admin/api/file-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath: currentOpenFilePath, content: content }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showToast(result.message || 'Lưu file thành công!');
        } catch (error) {
            showToast(`Lỗi khi lưu file: ${error.message}`, true);
        }
    });

    // --- LOG VIEWER LOGIC ---
    async function loadLogs() {
        try {
            const response = await fetch('/admin/api/logs');
            if (!response.ok) throw new Error((await response.json()).error || 'Network error');
            const data = await response.json();
            logContentPre.textContent = data.logs;
            logContentPre.scrollTop = logContentPre.scrollHeight; // Auto-scroll to bottom
            showToast('Log đã được tải lại.');
        } catch (error) {
            showToast(`Lỗi khi tải log: ${error.message}`, true);
        }
    }

    if (refreshLogBtn) {
        refreshLogBtn.addEventListener('click', loadLogs);
    }

    // --- RESTART SERVER LOGIC ---
    if (restartServerBtn && confirmRestartModal && confirmRestartBtn) {
        restartServerBtn.addEventListener('click', () => {
            confirmRestartModal.showModal(); // Show Pico.css modal
        });

        confirmRestartBtn.addEventListener('click', async () => {
            confirmRestartModal.close(); // Close modal immediately
            showToast('Đang khởi động lại server...', false); // Show toast notification
            
            try {
                const response = await fetch('/admin/api/server/restart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                showToast(result.message || 'Server đã được khởi động lại thành công!', false);
                // After restart, page will eventually reload or connection will be lost/re-established
            } catch (error) {
                showToast(`Lỗi khi khởi động lại server: ${error.message}`, true);
            }
        });
    }


    // --- INITIAL LOAD ---
    loadConfig();
    loadFileList();
    updateSystemMetrics(); // Lần chạy đầu tiên
    setInterval(updateSystemMetrics, 3000); // Cập nhật mỗi 3 giây
    loadLogs(); // Lần chạy đầu tiên
    setInterval(loadLogs, 5000); // Cập nhật log mỗi 5 giây
});