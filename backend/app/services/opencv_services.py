from pathlib import Path
import cv2
import numpy as np

PROCESSED_DIR = Path("processed")
PROCESSED_DIR.mkdir(exist_ok=True)


def process_image(file_path: str) -> str:
    """
    Aggressive image enhancement pipeline optimised for blurry phone photos
    of printed documents (Hindi/Punjabi/English text on white paper).

    Steps:
      1. Read & upscale small/blurry images (2x if shorter side < 1200 px)
      2. Convert to grayscale
      3. CLAHE (adaptive contrast)
      4. Bilateral filter  — removes noise while keeping text edges crisp
      5. Unsharp mask     — recovers sharpness lost by blur
      6. Adaptive threshold -> clean black-and-white text image
      7. Light dilation   — fills tiny gaps in thin strokes
      8. Save as high-quality PNG (lossless, no JPEG artefacts)
    """
    source = Path(file_path)
    # Save as PNG to avoid recompression artefacts
    destination = PROCESSED_DIR / (source.stem + "_processed.png")

    # 1. Read image
    image = cv2.imread(str(source))
    if image is None:
        raise ValueError(f"Could not read the image file: {source}")

    # 2. Upscale if resolution is too low (blurry phone shots)
    h, w = image.shape[:2]
    min_side = min(h, w)
    if min_side < 1200:
        scale = 1200 / min_side
        image = cv2.resize(
            image,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_LANCZOS4,
        )

    # 3. Grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 4. CLAHE — adaptive histogram equalisation
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # 5. Bilateral filter — noise reduction that preserves edges
    gray = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    # 6. Unsharp mask — sharpens blurry text
    blurred_for_usm = cv2.GaussianBlur(gray, (0, 0), sigmaX=3)
    gray = cv2.addWeighted(gray, 1.5, blurred_for_usm, -0.5, 0)

    # 7. Adaptive thresholding -> crisp black-on-white document image
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=15,
    )

    # 8. Light dilation — closes tiny gaps in character strokes
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    binary = cv2.dilate(binary, kernel, iterations=1)

    # 9. Save as lossless PNG
    success = cv2.imwrite(str(destination), binary)
    if not success:
        raise IOError(f"Failed to write processed image to: {destination}")

    return str(destination)