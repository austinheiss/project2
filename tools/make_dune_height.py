"""
Makes assets/dunes_height.png, a 1024x1024 procedural dune height map.
Each dune is a lopsided sawtooth (long gentle windward side, short steep slip
face), with wandering crests, a weaker crossing set, a broad swell and bumpy troughs.
Run: python3 tools/make_dune_height.py [seed], then make_dune_color.py  (needs pillow + numpy)
"""
import os
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "..", "assets")

SIZE = 1024
WORLD_SIZE = 200        # world units across the map (= LAND_SIZE in js/landscape.js)
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 11
DUNES_ACROSS = 5.5      # how many main dune ridges fit in 100 world units
WIND_ANGLE = 12         # degrees; wind blows roughly toward +x
SLIP_FRACTION = 0.22    # share of each dune that is the steep lee (slip) face
TROUGH_REACH = 0.6      # how far up the dune slopes the trough hollows reach (0..1 of a ridge)
HUMMOCK_STRENGTH = 0.5  # how tall the hollows and humps in the troughs are
HUMMOCK_CELLS = 5       # how big they are (smaller = wider bumps)

rng = np.random.default_rng(SEED)
# coordinates in units of 100 world units, so dune size doesn't depend on map size
y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE * (WORLD_SIZE / 100)


def value_noise(cells, x, y):
    """Smooth random noise: random values on a cells x cells lattice,
    blended with a smoothstep between lattice points. Returns about -1..1."""
    extent = int(np.ceil(cells * x.max())) + 2   # lattice points needed to cover x, y
    grid = rng.uniform(-1, 1, (extent, extent))
    gx, gy = x * cells, y * cells
    ix, iy = np.floor(gx).astype(int), np.floor(gy).astype(int)
    fx, fy = gx - ix, gy - iy
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = grid[iy, ix], grid[iy, ix + 1]
    c, d = grid[iy + 1, ix], grid[iy + 1, ix + 1]
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy


def fbm(x, y, base_cells, octaves=3):
    """A few octaves of value noise added together (fractal noise)."""
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        total = total + amp * value_noise(base_cells * 2 ** o, x, y)
        norm += amp
        amp *= 0.5
    return total / norm


def dune_profile(phase):
    """Lopsided dune cross-section for phase 0..1: long gentle rise, then a
    short steep drop. Smoothed at the crest and trough so it isn't a hard saw."""
    p = phase % 1.0
    rise = 1.0 - SLIP_FRACTION
    up = np.clip(p / rise, 0, 1)
    down = np.clip((p - rise) / SLIP_FRACTION, 0, 1)
    rising = 0.5 * up + 0.5 * up * up * (3 - 2 * up)  # mostly straight, rounded ends
    h = np.where(p < rise, rising, 1 - down * down * (3 - 2 * down))
    return h


# rotate so the dunes line up across the wind
a = np.radians(WIND_ANGLE)
u = x * np.cos(a) + y * np.sin(a)   # along the wind
v = -x * np.sin(a) + y * np.cos(a)  # along the crests

# --- main transverse dunes, with wandering crests ---
warp = 0.11 * fbm(x, y, 2) + 0.035 * fbm(x, y, 5)
phase = u * DUNES_ACROSS + warp * DUNES_ACROSS
main = dune_profile(phase)
# each ridge gets taller and shorter along its length
strength = 0.6 + 0.6 * fbm(x, y, 3)
main *= np.clip(strength, 0.15, 1.0)

# --- weaker crossing dunes at an angle (makes a natural, slightly cellular look) ---
b = np.radians(WIND_ANGLE + 62)
u2 = x * np.cos(b) + y * np.sin(b)
cross = dune_profile(u2 * DUNES_ACROSS * 1.4 + 0.08 * DUNES_ACROSS * fbm(x, y, 3))
cross *= np.clip(0.5 + 0.5 * fbm(x, y, 2), 0, 1)

# --- broad swell under everything ---
swell = 0.5 + 0.5 * fbm(x, y, 1, octaves=2)

# --- bumps in the troughs (otherwise they're flat floors); mask fades out up the slopes ---
trough = 1 - np.clip(main / TROUGH_REACH, 0, 1)
trough = trough * trough * (3 - 2 * trough)
hummocks = fbm(x, y, HUMMOCK_CELLS, octaves=3)

h = 0.78 * main + 0.08 * cross + 0.22 * swell + HUMMOCK_STRENGTH * trough * hummocks

h = (h - h.min()) / (h.max() - h.min())
Image.fromarray((h * 255).round().astype(np.uint8), "L").save(os.path.join(ASSETS, "dunes_height.png"))
print("wrote", os.path.abspath(os.path.join(ASSETS, "dunes_height.png")), "seed", SEED)
