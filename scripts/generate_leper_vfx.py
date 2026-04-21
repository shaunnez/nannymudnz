"""Generate first-pass Leper VFX sprite strips.

Creates simple pixel-art style transparent sprite strips for the initial
Leper VFX batch:
  - plague_vomit_burst
  - diseased_claw_impact
  - necrotic_embrace_drain
  - rotting_tide_burst

Usage:
  python scripts/generate_leper_vfx.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "public" / "vfx" / "leper"
FRAME_SIZE = 96
GRID_SIZE = 32
UPSCALE = FRAME_SIZE // GRID_SIZE


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


PALETTE = {
    "olive": rgba("#738d3f"),
    "plague": rgba("#65a30d"),
    "dark": rgba("#1a2e05"),
    "drain": rgba("#3f6212"),
    "contagion": rgba("#4d7c0f"),
    "highlight": rgba("#cfe88a"),
    "bone": rgba("#d9ddb4"),
}


def make_frame() -> Image.Image:
    return Image.new("RGBA", (GRID_SIZE, GRID_SIZE), (0, 0, 0, 0))


def scale_frame(frame: Image.Image) -> Image.Image:
    return frame.resize((FRAME_SIZE, FRAME_SIZE), resample=Image.Resampling.NEAREST)


def save_strip(name: str, frames: list[Image.Image]) -> None:
    scaled = [scale_frame(frame) for frame in frames]
    strip = Image.new("RGBA", (FRAME_SIZE * len(scaled), FRAME_SIZE), (0, 0, 0, 0))
    for idx, frame in enumerate(scaled):
        strip.paste(frame, (idx * FRAME_SIZE, 0), frame)
    strip.save(OUT_DIR / f"{name}.png", format="PNG", optimize=True)


def draw_square(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, color: tuple[int, int, int, int]) -> None:
    draw.rectangle((x, y, x + size - 1, y + size - 1), fill=color)


def draw_ring(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    radius: int,
    thickness: int,
    color: tuple[int, int, int, int],
) -> None:
    for r in range(max(1, radius - thickness + 1), radius + 1):
        box = (cx - r, cy - r, cx + r, cy + r)
        draw.ellipse(box, outline=color)


def plague_vomit_frames() -> list[Image.Image]:
    frames: list[Image.Image] = []
    for idx in range(6):
        frame = make_frame()
        draw = ImageDraw.Draw(frame)
        spread = 6 + idx * 3
        plume_height = 4 + idx
        for step in range(spread):
            px = 11 + step
            top = 15 - min(plume_height, step // 2)
            bottom = 17 + min(plume_height, step // 2)
            color = PALETTE["plague"] if step % 2 == 0 else PALETTE["olive"]
            draw.line((px, top, px, bottom), fill=color)
        for blob in range(3 + idx):
            bx = min(29, 18 + idx * 2 + blob * 2)
            by = 12 + ((blob + idx) % 5)
            draw_square(draw, bx, by, 2 if blob % 2 == 0 else 1, PALETTE["highlight"])
        draw_square(draw, 9, 15, 2, PALETTE["bone"])
        frames.append(frame)
    return frames


def diseased_claw_frames() -> list[Image.Image]:
    frames: list[Image.Image] = []
    for idx in range(5):
        frame = make_frame()
        draw = ImageDraw.Draw(frame)
        offset = idx * 2
        for slash in range(3):
            start_x = 8 + slash * 3 + offset
            start_y = 21 - slash * 4
            end_x = start_x + 10
            end_y = start_y - 10
            draw.line((start_x, start_y, end_x, end_y), fill=PALETTE["plague"], width=2)
            draw.line((start_x, start_y + 1, end_x, end_y + 1), fill=PALETTE["highlight"], width=1)
        for spark in range(idx + 1):
            draw_square(draw, 19 + spark * 2, 8 + (spark % 3) * 3, 1, PALETTE["olive"])
        frames.append(frame)
    return frames


def necrotic_embrace_frames() -> list[Image.Image]:
    frames: list[Image.Image] = []
    for idx in range(6):
        frame = make_frame()
        draw = ImageDraw.Draw(frame)
        radius = 4 + idx * 2
        draw_ring(draw, 16, 16, radius, 2, PALETTE["drain"])
        draw_ring(draw, 16, 16, max(2, radius - 3), 1, PALETTE["highlight"])
        for tendril in range(4):
            direction = -1 if tendril % 2 == 0 else 1
            tx = 16 + direction * (4 + idx + tendril)
            ty = 16 + (-5 + tendril * 3)
            draw.line((16, 16, tx, ty), fill=PALETTE["olive"], width=1)
            draw_square(draw, tx, ty, 1, PALETTE["plague"])
        frames.append(frame)
    return frames


def rotting_tide_frames() -> list[Image.Image]:
    frames: list[Image.Image] = []
    for idx in range(8):
        frame = make_frame()
        draw = ImageDraw.Draw(frame)
        radius = 5 + idx * 2
        fill_alpha = max(70, 170 - idx * 10)
        draw.ellipse(
            (16 - radius, 16 - radius, 16 + radius, 16 + radius),
            fill=rgba("#1a2e05", fill_alpha),
            outline=PALETTE["olive"],
        )
        for spike in range(8):
            dx = [0, 3, 5, 3, 0, -3, -5, -3][spike]
            dy = [-6, -4, 0, 4, 6, 4, 0, -4][spike]
            sx = 16 + dx * (radius // 4 + 1)
            sy = 16 + dy * (radius // 4 + 1)
            draw.line((16, 16, sx, sy), fill=PALETTE["contagion"], width=1)
            draw_square(draw, sx, sy, 1, PALETTE["highlight"])
        frames.append(frame)
    return frames


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    save_strip("plague_vomit_burst", plague_vomit_frames())
    save_strip("diseased_claw_impact", diseased_claw_frames())
    save_strip("necrotic_embrace_drain", necrotic_embrace_frames())
    save_strip("rotting_tide_burst", rotting_tide_frames())
    print(f"wrote VFX strips to {OUT_DIR}")


if __name__ == "__main__":
    main()
