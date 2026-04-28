"""
gen_game_vfx_assets.py

Loads full-res VFX sheets from public/vfx/packs/sheets/, resizes frames to
max 400px height, stitches them into game sprite sheets in public/vfx/effects/,
and updates public/vfx/effects/metadata.json with new entries.

Does NOT overwrite existing metadata entries (slash_*, explosion_*).
"""

import json
import math
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT    = Path(__file__).resolve().parent.parent
SHEETS_DIR   = REPO_ROOT / "public" / "vfx" / "packs" / "sheets"
EFFECTS_DIR  = REPO_ROOT / "public" / "vfx" / "effects"
METADATA_PATH = EFFECTS_DIR / "metadata.json"

MAX_HEIGHT = 400  # px

# ---------------------------------------------------------------------------
# Effects to generate: key -> frame count
# ---------------------------------------------------------------------------
EFFECTS = {
    # pack2 flames
    "flame1":  28,
    "flame2":  16,
    "flame3":  32,
    "flame4":  32,
    "flame5":  32,
    "flame6":  18,
    "flame8":  32,
    "flame9":  31,
    "flame10": 32,
    # pack3 water
    "water1":  32,
    "water2":  17,
    "water3":  23,
    "water4":  16,
    "water5":  31,
    "water6":  12,
    "water7":  14,
    "water8":  21,
    "water9":  32,
    "water10": 14,
    # pack1
    "fire_arrow":  8,
    "fire_ball":   8,
    "fire_spell":  8,
    "water_arrow": 8,
    "water_spell": 8,
    "water_ball":  12,
}


def resize_frame(frame: Image.Image, max_h: int) -> Image.Image:
    """Return a copy of frame scaled so height <= max_h, preserving aspect ratio."""
    w, h = frame.size
    if h <= max_h:
        return frame.copy()
    scale = max_h / h
    new_w = max(1, round(w * scale))
    new_h = max_h
    return frame.resize((new_w, new_h), Image.LANCZOS)


def process_effect(key: str, frame_count: int):
    source_path = SHEETS_DIR / f"{key}_full.png"
    if not source_path.exists():
        print(f"  [SKIP] {key}: source not found at {source_path}")
        return None

    full = Image.open(source_path).convert("RGBA")
    total_w, total_h = full.size
    src_fw = total_w // frame_count  # source frame width
    src_fh = total_h                 # source frame height (full height)

    # Extract and resize each frame
    resized_frames = []
    for i in range(frame_count):
        box = (i * src_fw, 0, (i + 1) * src_fw, src_fh)
        frame = full.crop(box)
        resized = resize_frame(frame, MAX_HEIGHT)
        resized_frames.append(resized)

    # All resized frames should share the same size
    fw, fh = resized_frames[0].size

    # Stitch into a single horizontal sprite sheet
    sheet = Image.new("RGBA", (fw * frame_count, fh), (0, 0, 0, 0))
    for i, frame in enumerate(resized_frames):
        sheet.paste(frame, (i * fw, 0))

    out_path = EFFECTS_DIR / f"{key}.png"
    sheet.save(out_path, "PNG", optimize=False)

    file_size_kb = out_path.stat().st_size // 1024

    print(
        f"  {key:14s}  frames={frame_count:2d}  {fw}x{fh}  "
        f"sheet={fw * frame_count}x{fh}  {file_size_kb} KB  -> {out_path.name}"
    )

    return {
        "key": key,
        "frames": frame_count,
        "fw": fw,
        "fh": fh,
    }


def build_metadata_entry(info: dict) -> dict:
    fw = info["fw"]
    fh = info["fh"]
    return {
        "frames": info["frames"],
        "frameDurationMs": 60,
        "loop": False,
        "anchor": {"x": fw // 2, "y": fh // 2},
        "frameSize": {"w": fw, "h": fh},
        "scale": 0.5,
    }


def main():
    EFFECTS_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing metadata
    if METADATA_PATH.exists():
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            metadata = json.load(f)
    else:
        metadata = {"assets": {}}

    if "assets" not in metadata:
        metadata["assets"] = {}

    existing_keys = set(metadata["assets"].keys())
    print(f"Existing metadata keys: {sorted(existing_keys)}\n")

    results = []
    print("Processing effects:")
    print("-" * 72)
    for key, frame_count in sorted(EFFECTS.items()):
        info = process_effect(key, frame_count)
        if info is not None:
            results.append(info)

    print("-" * 72)

    # Update metadata — skip keys that already exist
    added = []
    skipped = []
    for info in results:
        key = info["key"]
        if key in existing_keys:
            skipped.append(key)
        else:
            metadata["assets"][key] = build_metadata_entry(info)
            added.append(key)

    # Write metadata back with stable key ordering
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        f.write("\n")

    print(f"\nMetadata updated: {METADATA_PATH}")
    if added:
        print(f"  Added   ({len(added)}): {', '.join(sorted(added))}")
    if skipped:
        print(f"  Skipped ({len(skipped)}, already existed): {', '.join(sorted(skipped))}")

    print("\nDone.")


if __name__ == "__main__":
    main()
