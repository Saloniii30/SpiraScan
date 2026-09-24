# Image processing in SpiraScan

This module uses Python, OpenCV, NumPy, and Pillow. It runs locally and does not
save uploaded images or send them to Supabase. Node sends image bytes to Python
through standard input. Python returns PNG previews and a JSON review report.

## Processing steps

1. Check file format, byte size, dimensions, and whether the image is animated.
2. Correct camera orientation and place transparent pixels on white paper.
3. Resize proportionally to a maximum side of 1,200 pixels.
4. Apply the rotation selected in the interface.
5. Convert the prepared image to grayscale.
6. Apply Gaussian blur with a 3, 5, or 7 pixel kernel.
7. Separate dark ink using adaptive Gaussian or Otsu thresholding.
8. Optionally remove disconnected regions smaller than 8 or 20 pixels.
9. Detect boundary edges with Canny and draw contours on the prepared image.
10. Return every stage, processing settings, and basic image-quality measurements.

Adaptive thresholding uses a 31 pixel neighborhood and a constant of 10.
Otsu thresholding selects a global threshold from the image histogram.
See the [OpenCV thresholding tutorial](https://docs.opencv.org/4.12.0/d7/d4d/tutorial_py_thresholding.html).

## What the measurements mean

- Brightness is the mean grayscale value, from 0 to 255.
- Contrast is the standard deviation of grayscale intensity.
- Focus score is the variance of the grayscale Laplacian at processing resolution.
- Foreground coverage is the fraction of pixels retained in the cleaned ink mask.
- Components are separate connected regions in that mask.
- Contours are boundaries, including inner boundaries of enclosed regions.

The review flags use simple demonstration thresholds, not validated quality or
clinical standards. Scores depend on lighting, camera, resizing, and settings.
Noise removal may erase genuine small marks. Blur may soften fine handwriting.
Always compare processed stages with the original before using the output later.

This workflow does not identify whether an image contains a spiral, reconstruct
the pen's movement, quantify clinical tremor, or diagnose Parkinson's disease.
