"""Composite extracted PixelLab frame PNGs into horizontal strip sheets.

Maps PixelLab's opaque animation folder names to our canonical AnimationId
based on frame count + folder-name heuristics, then composites each east
frame sequence into a single horizontal strip PNG.

Usage (from repo root):
    # 1. Download + extract PixelLab ZIP into public/sprites/<guildId>/raw/
    curl --fail -L -o leper.zip "https://api.pixellab.ai/mcp/characters/<id>/download"
    unzip leper.zip -d public/sprites/leper/raw/

    # 2. Run this script with the guildId
    python scripts/composite-pixellab-sprites.py leper

Outputs <anim>.png horizontal strips and metadata.json into
public/sprites/<guildId>/, ready to be consumed by SpriteActorRenderer.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent

# PixelLab folder-name (prefix before the hash) -> our AnimationId
FOLDER_PREFIX_MAP = {
    "jab_attack": "attack_1",
    "cross_punch_attack": "attack_2",
    "uppercut": "attack_3",
    "taking_a_punch": "hurt",
    "falling_backward": "death",
    "running": "run",
    "casting_a_fireball": "ability_1",
    "high_kick": "ability_2",
    "crouching": "ability_5",
}

# For "animating-XXX" folders (generic slug), disambiguate by frame count.
# These frame counts come from the templates we queued:
#   breathing-idle = 4, walking-6-frames = 6, jumping-1 = 9,
#   fight-stance-idle-8-frames = 8
FRAMECOUNT_AMBIGUOUS_MAP = {
    4: "idle",
    9: "jump",
    8: "block",
}

# Per-guild override for "animating-XXX" folders that collide on frame count.
# Keyed by guild_id, maps folder hash -> AnimationId. Inspect frames visually
# when the composite step warns about duplicates and add entries here.
GUILD_OVERRIDES: dict[str, dict[str, str]] = {
    "leper": {
        "animating-be67823d": "ability_3",  # pushing (6f) - collides with walk
        "animating-c3df789f": "ability_4",  # throw-object (7f)
        "animating-d1f51e59": "walk",       # walking-6-frames (6f)
    },
    "knight": {
        "animating-8fadff24": "ability_3",  # pushing (6f) - collides with walk
        "animating-b6950d50": "walk",       # walking-6-frames (6f)
        "animating-dec77c7e": "ability_4",  # throw-object (7f)
    },
    "vampire": {
        "animating-b0fa037f": "walk",       # walking-6-frames (6f)
        "animating-cf9739d9": "ability_3",  # pushing (6f) - collides with walk
        "animating-c5fabeb5": "ability_4",  # throw-object (7f)
    },
}

LOOP_ANIMS = {"idle", "walk", "run", "block", "ability_5"}
DURATIONS_MS = {
    "idle": 180, "walk": 120, "run": 90, "jump": 120,
    "attack_1": 80, "attack_2": 80, "attack_3": 80,
    "hurt": 100, "death": 150, "block": 200,
    "ability_1": 90, "ability_2": 90, "ability_3": 90, "ability_4": 90, "ability_5": 150,
}


def composite_strip(frame_paths: list[Path], out_path: Path) -> tuple[int, int, int]:
    frames = [Image.open(p).convert("RGBA") for p in frame_paths]
    w, h = frames[0].size
    for i, f in enumerate(frames):
        if f.size != (w, h):
            raise RuntimeError(f"frame {i} of {out_path.stem} has size {f.size}, expected {(w, h)}")
    strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * w, 0), f)
    strip.save(out_path, format="PNG", optimize=True)
    return w, h, len(frames)


def classify(folder_name: str, frame_count: int, guild_overrides: dict[str, str]) -> str | None:
    if folder_name in guild_overrides:
        return guild_overrides[folder_name]
    # Folder names look like "casting_a_fireball-8abee4b6" — split off the hash.
    prefix = folder_name.rsplit("-", 1)[0]
    if prefix in FOLDER_PREFIX_MAP:
        return FOLDER_PREFIX_MAP[prefix]
    if prefix == "animating":
        return FRAMECOUNT_AMBIGUOUS_MAP.get(frame_count)
    return None


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python scripts/composite-pixellab-sprites.py <guildId>", file=sys.stderr)
        return 2

    guild_id = sys.argv[1]
    out_dir = REPO_ROOT / "public" / "sprites" / guild_id
    raw_dir = out_dir / "raw"
    meta_path = raw_dir / "metadata.json"

    if not meta_path.exists():
        print(
            f"error: {meta_path} missing — extract PixelLab ZIP into {raw_dir}/ first",
            file=sys.stderr,
        )
        return 1

    meta = json.loads(meta_path.read_text())
    anim_map = meta["frames"]["animations"]
    overrides = GUILD_OVERRIDES.get(guild_id, {})

    classified: dict[str, tuple[str, list[Path]]] = {}
    unclassified: list[tuple[str, int]] = []
    for folder, dirs in anim_map.items():
        east = dirs.get("east")
        if not east:
            continue
        anim_id = classify(folder, len(east), overrides)
        if anim_id is None:
            unclassified.append((folder, len(east)))
            continue
        if anim_id in classified:
            raise RuntimeError(
                f"duplicate classification: folder {folder} and {classified[anim_id][0]} both -> {anim_id}"
            )
        classified[anim_id] = (folder, [raw_dir / p for p in east])

    if unclassified:
        print("warning: unclassified folders:", unclassified, file=sys.stderr)

    frame_size = None
    animations_meta: dict[str, dict] = {}
    for anim_id, (folder, paths) in sorted(classified.items()):
        out = out_dir / f"{anim_id}.png"
        w, h, n = composite_strip(paths, out)
        if frame_size is None:
            frame_size = (w, h)
        elif frame_size != (w, h):
            raise RuntimeError(f"frame-size mismatch: {anim_id} is {(w,h)} vs {frame_size}")
        animations_meta[anim_id] = {
            "frames": n,
            "frameDurationMs": DURATIONS_MS[anim_id],
            "loop": anim_id in LOOP_ANIMS,
            "anchor": {"x": w // 2, "y": h - 12},
        }
        print(f"  {anim_id:10s} {n} frames  <-  {folder}")

    assert frame_size is not None
    out_meta = {
        "guildId": guild_id,
        "frameSize": {"w": frame_size[0], "h": frame_size[1]},
        "facing": "right",
        "animations": animations_meta,
    }
    meta_out = out_dir / "metadata.json"
    meta_out.write_text(json.dumps(out_meta, indent=2) + "\n")
    print(f"\nwrote {meta_out}")
    print(f"frame size: {frame_size[0]}x{frame_size[1]}")
    print(f"animations: {', '.join(sorted(animations_meta))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
