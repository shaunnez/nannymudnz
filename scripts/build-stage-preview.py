"""Composite stage preview thumbnails matching BackgroundView.ts aesthetics.

Renders 900×506 hero images (VIRTUAL_WIDTH × VIRTUAL_HEIGHT) without characters:
  sky gradient → ground gradient → backdrop.png tile → horizon.png tile → props

Usage:
    python scripts/build-stage-preview.py              # all 9 stages
    python scripts/build-stage-preview.py assembly     # one stage

Writes: public/world/<stageId>/preview.png
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 900, 506
GROUND_Y = round(H * 0.45)   # groundTopScreen = height * 0.45 ≈ 228
HORIZON_H = 32
HORIZON_Y = GROUND_Y - 16


# Sky-top, sky-bottom, ground-top, ground-bottom  (from BackgroundView.ts)
STAGE_COLORS: dict[str, tuple[tuple[int,int,int], ...]] = {
    'assembly':  ((0x23,0x3f,0x71), (0x9f,0x7a,0xa8), (0x7a,0x74,0x6d), (0x54,0x4d,0x47)),
    'market':    ((0x08,0x06,0x18), (0x2a,0x18,0x08), (0x20,0x18,0x18), (0x11,0x0f,0x0f)),
    'kitchen':   ((0x1c,0x18,0x10), (0x25,0x20,0x18), (0x2a,0x22,0x18), (0x18,0x14,0x10)),
    'tower':     ((0x08,0x05,0x20), (0x15,0x0a,0x38), (0x08,0x0f,0x20), (0x04,0x08,0x10)),
    'grove':     ((0x04,0x0c,0x18), (0x0a,0x15,0x08), (0x0f,0x1a,0x08), (0x08,0x0f,0x05)),
    'catacombs': ((0x07,0x07,0x0f), (0x0e,0x10,0x18), (0x12,0x16,0x1e), (0x09,0x0c,0x12)),
    'throne':    ((0x13,0x05,0x05), (0x28,0x08,0x08), (0x20,0x10,0x10), (0x13,0x08,0x08)),
    'docks':     ((0x06,0x08,0x10), (0x0e,0x12,0x18), (0x18,0x12,0x10), (0x0f,0x0a,0x08)),
    'rooftops':  ((0x28,0x58,0xa0), (0x60,0x80,0xb8), (0x58,0x58,0x58), (0x3a,0x3a,0x3a)),
}

# Extra props per stage: list of (raw_filename, x_fraction, scale, alpha)
# x_fraction is 0.0 = left edge, 1.0 = right edge; image is placed bottom-aligned at ground level.
STAGE_PROPS: dict[str, list[tuple[str, float, float, float]]] = {
    'assembly':  [
        ('pillar_stone_knight_hall.png', 0.10, 0.55, 0.92),
        ('pillar_stone_knight_hall.png', 0.38, 0.55, 0.92),
        ('pillar_stone_knight_hall.png', 0.62, 0.55, 0.92),
        ('pillar_stone_knight_hall.png', 0.90, 0.55, 0.92),
        ('banner_war_hanging.png',       0.24, 0.55, 0.85),
        ('banner_war_hanging.png',       0.50, 0.55, 0.85),
        ('banner_war_hanging.png',       0.76, 0.55, 0.85),
    ],
    'market': [
        ('hanging_sign_lantern.png',  0.15, 0.50, 0.90),
        ('hanging_sign_lantern.png',  0.50, 0.50, 0.90),
        ('hanging_sign_lantern.png',  0.85, 0.50, 0.90),
        ('barrel_crate_stack.png',    0.22, 0.45, 0.88),
        ('market_stall_wooden.png',   0.55, 0.48, 0.88),
        ('lantern_post_paper.png',    0.78, 0.42, 0.85),
    ],
    'kitchen': [
        ('stove_brick_ruined.png',   0.18, 0.50, 0.90),
        ('cauldron_iron_bubbling.png', 0.50, 0.48, 0.90),
        ('meat_hooks_hanging.png',   0.72, 0.50, 0.88),
        ('barrel_rotten_leaking.png', 0.85, 0.42, 0.85),
    ],
    'tower': [
        ('pillar_arcane_rune.png',    0.12, 0.52, 0.90),
        ('pillar_arcane_rune.png',    0.88, 0.52, 0.90),
        ('crystal_cluster_arcane.png', 0.35, 0.45, 0.88),
        ('crystal_cluster_arcane.png', 0.65, 0.45, 0.88),
        ('tome_pile_floating.png',    0.50, 0.42, 0.85),
        ('brazier_arcane_violet.png', 0.28, 0.40, 0.85),
        ('brazier_arcane_violet.png', 0.72, 0.40, 0.85),
    ],
    'grove': [
        ('tree_ancient_gnarled.png',  0.08, 0.55, 0.90),
        ('tree_ancient_gnarled.png',  0.92, 0.55, 0.90),
        ('stone_standing_runic.png',  0.30, 0.50, 0.88),
        ('stone_standing_runic.png',  0.70, 0.50, 0.88),
        ('altar_mossy_druid.png',     0.50, 0.46, 0.88),
        ('mushroom_bioluminescent.png', 0.42, 0.38, 0.80),
        ('mushroom_bioluminescent.png', 0.58, 0.38, 0.80),
    ],
    'catacombs': [
        ('pillar_cracked_flooded.png', 0.15, 0.52, 0.90),
        ('pillar_cracked_flooded.png', 0.85, 0.52, 0.90),
        ('stalactite_cluster.png',    0.35, 0.45, 0.85),
        ('stalactite_cluster.png',    0.65, 0.45, 0.85),
        ('bone_pile_ancient.png',     0.22, 0.40, 0.80),
        ('bone_pile_ancient.png',     0.78, 0.40, 0.80),
        ('torch_sconce_skull.png',    0.48, 0.42, 0.85),
    ],
    'throne': [
        ('throne_crimson_ornate.png', 0.50, 0.55, 0.92),
        ('pillar_crimson_banner.png', 0.12, 0.52, 0.90),
        ('pillar_crimson_banner.png', 0.88, 0.52, 0.90),
        ('block_execution_wood.png',  0.28, 0.44, 0.85),
        ('cage_iron_floor.png',       0.72, 0.44, 0.85),
    ],
    'docks': [
        ('post_mooring_dock.png',  0.14, 0.50, 0.88),
        ('post_mooring_dock.png',  0.86, 0.50, 0.88),
        ('anchor_rusted_large.png', 0.30, 0.45, 0.85),
        ('crate_stack_dock.png',   0.62, 0.46, 0.85),
        ('lamp_fog_iron.png',      0.48, 0.40, 0.82),
    ],
    'rooftops': [
        ('chimney_stone_smoke.png', 0.10, 0.50, 0.90),
        ('chimney_stone_smoke.png', 0.60, 0.50, 0.90),
        ('bell_post_brass.png',     0.40, 0.52, 0.90),
        ('gargoyle_stone_roof.png', 0.22, 0.44, 0.85),
        ('gargoyle_stone_roof.png', 0.78, 0.44, 0.85),
        ('flags_prayer_string.png', 0.50, 0.42, 0.80),
    ],
}


def blend(a: tuple[int,int,int], b: tuple[int,int,int], t: float) -> tuple[int,int,int]:
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def tile_image(src: Image.Image, dest_w: int, dest_h: int) -> Image.Image:
    """Return a dest_w × dest_h image filled by tiling src horizontally."""
    result = Image.new('RGBA', (dest_w, dest_h), (0, 0, 0, 0))
    iw = src.width
    for x in range(0, dest_w, iw):
        result.paste(src, (x, 0))
    return result


def place_prop(
    canvas: Image.Image,
    prop_path: Path,
    x_frac: float,
    scale: float,
    alpha: float,
    ground_y: int,
) -> None:
    if not prop_path.exists():
        return
    prop = Image.open(prop_path).convert('RGBA')
    target_h = max(1, round(prop.height * scale))
    target_w = max(1, round(prop.width * scale))
    prop = prop.resize((target_w, target_h), Image.Resampling.LANCZOS)
    if alpha < 1.0:
        r, g, b, a = prop.split()
        a = a.point(lambda v: round(v * alpha))
        prop = Image.merge('RGBA', (r, g, b, a))
    cx = round(x_frac * W)
    bx = cx - target_w // 2
    by = ground_y - target_h
    canvas.alpha_composite(prop, (bx, by))


def draw_stage(stage_id: str, raw: Path, out: Path) -> None:
    colors = STAGE_COLORS[stage_id]
    sky_top, sky_bot, gnd_top, gnd_bot = colors

    # --- Base canvas
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    px = img.load()

    # Sky gradient (0 → GROUND_Y)
    for y in range(GROUND_Y):
        c = blend(sky_top, sky_bot, y / max(1, GROUND_Y - 1))
        for x in range(W):
            px[x, y] = (*c, 255)  # type: ignore[index]

    # Ground gradient (GROUND_Y → H)
    for y in range(GROUND_Y, H):
        t = (y - GROUND_Y) / max(1, H - GROUND_Y - 1)
        c = blend(gnd_top, gnd_bot, t)
        for x in range(W):
            px[x, y] = (*c, 255)  # type: ignore[index]

    # Ground seam line
    draw = ImageDraw.Draw(img)
    draw.line([(0, GROUND_Y), (W, GROUND_Y)], fill=(0x10, 0x10, 0x10, 200), width=2)

    # Backdrop tile (covers sky area: y=0 to GROUND_Y)
    backdrop_path = out.parent / 'backdrop.png'
    if backdrop_path.exists():
        bd = Image.open(backdrop_path).convert('RGBA')
        bd_tiled = tile_image(bd, W, GROUND_Y)
        img.alpha_composite(bd_tiled, (0, 0))

    # Horizon strip (HORIZON_Y to HORIZON_Y+HORIZON_H)
    horizon_path = out.parent / 'horizon.png'
    if horizon_path.exists():
        hz = Image.open(horizon_path).convert('RGBA')
        hz_tiled = tile_image(hz, W, HORIZON_H)
        # Resize height to HORIZON_H if needed
        if hz_tiled.height != HORIZON_H:
            hz_tiled = hz_tiled.resize((W, HORIZON_H), Image.Resampling.LANCZOS)
        img.alpha_composite(hz_tiled, (0, HORIZON_Y))

    # Stage-specific props
    for (fname, x_frac, scale, alpha) in STAGE_PROPS.get(stage_id, []):
        place_prop(img, raw / fname, x_frac, scale, alpha, GROUND_Y)

    # Subtle vignette
    vignette = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for i in range(28):
        vd.rectangle([i, i, W - i, H - i], outline=(0, 0, 0, 6))
    img.alpha_composite(vignette)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert('RGB').save(out, 'PNG', optimize=True)
    print(f'wrote {out}  ({W}×{H})')


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parent.parent
    stages = list(STAGE_COLORS.keys()) if len(argv) < 2 else [argv[1]]
    ok = True
    for stage_id in stages:
        if stage_id not in STAGE_COLORS:
            print(f'unknown stage: {stage_id}', file=sys.stderr)
            ok = False
            continue
        raw = root / 'public' / 'world' / stage_id / 'raw'
        out = root / 'public' / 'world' / stage_id / 'preview.png'
        draw_stage(stage_id, raw, out)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
