"""Composite extracted PixelLab frame PNGs into horizontal strip sheets.

Maps PixelLab's opaque animation folder names to our canonical AnimationId
based on frame count + folder-name heuristics, then composites each east
frame sequence into a single horizontal strip PNG.

Usage (from repo root):
    python scripts/composite-pixellab-sprites.py <guildId>
    python scripts/composite-pixellab-sprites.py <guildId> --target-size 124

Outputs <anim>.png horizontal strips and metadata.json into
public/sprites/<guildId>/, ready to be consumed by SpriteActorRenderer.
"""
from __future__ import annotations

import argparse
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
FRAMECOUNT_AMBIGUOUS_MAP = {
    4: "idle",
    8: "block",
    9: "jump",
}

# Per-guild override for ambiguous PixelLab folder names.
GUILD_OVERRIDES: dict[str, dict[str, str]] = {
    "knight": {
        "animating-c13fc2a3": "walk",
        "animating-33580548": "ability_3",
        "animating-24c53603": "ability_4",
    },
    "vampire": {
        "animating-c6337dcc": "walk",
        "animating-078de359": "ability_3",
        "animating-3d734b9e": "ability_4",
    },
    "leper": {
        "animating-0d59a394": "walk",
        "animating-2da0a2ec": "ability_3",
        "animating-8d76f323": "ability_4",
    },
    "mage": {
        "animating-be5348b8": "walk",
        "animating-9f346683": "ability_3",
        "animating-c3b52b88": "ability_4",
    },
    "druid": {
        "animating-cbd248e4": "walk",
        "animating-bb2f5c21": "ability_3",
        "animating-331eb417": "ability_4",
    },
    "adventurer": {
        "animating-41811c0d": "walk",
        "animating-c4a78727": "ability_3",
        "animating-77f67db7": "ability_4",
    },
    "hunter": {
        "animating-886435a8": "walk",
        "animating-ecb531e9": "ability_3",
        "animating-d786c030": "ability_4",
    },
    "monk": {
        "animating-7fdfdbaf": "walk",
        "animating-d155b963": "ability_3",
        "animating-f43c8fcf": "ability_4",
    },
    "viking": {
        "animating-35755180": "walk",
        "animating-aefa3149": "ability_3",
        "animating-1635b0a1": "ability_4",
    },
    "prophet": {
        "animating-890dead4": "walk",
        "animating-fe0e21e0": "ability_3",
        "animating-f8b4bb5c": "ability_4",
    },
    "cultist": {
        "animating-09c48b04": "walk",
        "animating-b032c96f": "ability_3",
        "animating-dd84aa95": "ability_4",
    },
    "champion": {
        "animating-2961e264": "walk",
        "animating-8861d11a": "ability_3",
        "animating-7f448037": "ability_4",
    },
    "darkmage": {
        "animating-1611c8a6": "walk",
        "animating-9ee78b2d": "ability_3",
        "animating-310fc723": "ability_4",
    },
    "chef": {
        "animating-f3b90503": "walk",
        "animating-23b9df9e": "ability_3",
        "animating-9da40819": "ability_4",
    },
}

LOOP_ANIMS = {"idle", "walk", "run", "block", "ability_5"}
DURATIONS_MS = {
    "idle": 180,
    "walk": 120,
    "run": 90,
    "jump": 120,
    "attack_1": 80,
    "attack_2": 80,
    "attack_3": 80,
    "hurt": 100,
    "death": 150,
    "block": 200,
    "ability_1": 90,
    "ability_2": 90,
    "ability_3": 90,
    "ability_4": 90,
    "ability_5": 150,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("guild_id")
    parser.add_argument(
        "--target-size",
        type=int,
        default=None,
        help="Normalize each frame to this square size before compositing.",
    )
    return parser.parse_args()


def maybe_resize(frame: Image.Image, target_size: int | None) -> Image.Image:
    if target_size is None:
        return frame
    if frame.size == (target_size, target_size):
        return frame
    return frame.resize((target_size, target_size), resample=Image.Resampling.NEAREST)


def composite_strip(
    frame_paths: list[Path],
    out_path: Path,
    target_size: int | None,
) -> tuple[int, int, int]:
    frames = [maybe_resize(Image.open(p).convert("RGBA"), target_size) for p in frame_paths]
    w, h = frames[0].size
    for i, frame in enumerate(frames):
        if frame.size != (w, h):
            raise RuntimeError(f"frame {i} of {out_path.stem} has size {frame.size}, expected {(w, h)}")
    strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.paste(frame, (i * w, 0), frame)
    strip.save(out_path, format="PNG", optimize=True)
    return w, h, len(frames)


def classify(folder_name: str, frame_count: int, guild_overrides: dict[str, str]) -> str | None:
    if folder_name in guild_overrides:
        return guild_overrides[folder_name]
    prefix = folder_name.rsplit("-", 1)[0]
    if prefix in FOLDER_PREFIX_MAP:
        return FOLDER_PREFIX_MAP[prefix]
    if prefix == "animating":
        return FRAMECOUNT_AMBIGUOUS_MAP.get(frame_count)
    return None


def main() -> int:
    args = parse_args()
    guild_id = args.guild_id
    target_size = args.target_size
    out_dir = REPO_ROOT / "public" / "sprites" / guild_id
    raw_dir = out_dir / "raw"
    meta_path = raw_dir / "metadata.json"

    if not meta_path.exists():
        print(
            f"error: {meta_path} missing - extract PixelLab ZIP into {raw_dir}/ first",
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
        classified[anim_id] = (folder, [raw_dir / path for path in east])

    if unclassified:
        print("warning: unclassified folders:", unclassified, file=sys.stderr)

    frame_size = None
    animations_meta: dict[str, dict] = {}
    for anim_id, (folder, paths) in sorted(classified.items()):
        out = out_dir / f"{anim_id}.png"
        w, h, frame_count = composite_strip(paths, out, target_size)
        if frame_size is None:
            frame_size = (w, h)
        elif frame_size != (w, h):
            raise RuntimeError(f"frame-size mismatch: {anim_id} is {(w, h)} vs {frame_size}")
        animations_meta[anim_id] = {
            "frames": frame_count,
            "frameDurationMs": DURATIONS_MS[anim_id],
            "loop": anim_id in LOOP_ANIMS,
            "anchor": {"x": w // 2, "y": h - 12},
        }
        print(f"  {anim_id:10s} {frame_count} frames  <-  {folder}")

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
