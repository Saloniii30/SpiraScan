import base64
import json
import sys

from pipeline import process_image


def main():
    try:
        request = json.load(sys.stdin)
        image_bytes = base64.b64decode(request["image"], validate=True)
        result = process_image(image_bytes, request.get("options", {}))
        response = {"ok": True, "result": result}
    except (ValueError, KeyError, TypeError) as error:
        response = {"ok": False, "error": str(error)}
    except Exception:
        response = {
            "ok": False,
            "error": "The image could not be processed. Try another image.",
        }

    sys.stdout.write(json.dumps(response))


if __name__ == "__main__":
    main()
