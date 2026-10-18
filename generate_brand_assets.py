from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "assets" / "images"
ROOT.mkdir(parents=True, exist_ok=True)


def gradient(size: int, transparent: bool = False) -> Image.Image:
    image = Image.new("RGBA", (size, size), (9, 12, 24, 0 if transparent else 255))
    if transparent:
        return image
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            blend = min(1.0, max(0.0, (x / max(1, size - 1)) * 0.38 + (y / max(1, size - 1)) * 0.62))
            pixels[x, y] = (
                int(8 + 14 * blend),
                int(11 + 3 * blend),
                int(24 + 19 * blend),
                255,
            )
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((size * 0.38, -size * 0.18, size * 1.15, size * 0.55), fill=(76, 141, 255, 64))
    glow_draw.ellipse((-size * 0.34, size * 0.48, size * 0.48, size * 1.25), fill=(139, 92, 255, 38))
    glow = glow.filter(ImageFilter.GaussianBlur(max(8, int(size * 0.09))))
    return Image.alpha_composite(image, glow)


def draw_mark(image: Image.Image, monochrome: bool = False) -> Image.Image:
    size = image.width
    draw = ImageDraw.Draw(image)
    scale = size
    outline = (238, 233, 255, 255) if monochrome else (139, 119, 255, 255)
    bright = (248, 248, 255, 255)
    blue = (112, 174, 255, 255)
    violet = (178, 130, 255, 255)
    page = (18, 27, 50, 255) if image.getpixel((0, 0))[3] else (18, 27, 50, 255)
    stroke = max(3, int(scale * 0.018))

    frame = (0.19 * scale, 0.19 * scale, 0.81 * scale, 0.81 * scale)
    draw.rounded_rectangle(frame, radius=0.105 * scale, outline=outline, width=stroke)

    # Film-frame corner perforations, kept small so the icon remains legible.
    hole = max(3, int(scale * 0.025))
    for cx, cy in ((0.27, 0.27), (0.73, 0.27), (0.27, 0.73), (0.73, 0.73)):
        color = violet if not monochrome else bright
        x, y = cx * scale, cy * scale
        draw.rounded_rectangle((x - hole, y - hole, x + hole, y + hole), radius=hole * 0.4, fill=color)

    # A folded page, with three short lines that suggest a written story rather than audio.
    page_points = [
        (0.34 * scale, 0.33 * scale),
        (0.60 * scale, 0.33 * scale),
        (0.69 * scale, 0.42 * scale),
        (0.69 * scale, 0.68 * scale),
        (0.34 * scale, 0.68 * scale),
    ]
    draw.polygon(page_points, fill=page, outline=bright)
    draw.line((0.60 * scale, 0.33 * scale, 0.60 * scale, 0.42 * scale, 0.69 * scale, 0.42 * scale), fill=blue, width=stroke)
    for index, end in enumerate((0.60, 0.57, 0.63)):
        y = (0.49 + index * 0.075) * scale
        draw.rounded_rectangle((0.40 * scale, y, end * scale, y + max(3, scale * 0.018)), radius=scale * 0.008, fill=blue if index != 2 or monochrome else violet)

    if not monochrome:
        dot_radius = 0.047 * scale
        draw.ellipse((0.69 * scale - dot_radius, 0.31 * scale - dot_radius, 0.69 * scale + dot_radius, 0.31 * scale + dot_radius), fill=violet)
    return image


# Full-color launcher icon.
icon = draw_mark(gradient(1024))
icon.convert("RGB").save(ROOT / "icon.png", quality=95)

# Adaptive icon foreground and monochrome layers stay transparent and within Android's safe area.
foreground = draw_mark(gradient(1024, transparent=True))
foreground.save(ROOT / "android-icon-foreground.png")
monochrome = draw_mark(gradient(1024, transparent=True), monochrome=True)
monochrome.save(ROOT / "android-icon-monochrome.png")

gradient(1024).convert("RGB").save(ROOT / "android-icon-background.png", quality=95)

# Splash uses only the transparent mark; the configured dark splash color supplies its field.
splash = draw_mark(gradient(600, transparent=True))
splash.save(ROOT / "splash-icon.png")

# Tiny matching web favicon.
icon.resize((64, 64), Image.Resampling.LANCZOS).convert("RGB").save(ROOT / "favicon.png", quality=95)

print(f"Generated branded Movie Recap Voice assets in {ROOT}")
