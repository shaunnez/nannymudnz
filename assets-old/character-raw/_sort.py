"""Sort PixelLab character zips into assets/final/characters/<classId>/.

Reads metadata.json inside each zip, matches the prompt text against class
keywords, detects duplicates via character.id, and places rotation PNGs.
Non-MVP classes with multiple distinct generations get v1/v2 suffixes.
"""
from __future__ import annotations

import io
import json
import shutil
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

# Force UTF-8 stdout on Windows so unicode from prompts doesn't explode
sys.stdout.reconfigure(encoding="utf-8")

RAW_DIR = Path(__file__).parent
FINAL_DIR = RAW_DIR.parent / "final" / "characters"

# (classId, [keywords that identify the prompt]) — match is case-insensitive, any of.
CLASS_RULES = [
    ("adventurers", ["rugged everyman", "worn leather jerkin", "scuffed boots"]),
    ("knights",     ["templar-inspired", "plate mail with a white tabard", "kite shield"]),
    ("mages",       ["arcane scholar", "flowing purple robes", "rune-crystal"]),
    ("druids",      ["nature-keeper", "antler-crowned circlet", "bark and moss"]),
    ("hunters",     ["lean ranger", "longbow in one hand", "mottled olive-and-brown"]),
    ("monks",       ["shaven-headed ascetic", "saffron-gold monastic", "chi-glow"]),
    ("lepers",      ["leper", "severed arm", "burial bandages", "arm is ripped"]),
    ("vikings",     ["northern berserker", "wolf-pelt cloak", "battleaxe"]),
    ("prophets",    ["divine seer", "prophetic blindness", "sun-medallion"]),
    ("vampires",    ["aristocratic stalker", "crimson-lined black cloak", "fang visible"]),
    ("cthulhu",     ["coastal cultist", "seaweed-tangled", "webbed toes", "tentacled figure"]),
    ("khorne",      ["blood-pact warrior", "jagged black plate", "serrated cleaver"]),
    ("dark",        ["shadow-caster", "near-black robes", "obsidian staff"]),
    ("chefs",       ["cheerful cook", "chef's coat", "toque", "rolling pin"]),
    ("masters",     ["ageless prestige", "gold filigree", "rune-sigil hovering"]),
]


def classify(prompt: str) -> str | None:
    p = prompt.lower()
    for class_id, keywords in CLASS_RULES:
        if any(k.lower() in p for k in keywords):
            return class_id
    return None


def main() -> int:
    zips = sorted(RAW_DIR.glob("Isometric_pixel_art_character_3_4_front-facing_pos*.zip"))
    if not zips:
        print(f"no zips found in {RAW_DIR}")
        return 1

    # Group zips by detected classId, tracking character.id so we can dedupe
    by_class: dict[str, list[dict]] = defaultdict(list)
    unmatched: list[Path] = []

    for zp in zips:
        with zipfile.ZipFile(zp) as zf:
            with zf.open("metadata.json") as f:
                meta = json.load(f)
        prompt = meta["character"].get("prompt") or meta["character"].get("name", "")
        char_id = meta["character"]["id"]
        class_id = classify(prompt)
        if class_id is None:
            unmatched.append(zp)
            print(f"  ? {zp.name} — could not classify (prompt starts: {prompt[:80]!r})")
            continue
        by_class[class_id].append({"zip": zp, "char_id": char_id, "meta": meta})
        print(f"  {class_id:13s} <- {zp.name}  (char.id={char_id[:8]})")

    print()
    print("=== plan ===")
    for class_id, entries in sorted(by_class.items()):
        unique_ids = {e["char_id"] for e in entries}
        if len(unique_ids) == 1:
            print(f"  {class_id:13s}: {len(entries)} zip(s), 1 unique char.id -> single folder")
        else:
            print(f"  {class_id:13s}: {len(entries)} zip(s), {len(unique_ids)} unique char.ids -> v1..v{len(unique_ids)}")
    if unmatched:
        print(f"  unmatched: {[p.name for p in unmatched]}")
    print()

    # Expected MVP classes — flag anything missing
    mvp = {"adventurers", "knights", "mages", "druids", "hunters", "monks"}
    missing_mvp = mvp - set(by_class.keys())
    if missing_mvp:
        print(f"  WARNING: MVP classes with NO zips: {sorted(missing_mvp)}")
        print()

    # Place files
    print("=== placing files ===")
    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    for class_id, entries in sorted(by_class.items()):
        # Dedupe by char.id — keep first occurrence per id
        seen: dict[str, dict] = {}
        for e in entries:
            seen.setdefault(e["char_id"], e)
        unique_entries = list(seen.values())

        multi = len(unique_entries) > 1
        for i, e in enumerate(unique_entries, start=1):
            variant = f"v{i}" if multi else ""
            target = FINAL_DIR / class_id / variant if variant else FINAL_DIR / class_id
            target.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(e["zip"]) as zf:
                for name in zf.namelist():
                    if name.endswith("/"):
                        continue
                    data = zf.read(name)
                    # Flatten "rotations/north.png" -> "north.png" at target root
                    out_name = Path(name).name
                    (target / out_name).write_bytes(data)
            print(f"  {target.relative_to(FINAL_DIR.parent.parent)}/  <- {e['zip'].name}")

    # Write a manifest
    manifest = {
        "generated_by": "assets/character-raw/_sort.py",
        "source_count": len(zips),
        "classes": {
            class_id: {
                "variants": len({e["char_id"] for e in entries}),
                "sources": [e["zip"].name for e in entries],
            }
            for class_id, entries in sorted(by_class.items())
        },
        "unmatched": [p.name for p in unmatched],
        "missing_mvp": sorted(missing_mvp),
    }
    (FINAL_DIR / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))
    print(f"\n  wrote {FINAL_DIR / 'MANIFEST.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
