"""Download and extract a PixelLab character ZIP into public/sprites/<id>/raw/.

Usage:
    python scripts/download-pixellab-sprites.py <actorId> <characterUuid>

e.g.:
    python scripts/download-pixellab-sprites.py plains_bandit 7bbcd87e-810c-4b82-81c8-f987f7695658

The PixelLab API returns HTTP 423 if animations are still pending, so this
script fails fast with a clear message when that happens. After download it
unpacks the ZIP into public/sprites/<actorId>/raw/ so composite-pixellab-sprites.py
can consume it.
"""
from __future__ import annotations

import io
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DOWNLOAD_URL = "https://api.pixellab.ai/mcp/characters/{uuid}/download"


def download_zip(character_uuid: str) -> bytes:
    url = DOWNLOAD_URL.format(uuid=character_uuid)
    req = urllib.request.Request(url, headers={"User-Agent": "nannymud-sprite-fetch/1"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 423:
            print(
                f"error: character {character_uuid} has pending jobs (HTTP 423)",
                file=sys.stderr,
            )
            sys.exit(2)
        raise
    if len(data) < 1024:
        print(
            f"error: download too small ({len(data)} bytes) — likely an error response",
            file=sys.stderr,
        )
        sys.exit(2)
    return data


def extract(zip_bytes: bytes, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        zf.extractall(out_dir)
    print(f"extracted {len(zf.namelist())} files into {out_dir}")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: download-pixellab-sprites.py <actorId> <characterUuid>", file=sys.stderr)
        return 1
    actor_id, character_uuid = argv[1], argv[2]
    out_dir = REPO_ROOT / "public" / "sprites" / actor_id / "raw"
    print(f"downloading {character_uuid} -> {out_dir}")
    zip_bytes = download_zip(character_uuid)
    print(f"got {len(zip_bytes):,} bytes")
    extract(zip_bytes, out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
