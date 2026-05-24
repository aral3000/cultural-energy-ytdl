<div align="center">
  <img src="assets/banner.png" alt="Pro Media Downloader" width="100%">
  <br>
  
  <h1>Pro Media Downloader</h1>
  
  <p>
    <strong>A next-generation, asynchronous, and robust YouTube downloader built with Flask, yt-dlp, and FFmpeg.</strong>
  </p>
  
  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a> •
    <a href="#portable-release">Portable Release</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
    <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask">
    <img src="https://img.shields.io/badge/yt--dlp-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="yt-dlp">
    <img src="https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white" alt="FFmpeg">
  </p>
</div>

---

## ⚡ Features

- **Asynchronous Downloads**: Download single videos or entire playlists without freezing your browser. Monitor real-time progress, speed, and ETA right from the UI.
- **Playlist Support**: Automatically extract info and download dozens of videos in the background straight to your local folder.
- **4K/1080p Resolution via FFmpeg**: Seamlessly merge high-resolution separate video tracks (1080p and up) and audio tracks into a single MP4 using the integrated FFmpeg engine.
- **Smart UI Persistence**: The application utilizes browser `localStorage` to save your download state. You can safely refresh the page without aborting the background download!
- **Sleek Adaptive UI**: A modern, deep-sea themed interface that is fully responsive on desktop and mobile devices.
- **Keyboard Friendly**: Auto-focus on URL input and `Enter` key execution for ultra-fast workflows.

## 🚀 Quick Start (Portable Version)

If you just want to use the application without installing Python or dealing with code, download the compiled `.exe` package!

1. Go to the [Releases](../../releases) tab on this GitHub page.
2. Download `Pro_Media_Downloader.zip`.
3. Extract the folder to your computer.
4. Double-click `Pro_Media_Downloader.exe` — the web interface will automatically open in your browser!

---

## 💻 Developer Installation

If you want to run this project from the source code, follow these steps:

### Prerequisites
- Python 3.8+
- [FFmpeg](https://ffmpeg.org/download.html) (Ensure it's either in your system PATH or configure `FFMPEG_PATH` in `app.py`)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cultural-energy-ytdl.git
   cd cultural-energy-ytdl
   ```

2. **Create a Virtual Environment (Optional but recommended)**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**
   ```bash
   python app.py
   ```
   *The server will start on `http://localhost:5000` and automatically open your default web browser.*

---

## 🎨 UI Preview
> *A cutting-edge dark interface tailored for productivity and aesthetics.*
<br>
<div align="center">
  <img src="assets/banner.png" alt="UI Screenshot Placeholder" width="80%">
</div>

---

## 🛠️ Tech Stack
- **Backend**: Python, Flask, Threading
- **Core Engine**: `yt-dlp` (Video Extraction), `FFmpeg` (Video/Audio Merging)
- **Frontend**: HTML5, Vanilla CSS3 (Responsive Grid/Flexbox), Vanilla JavaScript (Async Fetch/DOM Manipulation)

## 📜 License
This project is open-source and available under the [MIT License](LICENSE).
