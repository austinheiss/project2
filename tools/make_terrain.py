"""
Makes assets/terrain_height.png and terrain_color.png (the two images the app loads):
the dunes with the pyramids from giza_height.png built in on a flat sand plateau.
Heights are written as gray with height = MIN_HEIGHT + gray / 255 * MAX_HEIGHT,
the same map js/landscape.js reads back.
Run after the dune tools: python3 tools/make_terrain.py  (needs pillow + numpy)
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "..", "assets")

# Must match js/landscape.js
LAND_SIZE = 200          # world units across the map
MIN_HEIGHT = 0.5         # world height of gray 0
MAX_HEIGHT = 32          # extra world height of gray 255

GIZA_SIZE = 200          # world units the Giza map covers, centered
DUNE_HEIGHT = 7.5        # world height of a white dune pixel
PYRAMID_THRESHOLD = 18   # gray 0..18 is sand in the Giza map, not pyramid
PYRAMID_HEIGHT = 28      # world height of a white Giza pixel above the plateau
PLATEAU_HEIGHT = 3       # dunes are flattened to this around the pyramids
PLATEAU_FLAT = 3         # world units of flat sand around each pyramid ...
PLATEAU_FADE = 8         # ... then this many units to blend back into the dunes
LIMESTONE = np.array([0.76, 0.64, 0.46])
CASING = np.array([0.93, 0.89, 0.80])   # pale limestone near the tops


def load_gray(name):
    return np.asarray(Image.open(os.path.join(ASSETS, name)).convert("L"), dtype=float)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def distance_to(mask):
    """Rough distance (in pixels) from every pixel to the nearest True one, using a forward and a backward sweep."""
    h, w = mask.shape
    d = np.where(mask, 0.0, 1e9)
    diag = np.sqrt(2)
    # whole rows at a time, then a running min along the row
    for y in range(h):
        if y > 0:
            up = d[y - 1]
            d[y] = np.minimum(d[y], up + 1)
            d[y, 1:] = np.minimum(d[y, 1:], up[:-1] + diag)
            d[y, :-1] = np.minimum(d[y, :-1], up[1:] + diag)
        for x in range(1, w):
            d[y, x] = min(d[y, x], d[y, x - 1] + 1)
    for y in range(h - 1, -1, -1):
        if y < h - 1:
            down = d[y + 1]
            d[y] = np.minimum(d[y], down + 1)
            d[y, 1:] = np.minimum(d[y, 1:], down[:-1] + diag)
            d[y, :-1] = np.minimum(d[y, :-1], down[1:] + diag)
        for x in range(w - 2, -1, -1):
            d[y, x] = min(d[y, x], d[y, x + 1] + 1)
    return d


dunes = load_gray("dunes_height.png")
size = dunes.shape[0]
dune_color = np.asarray(Image.open(os.path.join(ASSETS, "dunes_color.png")).convert("RGB"), dtype=float) / 255

# scale the Giza map to GIZA_SIZE world units and center it on the dune map
giza_image = Image.open(os.path.join(ASSETS, "giza_height.png")).convert("L")
giza_pixels = round(size * GIZA_SIZE / LAND_SIZE)
giza = np.zeros((size, size))
start = (size - giza_pixels) // 2
giza[start:start + giza_pixels, start:start + giza_pixels] = np.asarray(
    giza_image.resize((giza_pixels, giza_pixels), Image.BILINEAR), dtype=float)

# 0..1 height of each pyramid pixel above the plateau, 0 = sand
pyramid = np.clip((giza - PYRAMID_THRESHOLD) / (255 - PYRAMID_THRESHOLD), 0, 1)
stone = pyramid > 0

# 1. dunes in world units
height = MIN_HEIGHT + dunes / 255 * DUNE_HEIGHT

# 2. flatten into a plateau near the pyramids
pixel = LAND_SIZE / size                     # world units per pixel
distance = distance_to(stone) * pixel
flat = 1 - smoothstep(PLATEAU_FLAT, PLATEAU_FLAT + PLATEAU_FADE, distance)
height += (PLATEAU_HEIGHT - height) * flat

# 3. pyramids on top of the plateau
height = np.where(stone, PLATEAU_HEIGHT + pyramid * PYRAMID_HEIGHT, height)

# 4. limestone, paler near the tops, with cube-sized brightness blocks
stone_color = LIMESTONE + (CASING - LIMESTONE) * smoothstep(0.85, 1, pyramid)[..., None]
rng = np.random.default_rng(5)
blocks = rng.uniform(0.94, 1.04, (LAND_SIZE, LAND_SIZE))
brightness = np.kron(blocks, np.ones((size // LAND_SIZE + 1,) * 2))[:size, :size]
stone_color *= brightness[..., None]
color = np.where(stone[..., None], stone_color, dune_color)

# world height back to gray, the way landscape.js reads it
gray = (height - MIN_HEIGHT) / MAX_HEIGHT * 255
gray = np.clip(gray, 0, 255).round().astype(np.uint8)
Image.fromarray(gray, "L").save(os.path.join(ASSETS, "terrain_height.png"))
Image.fromarray((np.clip(color, 0, 1) * 255).round().astype(np.uint8), "RGB").save(
    os.path.join(ASSETS, "terrain_color.png"))
print("wrote assets/terrain_height.png and assets/terrain_color.png")
