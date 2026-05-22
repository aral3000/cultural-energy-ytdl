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
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch video info');
            }

            currentUrl = data.url;
            window.isPlaylist = data.is_playlist;
            
            if (data.is_playlist) {
                thumbnail.src = data.thumbnail || 'https://img.youtube.com/vi/default/hqdefault.jpg'; // use playlist thumbnail or fallback
                videoTitle.textContent = `[Playlist] ${data.title}`;
                videoDuration.textContent = `Videos: ${data.count}`;
                downloadBtn.textContent = 'DOWNLOAD PLAYLIST TO LOCAL FOLDER';
            } else {
                thumbnail.src = data.thumbnail || '';
                videoTitle.textContent = data.title || 'Unknown Title';
                videoDuration.textContent = `Duration: ${formatTime(data.duration)}`;
                downloadBtn.textContent = 'DOWNLOAD_FILE';
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
        
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = 'Initializing...';

        if (progressInterval) clearInterval(progressInterval);

        progressInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/progress?id=${encodeURIComponent(downloadId)}`);
                const data = await response.json();

                if (data.status === 'downloading') {
                    progressBar.style.width = data._percent_str.replace('%', '') + '%';
                    progressText.textContent = `Downloading: ${data._percent_str} at ${data._speed_str} (ETA: ${data._eta_str})`;
                } else if (data.status === 'processing') {
                    progressBar.style.width = '100%';
                    progressText.textContent = 'Processing & Merging... Please wait.';
                } else if (data.status === 'finished') {
                    clearInterval(progressInterval);
                    progressBar.style.width = '100%';
                    progressText.textContent = 'Completed!';
                    localStorage.removeItem('activeDownload');
                    loadHistory();
                    
                    if (!window.isPlaylist) {
                        window.location.href = `/api/serve_file?id=${encodeURIComponent(downloadId)}`;
                    }
                    setTimeout(() => {
                        progressContainer.classList.add('hidden');
                        downloadBtn.textContent = window.isPlaylist ? 'DOWNLOAD PLAYLIST TO LOCAL FOLDER' : 'DOWNLOAD_FILE';
                        downloadBtn.disabled = false;
                    }, 3000);
                } else if (data.status === 'error') {
                    clearInterval(progressInterval);
                    progressText.textContent = 'Error: ' + data.error;
                    localStorage.removeItem('activeDownload');
                    downloadBtn.textContent = window.isPlaylist ? 'DOWNLOAD PLAYLIST TO LOCAL FOLDER' : 'DOWNLOAD_FILE';
                    downloadBtn.disabled = false;
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
        downloadBtn.textContent = 'INITIATING_DOWNLOAD...';
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
            
            if (!response.ok) {
                const data = await response.json();
                showError(data.error || 'Failed to start download');
                clearInterval(progressInterval);
                document.getElementById('progressContainer').classList.add('hidden');
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
                div.innerHTML = `
                    <div class="history-title">${item.title}</div>
                    <div class="history-meta">URL: ${item.url}</div>
                    <div class="history-meta">Format ID: ${item.format} | Date: ${item.date}</div>
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
            downloadBtn.textContent = 'RESUMING_PROGRESS...';
            downloadBtn.disabled = true;
            
            result.classList.remove('hidden');
            startProgressPolling(data.downloadId, data.format);
        } catch (e) {
            localStorage.removeItem('activeDownload');
        }
    }
});
