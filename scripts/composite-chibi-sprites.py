"""Composite Forest Ranger chibi PNG sequences into horizontal strip spritesheets.

Source: public/craftpix/craftpix-net-619226-free-forest-ranger-chibi-character-sprites/
         Forest_Ranger_1/PNG/PNG Sequences/<AnimName>/
Output: public/sprites/ranger/  (124x124 per frame, horizontal strips + metadata.json)

Usage: python scripts/composite-chibi-sprites.py
"""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "public/craftpix/craftpix-net-619226-free-forest-ranger-chibi-character-sprites/Forest_Ranger_1/PNG/PNG Sequences"
OUT_DIR = REPO_ROOT / "public/sprites/ranger"
FRAME_SIZE = 124
FACING = "right"

ANIM_MAP: list[tuple[str, str, int, bool]] = [
    ("Idle",                "idle",      180, True),
    ("Walking",             "walk",      120, True),
    ("Running",             "run",        90, True),
    ("Jump Start",          "jump",      120, False),
    ("Hurt",                "hurt",      100, False),
    ("Dying",               "death",     150, False),
    ("Kicking",             "attack_1",   80, False),
    ("Sliding",             "dodge",     100, False),
    ("Throwing",            "ability_1",  90, False),
    ("Throwing in The Air", "ability_2",  90, False),
    ("Shooting",            "ability_3",  90, False),
    ("Shooting in The Air", "ability_4",  90, False),
    ("Run Throwing",        "attack_2",   80, False),
]


def composite(src_folder: Path, anim_id: str, frame_ms: int, loop: bool) -> dict:
    frames = sorted(src_folder.glob("*.png"))
    if not frames:
        raise FileNotFoundError(f"No frames in {src_folder}")
    imgs = [Image.open(p).convert("RGBA").resize(
        (FRAME_SIZE, FRAME_SIZE), resample=Image.Resampling.LANCZOS) for p in frames]
    strip = Image.new("RGBA", (FRAME_SIZE * len(imgs), FRAME_SIZE), (0, 0, 0, 0))
    for i, img in enumerate(imgs):
        strip.paste(img, (i * FRAME_SIZE, 0), img)
    strip.save(OUT_DIR / f"{anim_id}.png", format="PNG", optimize=True)
    print(f"  {anim_id:12s} {len(imgs)} frames")
    return {
        "frames": len(imgs),
        "frameDurationMs": frame_ms,
        "loop": loop,
        "anchor": {"x": FRAME_SIZE // 2, "y": FRAME_SIZE - 1},
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    animations: dict[str, dict] = {}
    for src_name, anim_id, frame_ms, loop in ANIM_MAP:
        src = SRC_DIR / src_name
        if not src.exists():
            print(f"  SKIP {src_name}: not found")
            continue
        animations[anim_id] = composite(src, anim_id, frame_ms, loop)
    metadata = {
        "guildId": "ranger",
        "frameSize": {"w": FRAME_SIZE, "h": FRAME_SIZE},
        "facing": FACING,
        "animations": animations,
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"\nWrote {len(animations)} animations to {OUT_DIR}")


if __name__ == "__main__":
    main()
