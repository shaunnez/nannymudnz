"""Composite Craftpix VFX frame sequences into horizontal strip PNGs.

Slash variants (slash, slash2..slash10) read from:
  public/craftpix/craftpix-net-825597-free-slash-effects-sprite-pack/<variant>/png/

Explosion variants (Explosion_1..Explosion_10, skipping empty 4 and 7) read from:
  public/craftpix/craftpix-net-840730-free-animated-explosion-sprite-pack/PNG/Explosion_<N>/

Outputs public/vfx/effects/<key>.png strips + metadata.json compatible with EffectsRegistry.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SLASH_SRC = REPO_ROOT / "public/craftpix/craftpix-net-825597-free-slash-effects-sprite-pack"
EXPLOSION_SRC = REPO_ROOT / "public/craftpix/craftpix-net-840730-free-animated-explosion-sprite-pack/PNG"
OUT_DIR = REPO_ROOT / "public/vfx/effects"

SLASH_FRAME_MS = 35
EXPLOSION_FRAME_MS = 60
SLASH_TARGET_PX = 200.0
EXPLOSION_TARGET_PX = 250.0


def load_frames_sorted(directory: Path, numeric: bool = False) -> list[Path]:
    frames = list(directory.glob("*.png"))
    if numeric:
        frames.sort(key=lambda p: int("".join(filter(str.isdigit, p.stem)) or "0"))
    else:
        frames.sort()
    return frames


def composite_strip(frame_paths: list[Path]) -> tuple[Image.Image, int, int]:
    frames = [Image.open(p).convert("RGBA") for p in frame_paths]
    w, h = frames[0].size
    strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.paste(frame, (i * w, 0), frame)
    return strip, w, h


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict] = {}

    # --- Slash effects ---
    for i in range(1, 11):
        variant = "slash" if i == 1 else f"slash{i}"
        src = SLASH_SRC / variant / "png"
        if not src.exists():
            print(f"  skip {variant}: no png/ dir", file=sys.stderr)
            continue
        frames = load_frames_sorted(src, numeric=False)
        if not frames:
            print(f"  skip {variant}: empty", file=sys.stderr)
            continue

        strip, fw, fh = composite_strip(frames)
        key = f"slash_{i}"
        out = OUT_DIR / f"{key}.png"
        strip.save(out, format="PNG", optimize=True)
        scale = round(SLASH_TARGET_PX / fw, 3)
        assets[key] = {
            "frames": len(frames),
            "frameDurationMs": SLASH_FRAME_MS,
            "loop": False,
            "anchor": {"x": fw // 2, "y": fh // 2},
            "frameSize": {"w": fw, "h": fh},
            "scale": scale,
        }
        print(f"  {key}: {len(frames)} frames {fw}x{fh}  scale={scale}")

    # --- Explosion effects ---
    for i in range(1, 11):
        src = EXPLOSION_SRC / f"Explosion_{i}"
        if not src.exists():
            continue
        frames = load_frames_sorted(src, numeric=True)
        if not frames:
            print(f"  skip Explosion_{i}: empty", file=sys.stderr)
            continue

        strip, fw, fh = composite_strip(frames)
        key = f"explosion_{i}"
        out = OUT_DIR / f"{key}.png"
        strip.save(out, format="PNG", optimize=True)
        scale = round(EXPLOSION_TARGET_PX / fw, 3)
        assets[key] = {
            "frames": len(frames),
            "frameDurationMs": EXPLOSION_FRAME_MS,
            "loop": False,
            "anchor": {"x": fw // 2, "y": fh // 2},
            "frameSize": {"w": fw, "h": fh},
            "scale": scale,
        }
        print(f"  {key}: {len(frames)} frames {fw}x{fh}  scale={scale}")

    # Dummy top-level frameSize (every asset overrides it individually)
    metadata = {
        "frameSize": {"w": 96, "h": 96},
        "assets": assets,
    }
    meta_path = OUT_DIR / "metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"\nWrote {len(assets)} effects to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
