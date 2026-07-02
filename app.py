import os
import json
import uuid
import threading
import sys
import webbrowser
from threading import Timer
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_file
import yt_dlp
import re
import os
import signal

if getattr(sys, 'frozen', False):
    application_path = os.path.dirname(sys.executable)
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    application_path = os.path.dirname(os.path.abspath(__file__))
    app = Flask(__name__)

import imageio_ffmpeg

FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()

DOWNLOAD_FOLDER = os.path.join(application_path, 'downloads')
HISTORY_FILE = os.path.join(application_path, 'history.json')

if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

@app.route('/')
def index():
    return render_template('index.html')

def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    return []

def save_history(entry):
    history = load_history()
    history.insert(0, entry) # Add to beginning
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=4, ensure_ascii=False)

@app.route('/api/history', methods=['GET'])
def get_history():
    return jsonify(load_history())

import threading

@app.route('/api/info', methods=['GET'])
def get_info():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist' # Fast fetch for playlists
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if info.get('_type') == 'playlist' or 'entries' in info:
                # It's a playlist
                entries = list(info.get('entries', []))
                
                playlist_thumbnail = info.get('thumbnail')
                if not playlist_thumbnail and entries:
                    first_entry = entries[0]
                    if first_entry.get('thumbnails'):
                        playlist_thumbnail = first_entry.get('thumbnails')[-1].get('url')
                    elif first_entry.get('id'):
                        playlist_thumbnail = f"https://img.youtube.com/vi/{first_entry.get('id')}/hqdefault.jpg"

                return jsonify({
                    'is_playlist': True,
                    'title': info.get('title', 'Unknown Playlist'),
                    'count': len(entries),
                    'thumbnail': playlist_thumbnail,
                    'url': url
                })
            else:
                # It's a single video
                return jsonify({
                    'is_playlist': False,
                    'title': info.get('title'),
                    'thumbnail': info.get('thumbnail'),
                    'duration': info.get('duration'),
                    'url': url
                })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

active_downloads = {}

class DownloadCancelled(Exception):
    pass

def clean_str(s):
    if not isinstance(s, str):
        return str(s)
    s = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', s)
    s = re.sub(r'\[\d+(;\d+)*m', '', s)
    return s.strip()

def get_progress_hook(download_id):
    def hook(d):
        if active_downloads.get(download_id, {}).get('status') == 'cancelled':
            raise DownloadCancelled("User cancelled the download")
            
        if d['status'] == 'downloading':
            active_downloads[download_id] = {
                'status': 'downloading',
                '_percent_str': clean_str(d.get('_percent_str', '0%')),
                '_speed_str': clean_str(d.get('_speed_str', 'Unknown speed')),
                '_eta_str': clean_str(d.get('_eta_str', 'Unknown ETA')),
                'filename': d.get('filename', ''),
                'playlist_index': d.get('info_dict', {}).get('playlist_index') or d.get('playlist_index'),
                'playlist_count': d.get('info_dict', {}).get('playlist_count') or d.get('playlist_count')
            }
        elif d['status'] == 'finished':
            if download_id in active_downloads:
                active_downloads[download_id]['status'] = 'processing' # Merging with ffmpeg
    return hook

@app.route('/api/progress', methods=['GET'])
def get_progress():
    download_id = request.args.get('id')
    if not download_id:
        return jsonify({'error': 'id required'}), 400
    return jsonify(active_downloads.get(download_id, {'status': 'idle'}))

@app.route('/api/cancel', methods=['POST'])
def cancel_download():
    data = request.json or {}
    download_id = data.get('id')
    if download_id in active_downloads:
        active_downloads[download_id]['status'] = 'cancelled'
    return jsonify({'message': 'Cancelled successfully'})

@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    print("Shutting down the server by user request...")
    os.kill(os.getpid(), signal.SIGINT)
    return jsonify({'message': 'Shutting down'})

