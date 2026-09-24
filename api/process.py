import base64
import json
from http.server import BaseHTTPRequestHandler

from processing.pipeline import process_image


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        origin = self.headers.get("Origin")
        host = self.headers.get("Host")

        if origin and origin not in (f"https://{host}", f"http://{host}"):
            self.send_json(403, {"error": "Open the workspace from this site."})
            return

        if not self.headers.get("Content-Type", "").startswith("application/json"):
            self.send_json(415, {"error": "The image request must use JSON."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4_000_000:
                self.send_json(413, {"error": "Choose a smaller image."})
                return

            payload = json.loads(self.rfile.read(length))
            image_bytes = base64.b64decode(payload["image"], validate=True)
            result = process_image(image_bytes, payload.get("options", {}))
            self.send_json(200, result)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(
                500,
                {"error": "The image could not be processed. Try another image."},
            )