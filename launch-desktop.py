import os
import sys
import subprocess
import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 58242
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVE_DIR = os.path.join(ROOT_DIR, 'dist') if os.path.exists(os.path.join(ROOT_DIR, 'dist')) else ROOT_DIR

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SERVE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

def run_server():
    server = HTTPServer(('127.0.0.1', PORT), CORSRequestHandler)
    print(f'[VidAmp Player Server] Running at http://127.0.0.1:{PORT}')
    server.serve_forever()

def find_browser_app():
    candidates = [
        os.path.expandvars(r'%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe'),
        os.path.expandvars(r'%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe'),
        os.path.expandvars(r'%PROGRAMFILES%\Google\Chrome\Application\chrome.exe'),
        os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
        os.path.expandvars(r'%PROGRAMFILES%\BraveSoftware\Brave-Browser\Application\brave.exe')
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def main():
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(0.4)

    target_url = f'http://127.0.0.1:{PORT}/index.html'

    # Check if electron exists
    electron_bin = os.path.join(ROOT_DIR, 'node_modules', 'electron', 'dist', 'electron.exe')
    if os.path.exists(electron_bin):
        print('[VidAmp Player] Launching via Electron desktop process...')
        subprocess.run([electron_bin, os.path.join(ROOT_DIR, 'electron', 'main.js')])
        return

    # Fallback to Standalone App Window Mode
    browser = find_browser_app()
    if browser:
        print(f'[VidAmp Player] Launching Standalone Desktop Window: {browser}')
        app_flags = [
            f'--app={target_url}',
            '--window-size=1280,820',
            '--disable-features=Translate',
            '--disable-component-update'
        ]
        subprocess.run([browser] + app_flags)
    else:
        import webbrowser
        webbrowser.open(target_url)

if __name__ == '__main__':
    main()
