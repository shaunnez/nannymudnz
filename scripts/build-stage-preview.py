"""Composite stage preview thumbnails from public/world/<stageId>/raw/*.png.

Renders a 640x360 (16:9) hero image matching the in-game BackgroundView.ts
aesthetic (sky gradient + masonry band + red carpet rug + pillar/banner/
brazier props). Used by src/screens/StageSelect.tsx preview card.

Usage:
    python scripts/build-stage-preview.py assembly

Writes: public/world/<stageId>/preview.png
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 640, 360


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def draw_assembly(out: Path, raw: Path) -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    px = img.load()

    # --- Sky gradient (top ~68%): 0x233f71 → 0x9f7aa8, matches BackgroundView.ts:97.
    # Taller sky + shorter floor reads better as a card (the in-game camera
    # sits low; the preview wants more architecture on screen).
    sky_bottom = int(H * 0.68)
    sky_top_rgb = (0x23, 0x3f, 0x71)
    sky_bot_rgb = (0x9f, 0x7a, 0xa8)
    for y in range(sky_bottom):
        c = blend(sky_top_rgb, sky_bot_rgb, y / max(1, sky_bottom - 1))
        for x in range(W):
            px[x, y] = (*c, 255)

    # Soft warm glow near horizon, matches the fillEllipse in BackgroundView.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W * 0.14, sky_bottom - 90, W * 0.86, sky_bottom - 30),
               fill=(0xf6, 0xbf, 0x6a, 22))
    img.alpha_composite(glow)

    # --- Masonry roof + wall band behind pillars
    draw = ImageDraw.Draw(img)
    roof_top = 14
    roof_bot = roof_top + 12
    draw.rectangle([0, roof_top, W, roof_bot], fill=(0x6f, 0x76, 0x82, 255))
    draw.rectangle([0, roof_top - 4, W, roof_top], fill=(0x50, 0x56, 0x60, 255))
    draw.rectangle([0, roof_bot, W, roof_bot + 4], fill=(0x50, 0x56, 0x60, 255))
    for x in range(0, W + 90, 64):
        draw.line([(x, roof_top), (x + 14, roof_bot)], fill=(0x8f, 0x97, 0xa3, 120), width=1)

    wall_bot = sky_bottom + 4
    draw.rectangle([0, wall_bot - 28, W, wall_bot - 12], fill=(0x7b, 0x82, 0x90, 255))
    draw.rectangle([0, wall_bot - 12, W, wall_bot], fill=(0x5b, 0x62, 0x70, 255))

    # --- Floor: stone gradient + red carpet with gold trim
    floor_top = sky_bottom
    floor_h = H - floor_top
    for y in range(floor_top, H):
        t = (y - floor_top) / max(1, floor_h - 1)
        c = blend((0x7a, 0x74, 0x6d), (0x54, 0x4d, 0x47), t)
        for x in range(W):
            px[x, y] = (*c, 255)
    draw.line([(0, floor_top), (W, floor_top)], fill=(0x2d, 0x26, 0x22), width=2)

    # Red carpet is a foreground band; stone strip visible above it so pillar
    # bases sit on stone, not on the rug.
    stone_strip_h = 14
    rug_y = floor_top + stone_strip_h
    rug_h = floor_h - stone_strip_h - 6
    draw.rectangle([0, rug_y, W, rug_y + rug_h], fill=(0xb0, 0x1f, 0x2f, 245))
    draw.rectangle([0, rug_y + 14, W, rug_y + rug_h - 14], fill=(0x7d, 0x17, 0x23, 90))
    draw.line([(0, rug_y), (W, rug_y)], fill=(0xe5, 0xc1, 0x5a), width=3)
    draw.line([(0, rug_y + rug_h), (W, rug_y + rug_h)], fill=(0xe5, 0xc1, 0x5a), width=3)
    draw.line([(0, rug_y + 6), (W, rug_y + 6)], fill=(0xf2, 0xd9, 0x87, 220), width=1)
    draw.line([(0, rug_y + rug_h - 6), (W, rug_y + rug_h - 6)], fill=(0xf2, 0xd9, 0x87, 220), width=1)
    for x in range(18, W, 36):
        draw.line([(x, rug_y + 3), (x + 10, rug_y + 3)], fill=(0xd8, 0xb0, 0x4b), width=1)
        draw.line([(x + 6, rug_y + rug_h - 3), (x + 16, rug_y + rug_h - 3)], fill=(0xd8, 0xb0, 0x4b), width=1)

    # --- Load props
    pillar = Image.open(raw / "pillar_stone_knight_hall.png").convert("RGBA")
    banner = Image.open(raw / "banner_war_hanging.png").convert("RGBA")
    brazier = Image.open(raw / "brazier_wall_torch.png").convert("RGBA")
    window = Image.open(raw / "window_stained_glass.png").convert("RGBA")

    pillar_h = 200
    pillar_w = int(pillar.width * pillar_h / pillar.height)
    pillar = pillar.resize((pillar_w, pillar_h), Image.Resampling.LANCZOS)

    banner_h = 128
    banner_w = int(banner.width * banner_h / banner.height)
    banner = banner.resize((banner_w, banner_h), Image.Resampling.LANCZOS)

    brazier_h = 62
    brazier_w = int(brazier.width * brazier_h / brazier.height)
    brazier = brazier.resize((brazier_w, brazier_h), Image.Resampling.LANCZOS)

    window_h = 84
    window_w = int(window.width * window_h / window.height)
    window = window.resize((window_w, window_h), Image.Resampling.LANCZOS)

    # --- Stained-glass windows behind the columns (upper wall accent)
    win_y = roof_bot + 10
    for cx in (W * 0.22, W * 0.5, W * 0.78):
        img.alpha_composite(window, (int(cx - window_w / 2), int(win_y)))

    # --- Banners hang between pillars (front-wall layer)
    banner_y = sky_bottom - banner_h - 10
    for cx in (W * 0.22, W * 0.5, W * 0.78):
        img.alpha_composite(banner, (int(cx - banner_w / 2), int(banner_y)))

    # --- Pillars: feet on the stone strip (above the rug), spread across the hall
    pillar_y = floor_top - pillar_h + stone_strip_h - 2
    pillar_xs = [W * 0.08, W * 0.36, W * 0.64, W * 0.92]
    for cx in pillar_xs:
        img.alpha_composite(pillar, (int(cx - pillar_w / 2), int(pillar_y)))

    # Braziers on every pillar, seated in the niche pocket
    brazier_y = pillar_y + pillar_h * 0.42
    for cx in pillar_xs:
        img.alpha_composite(brazier, (int(cx - brazier_w / 2), int(brazier_y)))

    # --- Subtle vignette for card polish
    vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for i in range(22):
        vd.rectangle([i, i, W - i, H - i], outline=(0, 0, 0, 8))
    img.alpha_composite(vignette)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "PNG", optimize=True)
    print(f"wrote {out} ({W}x{H})")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: build-stage-preview.py <stageId>", file=sys.stderr)
        return 1
    stage = argv[1]
    root = Path(__file__).resolve().parent.parent
    raw = root / "public" / "world" / stage / "raw"
    out = root / "public" / "world" / stage / "preview.png"
    if not raw.exists():
        print(f"missing raw dir: {raw}", file=sys.stderr)
        return 1
    if stage == "assembly":
        draw_assembly(out, raw)
    else:
        print(f"no preview recipe for stage: {stage}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
