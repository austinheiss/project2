"""
Serves the project at http://localhost:8000 with caching off, so Safari never
runs stale js/css. Run: python3 tools/serve.py [port]
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def send_head(self):
        # never answer "304, use your cached copy"
        del self.headers["If-Modified-Since"]
        return super().send_head()


if __name__ == "__main__":
    print(f"Serving {os.path.abspath(ROOT)} at http://localhost:{PORT}  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
