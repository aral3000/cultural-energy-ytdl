document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loader = document.getElementById('loader');
    const result = document.getElementById('result');
    const errorBox = document.getElementById('errorBox');
    
    const thumbnail = document.getElementById('thumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const videoDuration = document.getElementById('videoDuration');
    const formatSelect = document.getElementById('formatSelect');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentUrl = '';

    function formatTime(seconds) {
        if (!seconds) return 'Unknown';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m > 9 ? m : h ? '0' + m : m || '0', s > 9 ? s : '0' + s]
            .filter(a => a).join(':');
    }

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
    }

    function hideError() {
        errorBox.classList.add('hidden');
        errorBox.textContent = '';
    }

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            analyzeBtn.click();
        }
    });

    analyzeBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showError('Please enter a valid YouTube URL.');
            return;
        }

        hideError();
        result.classList.add('hidden');
        loader.classList.remove('hidden');
        analyzeBtn.disabled = true;

        try {
            const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                throw new Error('Invalid server response');
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch video info');
            }

            currentUrl = data.url;
            window.isPlaylist = data.is_playlist;
            
            if (data.is_playlist) {
                thumbnail.src = data.thumbnail || ''; // fallback empty instead of broken image
                videoTitle.textContent = `[Playlist] ${data.title}`;
                videoDuration.textContent = `Videos: ${data.count}`;
                downloadBtn.textContent = 'DOWNLOAD PLAYLIST TO LOCAL FOLDER';
            } else {
                thumbnail.src = data.thumbnail || '';
                videoTitle.textContent = data.title || 'Unknown Title';
                videoDuration.textContent = `Duration: ${formatTime(data.duration)}`;
                downloadBtn.textContent = 'DOWNLOAD SINGLE VIDEO';
            }

            // Populate advanced smart formats
            formatSelect.innerHTML = '';
            
            const options = [
                { value: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', text: 'Best Quality (Auto 4K/1080p) - MP4' },
                { value: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', text: '1080p (FHD) - MP4' },
                { value: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', text: '720p (HD) - MP4' },
                { value: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', text: '480p (SD) - MP4' },
                { value: 'bestaudio/best', text: 'Audio Only (MP3)' }
            ];

            options.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.value;
                opt.textContent = optData.text;
                formatSelect.appendChild(opt);
            });

            loader.classList.add('hidden');
            result.classList.remove('hidden');
        } catch (err) {
            loader.classList.add('hidden');
            showError(err.message);
        } finally {
            analyzeBtn.disabled = false;
        }
    });

    let progressInterval = null;

    function startProgressPolling(downloadId, format) {
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const cancelBtn = document.getElementById('cancelBtn');
        
        progressContainer.classList.remove('hidden');
        cancelBtn.classList.remove('hidden'); // Show cancel button
        progressBar.style.width = '0%';
        progressText.textContent = 'Initializing...';

        if (progressInterval) clearInterval(progressInterval);

        // Cancel handler
        const cancelHandler = async () => {
            clearInterval(progressInterval);
            localStorage.removeItem('activeDownload');
            progressText.textContent = 'Cancelling...';
            cancelBtn.classList.add('hidden');
            
            try {
                await fetch('/api/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: downloadId })
                });
            } catch (err) {}
            
            progressContainer.classList.add('hidden');
            downloadBtn.textContent = window.isPlaylist ? 'DOWNLOAD PLAYLIST TO LOCAL FOLDER' : 'DOWNLOAD SINGLE VIDEO';
            downloadBtn.disabled = false;
        };

        // Remove old listener if exists, add new
        cancelBtn.onclick = cancelHandler;

        progressInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/progress?id=${encodeURIComponent(downloadId)}`);
                if (!response.ok) return;
                const data = await response.json();

                if (data.status === 'downloading') {
                    const percentStr = data._percent_str || '0%';
                    const speedStr = data._speed_str || 'Unknown speed';
                    const etaStr = data._eta_str || 'Unknown ETA';
                    
                    let textMsg = `Downloading: ${percentStr} at ${speedStr} (ETA: ${etaStr})`;
                    if (data.playlist_index && data.playlist_count) {
                        textMsg = `[Video ${data.playlist_index} of ${data.playlist_count}] ` + textMsg;
                    }
                    
                    progressBar.style.width = percentStr.replace('%', '') + '%';
                    progressText.textContent = textMsg;
                } else if (data.status === 'processing') {
                    progressBar.style.width = '100%';
                    progressText.textContent = 'Processing & Merging... Please wait.';
                    cancelBtn.classList.add('hidden'); // Hide cancel when processing
                } else if (data.status === 'finished') {
                    clearInterval(progressInterval);
                    progressBar.style.width = '100%';
                    progressText.textContent = 'Completed!';
                    cancelBtn.classList.add('hidden');
                    localStorage.removeItem('activeDownload');
                    loadHistory();
                    
                    if (!window.isPlaylist) {
                        // Buka folder downloads langsung di Windows Explorer
                        fetch('/api/open_folder', { method: 'POST' }).catch(() => {});
                    } else {
                        fetch('/api/open_folder', { method: 'POST' }).catch(() => {});
                    }
                    setTimeout(() => {
                        progressContainer.classList.add('hidden');
                        downloadBtn.textContent = window.isPlaylist ? 'DOWNLOAD PLAYLIST TO LOCAL FOLDER' : 'DOWNLOAD SINGLE VIDEO';
                        downloadBtn.disabled = false;
                    }, 3000);
                } else if (data.status === 'error' || data.status === 'cancelled' || data.status === 'idle') {
                    clearInterval(progressInterval);
                    if (data.status === 'idle') {
                        progressText.textContent = 'Download stopped (Server was restarted).';
                    } else if (data.status === 'cancelled') {
                        progressText.textContent = 'Download Cancelled.';
                    } else {
                        progressText.textContent = 'Error: ' + data.error;
                    }
                    cancelBtn.classList.add('hidden');
                    localStorage.removeItem('activeDownload');
                    setTimeout(() => {
                        progressContainer.classList.add('hidden');
                        downloadBtn.textContent = window.isPlaylist ? 'DOWNLOAD PLAYLIST TO LOCAL FOLDER' : 'DOWNLOAD SINGLE VIDEO';
                        downloadBtn.disabled = false;
                    }, 3000);
                }
            } catch (err) {
                console.error("Progress polling error", err);
            }
        }, 1000);
    }

    // Generate UUID v4 logic for frontend
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    downloadBtn.addEventListener('click', async () => {
        const format = formatSelect.value;
        if (!currentUrl) return;

        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = 'INITIATING DOWNLOAD...';
        downloadBtn.disabled = true;

        const downloadId = generateUUID();
        
        localStorage.setItem('activeDownload', JSON.stringify({
            downloadId: downloadId,
            url: currentUrl,
            isPlaylist: window.isPlaylist,
            title: videoTitle.textContent,
            thumbnail: thumbnail.src,
            duration: videoDuration.textContent,
            format: format
        }));
        
        startProgressPolling(downloadId, format);

        const endpoint = window.isPlaylist ? '/api/download_playlist' : '/api/start_download';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: currentUrl, format: format, download_id: downloadId })
            });
            
            let data;
            try {
                data = await response.json();
            } catch(e) {
                data = { error: 'Invalid server response' };
            }
            
            if (!response.ok) {
                showError(data.error || 'Failed to start download');
                clearInterval(progressInterval);
                document.getElementById('progressContainer').classList.add('hidden');
                document.getElementById('cancelBtn').classList.add('hidden');
                downloadBtn.textContent = window.isPlaylist ? 'DOWNLOAD PLAYLIST TO LOCAL FOLDER' : 'DOWNLOAD SINGLE VIDEO';
                downloadBtn.disabled = false;
                localStorage.removeItem('activeDownload');
            }
        } catch (err) {
            showError('Network error starting download');
            clearInterval(progressInterval);
        }
    });

    const historyList = document.getElementById('historyList');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

    async function loadHistory() {
        try {
            const response = await fetch('/api/history');
            const history = await response.json();
            
            historyList.innerHTML = '';
            
            if (history.length === 0) {
                historyList.innerHTML = '<p style="color: #555; text-align: center;">No downloads yet.</p>';
                return;
            }

            history.forEach(item => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.gap = '15px';
                
                const thumbHtml = item.thumbnail ? `<img src="${item.thumbnail}" style="width: 120px; height: 68px; object-fit: cover; border-radius: 4px; border: 1px solid var(--primary-color);">` : `<div style="width: 120px; height: 68px; background: rgba(0,0,0,0.5); border-radius: 4px; border: 1px solid var(--primary-color); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; color: #aaa; text-align: center; line-height: 1.2;"><span style="font-size: 16px; font-weight: bold; color: var(--primary-color); margin-bottom: 2px;">!</span><span>Thumbnail</span><span>Not Found</span></div>`;

                div.innerHTML = `
                    ${thumbHtml}
                    <div style="flex-grow: 1;">
                        <div class="history-title" style="margin-bottom: 5px;">${item.title}</div>
                        <div class="history-meta">URL: ${item.url}</div>
                        <div class="history-meta">Format ID: ${item.format} | Date: ${item.date}</div>
                    </div>
                `;
                historyList.appendChild(div);
            });
        } catch (err) {
            console.error('Failed to load history', err);
        }
    }

    refreshHistoryBtn.addEventListener('click', loadHistory);
    
    // Load history on initial page load
    loadHistory();
    
    // Restore active download if any
    const savedDownload = localStorage.getItem('activeDownload');
    if (savedDownload) {
        try {
            const data = JSON.parse(savedDownload);
            currentUrl = data.url;
            window.isPlaylist = data.isPlaylist;
            urlInput.value = data.url;
            
            thumbnail.src = data.thumbnail;
            videoTitle.textContent = data.title;
            videoDuration.textContent = data.duration;
            downloadBtn.textContent = 'RESUMING PROGRESS...';
            downloadBtn.disabled = true;
            
            result.classList.remove('hidden');
            startProgressPolling(data.downloadId, data.format || 'bestvideo+bestaudio/best');
        } catch (e) {
            localStorage.removeItem('activeDownload');
        }
    }
    
    // Shutdown Button Logic
    const shutdownBtn = document.getElementById('shutdownBtn');
    if (shutdownBtn) {
        shutdownBtn.addEventListener('click', () => {
            const modal = document.getElementById('customModal');
            const confirmBtn = document.getElementById('modalConfirmBtn');
            const cancelBtn = document.getElementById('modalCancelBtn');
            
            modal.classList.remove('hidden');
            
            const closeModal = () => modal.classList.add('hidden');
            
            cancelBtn.onclick = closeModal;
            
            confirmBtn.onclick = async () => {
                closeModal();
                try {
                    await fetch('/api/shutdown', { method: 'POST' });
                } catch (e) {
                    // Usually fetch fails if server shuts down instantly
                }
                document.body.innerHTML = `
                    <div style="text-align:center; padding: 50px; color: #39ff14; font-family: 'Orbitron', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
                        <h2 style="font-size: 2em; margin-bottom: 20px;">Aplikasi Telah Dimatikan.</h2>
                        <p style="color: #e0e0e0;">Anda sekarang bisa menutup tab browser ini dengan aman.</p>
                    </div>
                `;
                setTimeout(() => window.close(), 1000);
            };
        });
    }
});
