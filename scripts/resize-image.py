#!/usr/bin/env python3
"""Resize any image to 1280x800 JPG (center-crop, no alpha)."""

import os
import sys

try:
    from PIL import Image
except Exception:
    sys.stderr.write(
        "Pillow is required. Install with: python3 -m pip install pillow\n"
    )
    sys.exit(1)

TARGET_W = 1280
TARGET_H = 800


def build_default_output_path(input_path: str) -> str:
    base, _ext = os.path.splitext(input_path)
    return f"{base}-1280x800.jpg"


def resize_cover_center(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w = int(round(src_w * scale))
    new_h = int(round(src_h * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    left = max(0, (new_w - target_w) // 2)
    top = max(0, (new_h - target_h) // 2)
    right = left + target_w
    bottom = top + target_h
    return resized.crop((left, top, right, bottom))


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write(
            "Usage: python3 scripts/resize-image.py <input> [output.jpg]\n"
        )
        return 1

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) >= 3 else build_default_output_path(input_path)

    if not os.path.isfile(input_path):
        sys.stderr.write(f"Input not found: {input_path}\n")
        return 1

    with Image.open(input_path) as img:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        elif img.mode == "L":
            img = img.convert("RGB")

        final_img = resize_cover_center(img, TARGET_W, TARGET_H)
        final_img.save(output_path, "JPEG", quality=92, optimize=True, progressive=True)

    print(f"Saved: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
