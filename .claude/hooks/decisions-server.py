#!/usr/bin/env python3
"""
Minimal local server so review.html can save decisions.json silently
(no OS save dialog). Listens on 127.0.0.1 only.
"""
import http.server
import os

PORT = 8765
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
DECISIONS_PATH = os.path.join(PROJECT_DIR, ".claude", "test-plans", "decisions.json")


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        # file:// pages send Origin: null — allow it explicitly.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/save":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        os.makedirs(os.path.dirname(DECISIONS_PATH), exist_ok=True)
        with open(DECISIONS_PATH, "wb") as f:
            f.write(body)

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def do_GET(self):
        # simple liveness check used by the launcher script
        if self.path == "/ping":
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b"pong")
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    def log_message(self, format, *args):
        pass  # keep stdout quiet; launcher script redirects to its own log


if __name__ == "__main__":
    server = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    server.serve_forever()