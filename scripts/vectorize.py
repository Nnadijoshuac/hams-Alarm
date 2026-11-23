"""
Turn a flat Gemini illustration (on white) into a clean, transparent SVG.

  python scripts/vectorize.py design/raw/v_clock.jpg assets/illustrations/clock.svg

1. Snap every pixel to the app palette (kills JPEG noise -> few, flat colours).
2. Flood-fill the white background from the image edges -> transparent
   (interior cream/white areas stay).
3. Crop to the artwork, then trace with vtracer.
"""
import re
import sys
from collections import deque

import vtracer
from PIL import Image

PALETTE = {
    'teal': (15, 94, 91),
    'ruby': (163, 32, 44),
    'gold': (242, 169, 59),
    'cream': (243, 234, 219),
    'plum': (62, 42, 107),
    'ink': (27, 26, 23),
    'white': (255, 255, 255),
}
COLS = list(PALETTE.values())


def nearest(c):
    r, g, b = c
    return min(COLS, key=lambda p: (p[0] - r) ** 2 * 2 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 3)


def main(src, dst, size=512):
    im = Image.open(src).convert('RGB').resize((size, size), Image.LANCZOS)
    w, h = im.size
    px = im.load()
    cache = {}
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c not in cache:
                cache[c] = nearest(c)
            px[x, y] = cache[c]

    # Background: white reachable from the border.
    rgba = im.convert('RGBA')
    a = rgba.load()
    seen = bytearray(w * h)
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    white = PALETTE['white']
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if px[x, y] != white:
            continue
        a[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))

    bbox = rgba.getbbox()
    pad = 8
    rgba = rgba.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad)))
    tmp = dst + '.png'
    rgba.save(tmp)

    # Positional on purpose: keyword arguments crash vtracer's binding on Python 3.14.
    # (path, out, colormode, hierarchical, mode, filter_speckle, color_precision,
    #  layer_difference, corner_threshold, length_threshold, max_iterations, splice_threshold, path_precision)
    vtracer.convert_image_to_svg_py(tmp, dst, 'color', 'stacked', 'spline', 6, 6, 16, 60, 4.0, 10, 45, 2)
    svg = open(dst, encoding='utf8').read()
    # Remove any stray full-canvas background path vtracer may emit, and snap path colours.
    svg = re.sub(r'<\?xml[^>]*>\s*', '', svg)
    open(dst, 'w', encoding='utf8').write(svg)
    import os
    os.remove(tmp)
    print(f'{dst}: {len(svg) // 1024} KB, {svg.count("<path")} paths, {rgba.size[0]}x{rgba.size[1]}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
