
import io
import unittest

import cv2
import numpy as np
from PIL import Image

from pipeline import process_image


def png_bytes(image):
    success, data = cv2.imencode(".png", image)
    if not success:
        raise RuntimeError("Could not encode the test image.")
    return data.tobytes()


class ProcessingTests(unittest.TestCase):
    def test_spiral_produces_eight_stages_and_foreground(self):
        drawing = np.full((600, 800, 3), 255, dtype=np.uint8)
        points = []

        for angle in np.linspace(0, 7 * np.pi, 900):
            radius = 8 + 9 * angle
            x = round(400 + radius * np.cos(angle))
            y = round(300 + radius * np.sin(angle))
            points.append([x, y])

        cv2.polylines(drawing, [np.array(points)], False, (0, 0, 0), 3)

        for method in ["adaptive", "otsu"]:
            with self.subTest(method=method):
                result = process_image(png_bytes(drawing), {"threshold": method})
                self.assertEqual(len(result["stages"]), 8)
                self.assertGreater(result["metrics"]["foregroundPercent"], 0.1)
                self.assertGreater(result["metrics"]["contours"], 0)
                self.assertTrue(result["stages"][0]["image"].startswith("data:image/png;base64,"))

    def test_blank_image_has_no_foreground_and_a_review_note(self):
        blank = np.full((400, 400, 3), 255, dtype=np.uint8)
        result = process_image(png_bytes(blank))
        self.assertEqual(result["metrics"]["foregroundPercent"], 0)
        self.assertTrue(any("blank" in note for note in result["reviewNotes"]))

    def test_resize_and_rotation_preserve_proportions(self):
        drawing = np.full((800, 1600, 3), 255, dtype=np.uint8)
        result = process_image(png_bytes(drawing), {"rotation": 90})
        self.assertEqual(result["metrics"]["processedWidth"], 600)
        self.assertEqual(result["metrics"]["processedHeight"], 1200)

    def test_transparent_pixels_become_white(self):
        source = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        buffer = io.BytesIO()
        source.save(buffer, format="PNG")
        result = process_image(buffer.getvalue())
        self.assertEqual(result["metrics"]["brightness"], 255)

    def test_exif_orientation_is_applied(self):
        source = Image.new("RGB", (100, 200), "white")
        orientation = source.getexif()
        orientation[274] = 6
        buffer = io.BytesIO()
        source.save(buffer, format="JPEG", exif=orientation)
        result = process_image(buffer.getvalue())
        self.assertEqual(result["metrics"]["sourceWidth"], 200)
        self.assertEqual(result["metrics"]["sourceHeight"], 100)

    def test_bad_image_and_options_are_rejected(self):
        with self.assertRaises(ValueError):
            process_image(b"not an image")

        blank = png_bytes(np.full((100, 100, 3), 255, dtype=np.uint8))

        with self.assertRaises(ValueError):
            process_image(blank, {"blur": 4})

        with self.assertRaises(ValueError):
            process_image(blank, {"rotation": 45})

    def test_tiny_and_oversized_images_are_rejected(self):
        tiny = png_bytes(np.full((32, 32, 3), 255, dtype=np.uint8))

        with self.assertRaises(ValueError):
            process_image(tiny)

        with self.assertRaises(ValueError):
            process_image(b"0" * (10 * 1024 * 1024 + 1))


if __name__ == "__main__":
    unittest.main()
