import base64
import io
import warnings

import cv2
import numpy as np
from PIL import Image, ImageOps


MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MAX_PROCESSING_SIDE = 1200
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def read_image(image_bytes):
    if not image_bytes or len(image_bytes) > MAX_FILE_BYTES:
        raise ValueError("Choose an image smaller than 10 MB.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)

            with Image.open(io.BytesIO(image_bytes)) as source:
                if source.format not in ALLOWED_FORMATS:
                    raise ValueError("Use a JPEG, PNG, or WebP image.")

                width, height = source.size

                if width * height > MAX_IMAGE_PIXELS:
                    raise ValueError("Choose an image with at most 20 million pixels.")

                if min(width, height) < 64:
                    raise ValueError("The image must be at least 64 pixels on each side.")

                if getattr(source, "n_frames", 1) > 1:
                    raise ValueError("Use a still image, not an animated image.")

                oriented = ImageOps.exif_transpose(source)
                foreground = oriented.convert("RGBA")
                background = Image.new("RGBA", foreground.size, "white")
                background.alpha_composite(foreground)
                rgb_image = background.convert("RGB")

    except ValueError:
        raise
    except Exception as error:
        raise ValueError("This file could not be read as an image.") from error

    image = cv2.cvtColor(np.array(rgb_image), cv2.COLOR_RGB2BGR)
    return image


def encode_preview(image):
    """Return a PNG data URL that the browser can display and download."""
    success, encoded = cv2.imencode(".png", image)

    if not success:
        raise ValueError("A preview could not be created.")

    image_text = base64.b64encode(encoded.tobytes()).decode("ascii")
    return "data:image/png;base64," + image_text


def process_image(image_bytes, options=None):
    """Run the selected preprocessing steps and explain the resulting images."""
    options = options or {}
    threshold_method = options.get("threshold", "adaptive")
    blur_size = options.get("blur", 3)
    rotation = options.get("rotation", 0)
    minimum_component = options.get("minimumComponent", 8)

    if threshold_method not in {"adaptive", "otsu"}:
        raise ValueError("Choose adaptive or Otsu thresholding.")

    if blur_size not in {3, 5, 7}:
        raise ValueError("Choose a blur size of 3, 5, or 7.")

    if rotation not in {0, 90, 180, 270}:
        raise ValueError("Rotation must be 0, 90, 180, or 270 degrees.")

    if minimum_component not in {0, 8, 20}:
        raise ValueError("Choose a speck removal size of 0, 8, or 20 pixels.")

    original = read_image(image_bytes)
    original_height, original_width = original.shape[:2]

    # Keep the aspect ratio while limiting processing time and preview size.
    scale = min(1.0, MAX_PROCESSING_SIDE / max(original_width, original_height))
    resized_width = max(1, round(original_width * scale))
    resized_height = max(1, round(original_height * scale))
    resized = cv2.resize(
        original,
        (resized_width, resized_height),
        interpolation=cv2.INTER_AREA,
    )

    rotation_codes = {
        90: cv2.ROTATE_90_CLOCKWISE,
        180: cv2.ROTATE_180,
        270: cv2.ROTATE_90_COUNTERCLOCKWISE,
    }

    working_image = resized.copy()

    if rotation:
        working_image = cv2.rotate(working_image, rotation_codes[rotation])

    grayscale = cv2.cvtColor(working_image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(grayscale, (blur_size, blur_size), 0)

    # Dark ink becomes white foreground in the mask used for measurement.
    if threshold_method == "adaptive":
        ink_mask = cv2.adaptiveThreshold(
            blurred,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            31,
            10,
        )
    else:
        _, ink_mask = cv2.threshold(
            blurred,
            0,
            255,
            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
        )

    count, labels, statistics, _ = cv2.connectedComponentsWithStats(
        ink_mask,
        connectivity=8,
    )
    # A lookup table filters all labels in one pass, including noisy photographs.
    kept_labels = np.zeros(count, dtype=np.uint8)
    retained_components = 0
    removed_components = 0

    for label in range(1, count):
        area = statistics[label, cv2.CC_STAT_AREA]

        if area >= minimum_component:
            kept_labels[label] = 255
            retained_components += 1
        else:
            removed_components += 1

    cleaned_mask = kept_labels[labels]

    # These are boundary edges, not a reconstructed pen trajectory.
    edges = cv2.Canny(cleaned_mask, 50, 150)
    contours, _ = cv2.findContours(
        cleaned_mask,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    overlay = working_image.copy()
    cv2.drawContours(overlay, contours, -1, (50, 170, 20), 1)

    height, width = grayscale.shape
    coverage = 100 * cv2.countNonZero(cleaned_mask) / cleaned_mask.size
    brightness = float(np.mean(grayscale))
    contrast = float(np.std(grayscale))
    sharpness = float(cv2.Laplacian(grayscale, cv2.CV_64F).var())
    review_notes = []

    if min(original_width, original_height) < 300:
        review_notes.append("The source is small. A higher-resolution image may show finer lines.")

    if contrast < 15:
        review_notes.append("The image has low contrast. Try darker ink and more even lighting.")

    if brightness < 90:
        review_notes.append("The image is dark. Photograph dark ink on light paper in better lighting.")

    if sharpness < 30:
        review_notes.append("The focus score is low. Check the original for blur or a nearly blank image.")

    if coverage < 0.1:
        review_notes.append("Very little foreground was found. Check for a blank or faint drawing.")

    if coverage > 35:
        review_notes.append("A large foreground area was found. Shadows or background objects may be included.")

    if retained_components > 40:
        review_notes.append("Many separate regions were found. Check for text, noise, or broken lines.")

    if not review_notes:
        review_notes.append("No basic image-quality flags were triggered. Visually review every stage.")

    stage_images = [
        (
            "original",
            "Original preview",
            "Camera orientation corrected; scaled to fit the preview.",
            resized,
        ),
        (
            "prepared",
            "Prepared image",
            "Your selected rotation, with proportions preserved.",
            working_image,
        ),
        (
            "grayscale",
            "Grayscale",
            "Color is converted to intensity for line processing.",
            grayscale,
        ),
        (
            "blurred",
            "Noise reduction",
            "Gaussian blur smooths small intensity variations.",
            blurred,
        ),
        (
            "threshold",
            "Threshold",
            "Dark foreground separated from the lighter background.",
            cv2.bitwise_not(ink_mask),
        ),
        (
            "cleaned",
            "Cleaned drawing",
            "Small disconnected regions removed using your setting.",
            cv2.bitwise_not(cleaned_mask),
        ),
        (
            "edges",
            "Edges",
            "Canny edges show the boundaries of detected foreground.",
            edges,
        ),
        (
            "overlay",
            "Contour review",
            "Green outlines mark foreground boundaries, not disease features.",
            overlay,
        ),
    ]

    stages = []

    for stage_id, title, description, image in stage_images:
        stages.append({
            "id": stage_id,
            "title": title,
            "description": description,
            "image": encode_preview(image),
        })

    return {
        "stages": stages,
        "metrics": {
            "sourceWidth": original_width,
            "sourceHeight": original_height,
            "processedWidth": width,
            "processedHeight": height,
            "foregroundPercent": round(coverage, 2),
            "brightness": round(brightness, 2),
            "contrast": round(contrast, 2),
            "focusScore": round(sharpness, 2),
            "retainedComponents": retained_components,
            "removedComponents": removed_components,
            "contours": len(contours),
        },
        "settings": {
            "threshold": threshold_method,
            "blur": blur_size,
            "rotation": rotation,
            "minimumComponent": minimum_component,
            "maximumSide": MAX_PROCESSING_SIDE,
        },
        "reviewNotes": review_notes,
        "opencvVersion": cv2.__version__,
        "notice": "Image preprocessing only. No spiral recognition or disease prediction is performed.",
    }
