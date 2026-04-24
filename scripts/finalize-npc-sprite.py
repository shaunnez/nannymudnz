"""End-to-end: download PixelLab character ZIP → extract → composite → report.

Usage:
    python scripts/finalize-npc-sprite.py <actorId> <characterUuid> [--target-size 124]

Chains scripts/download-pixellab-sprites.py + scripts/composite-pixellab-sprites.py
and reports the final metadata summary. The actorId becomes the folder name
under public/sprites/ and the metadata.json's guildId field (the renderer
reads it as an opaque actor id).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def run(script: Path, *args: str) -> None:
    cmd = [sys.executable, str(script), *args]
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("actor_id")
    parser.add_argument("character_uuid")
    parser.add_argument("--target-size", type=int, default=124)
    args = parser.parse_args(argv[1:])

    scripts = REPO_ROOT / "scripts"
    run(scripts / "download-pixellab-sprites.py", args.actor_id, args.character_uuid)
    run(
        scripts / "composite-pixellab-sprites.py",
        args.actor_id,
        "--target-size", str(args.target_size),
    )

    out = REPO_ROOT / "public" / "sprites" / args.actor_id
    print(f"\n✅ {args.actor_id} ready at {out}")
    print("Next: add the actor kind to SPRITE_ACTORS in")
    print("  src/game/view/AnimationRegistry.ts")
    print("so BootScene preloads it.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
