#!/usr/bin/env python3
"""Measure band rows in an exported 1080x1920 frame: python3 measure_frame.py frame.png [boxHex]"""
import sys
import numpy as np
from PIL import Image

def runs(mask, min_len=12):
    out, start = [], None
    for y, v in enumerate(mask):
        if v and start is None:
            start = y
        if not v and start is not None:
            if y - start >= min_len:
                out.append((start, y - 1))
            start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
box = sys.argv[2] if len(sys.argv) > 2 else "#FFFFFF"
rgb = np.array([int(box[i:i + 2], 16) for i in (1, 3, 5)])
mid = im[:, 200:880]
is_box = (np.abs(mid - rgb).max(2) < 30).mean(1) > 0.9
is_black = (mid.max(2) < 20).mean(1) > 0.95
print("size", im.shape[1], "x", im.shape[0])
print("box rows", runs(is_box))
print("black rows", runs(is_black))
purple = (np.abs(im - np.array([0x91, 0x46, 0xFF])).max(2) < 40)
ys, xs = np.where(purple)
if len(ys):
    print("purple (badge/sticker) bbox x", xs.min(), xs.max(), "y", ys.min(), ys.max())
