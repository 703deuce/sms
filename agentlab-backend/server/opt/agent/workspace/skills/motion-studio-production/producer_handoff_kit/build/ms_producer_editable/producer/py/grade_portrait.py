#!/usr/bin/env python3
"""render_editable worker step: apply the film's archive grade to a customer photo (deterministic, no AI).
archive_bw_warm = the S01 look: B&W with a faint warm tone (theme 'grade' note)."""
import sys
from PIL import Image, ImageOps
src, dst, mode = sys.argv[1:4]
im = Image.open(src).convert('RGB')
if mode == 'archive_bw_warm':
    g = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=0.5)
    im = ImageOps.colorize(g, black=(14, 12, 10), white=(242, 234, 220), mid=(128, 120, 108))
im.save(dst, quality=92)