def run_playlist_download(url, format_selector, download_id):
    ydl_opts = {
        'format': format_selector,
        'outtmpl': os.path.join(DOWNLOAD_FOLDER, '%(playlist_title)s/%(title)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'color': 'no_color',
        'ffmpeg_location': FFMPEG_PATH,
        'merge_output_format': 'mp4',
        'progress_hooks': [get_progress_hook(download_id)]
    }

    if 'bestaudio' in format_selector and 'bestvideo' not in format_selector:
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            active_downloads[download_id] = {'status': 'finished'}
            entries = list(info.get('entries', []))
            playlist_thumbnail = info.get('thumbnail')
            if not playlist_thumbnail and entries:
                first_entry = entries[0]
                if first_entry.get('thumbnails'):
                    playlist_thumbnail = first_entry.get('thumbnails')[-1].get('url')
                elif first_entry.get('id'):
                    playlist_thumbnail = f"https://img.youtube.com/vi/{first_entry.get('id')}/hqdefault.jpg"
                    
            save_history({
                'title': f"[Playlist] {info.get('title', 'Unknown Playlist')}",
                'url': url,
                'format': format_selector,
                'thumbnail': playlist_thumbnail or '',
                'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
    except DownloadCancelled:
        print(f"Download {download_id} cancelled by user.")
    except Exception as e:
        active_downloads[download_id] = {'status': 'error', 'error': str(e)}
        print(f"Error downloading playlist: {e}")

@app.route('/api/download_playlist', methods=['POST'])
def download_playlist_api():
    data = request.json
    url = data.get('url')
    format_selector = data.get('format', 'bestvideo+bestaudio/best')
    download_id = data.get('download_id')
    
    if not url or not download_id:
        return jsonify({'error': 'URL and download_id are required'}), 400

    active_downloads[download_id] = {'status': 'initializing'}
    thread = threading.Thread(target=run_playlist_download, args=(url, format_selector, download_id))
    thread.start()
    
    return jsonify({'message': 'Playlist download started in background'})

def run_video_download(url, format_selector, download_id):
    file_id = str(uuid.uuid4())
    output_template = os.path.join(DOWNLOAD_FOLDER, f'{file_id}_%(title)s.%(ext)s')

    ydl_opts = {
        'format': format_selector,
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'color': 'no_color',
        'ffmpeg_location': FFMPEG_PATH,
        'merge_output_format': 'mp4',
        'progress_hooks': [get_progress_hook(download_id)]
    }

    if 'bestaudio' in format_selector and 'bestvideo' not in format_selector:
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            downloaded_file = None
            for f in os.listdir(DOWNLOAD_FOLDER):
                if f.startswith(file_id):
                    downloaded_file = os.path.join(DOWNLOAD_FOLDER, f)
                    break
            
            if downloaded_file and os.path.exists(downloaded_file):
                actual_filename = os.path.basename(downloaded_file)
                original_title = actual_filename[len(file_id) + 1:]
                
                save_history({
                    'title': info.get('title', 'Unknown Title'),
                    'url': url,
                    'format': format_selector,
                    'thumbnail': info.get('thumbnail', ''),
                    'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
                
                active_downloads[download_id] = {
                    'status': 'finished',
                    'file_path': downloaded_file,
                    'original_title': original_title
                }
            else:
                active_downloads[download_id] = {'status': 'error', 'error': 'File not found after download'}
    except DownloadCancelled:
        print(f"Download {download_id} cancelled by user.")
    except Exception as e:
        active_downloads[download_id] = {'status': 'error', 'error': str(e)}

@app.route('/api/start_download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url')
    format_selector = data.get('format', 'bestvideo+bestaudio/best')
    download_id = data.get('download_id')
    
    if not url or not download_id:
        return jsonify({'error': 'URL and download_id are required'}), 400

    active_downloads[download_id] = {'status': 'initializing'}
    thread = threading.Thread(target=run_video_download, args=(url, format_selector, download_id))
    thread.start()
    
    return jsonify({'message': 'Download started'})

@app.route('/api/serve_file', methods=['GET'])
def serve_file():
    download_id = request.args.get('id')
    if not download_id or download_id not in active_downloads:
        return "Invalid download ID", 400
        
    download_data = active_downloads[download_id]
    if download_data.get('status') != 'finished' or 'file_path' not in download_data:
        return "File not ready", 400
        
    return send_file(download_data['file_path'], as_attachment=True, download_name=download_data['original_title'])

if __name__ == '__main__':
    Timer(1.5, lambda: webbrowser.open_new("http://localhost:5000/")).start()
    app.run(port=5000)
