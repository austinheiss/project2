"""
Makes assets/dunes_color.png from dunes_height.png: dark sand in the troughs,
pale sand on the crests, a bit lighter on windward slopes, plus a little noise.
Run: python3 tools/make_dune_color.py  (needs pillow + numpy)
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "..", "assets")

h = np.asarray(Image.open(os.path.join(ASSETS, "dunes_height.png")).convert("L"), dtype=float)
t = (h - h.min()) / (h.max() - h.min())  # stretch to 0..1

trough = np.array([176, 122, 72]) / 255   # dark red-brown sand
mid    = np.array([214, 164, 100]) / 255  # golden sand
crest  = np.array([242, 214, 160]) / 255  # pale crest sand

# two-segment color ramp: trough -> mid -> crest
low = np.clip(t / 0.5, 0, 1)[..., None]
high = np.clip((t - 0.5) / 0.5, 0, 1)[..., None]
col = np.where(t[..., None] < 0.5, trough + (mid - trough) * low, mid + (crest - mid) * high)

# slope: positive where the ground rises toward +x (that face looks west)
slope = np.gradient(h, axis=1)
col *= (1.0 + np.clip(slope * 0.04, -0.12, 0.12))[..., None]

rng = np.random.default_rng(3)
col *= (0.97 + 0.06 * rng.random(h.shape))[..., None]

Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8), "RGB").save(os.path.join(ASSETS, "dunes_color.png"))
print("wrote", os.path.abspath(os.path.join(ASSETS, "dunes_color.png")))
