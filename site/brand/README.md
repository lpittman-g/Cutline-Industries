# Artemis brand assets

Derived from the original mark in `site/artemis-icon.svg` and the brand token
`--accent: #3279f9`.

| File | Use |
|------|-----|
| `artemis-logo.svg` | Horizontal lockup — badge + wordmark. The master asset. |
| `artemis-logo-dark.svg` | Same lockup with a white wordmark, for dark backgrounds. |
| `artemis-mark.svg` | Square badge alone — avatar, app icon, favicon source. |

## Design notes

The mark is **reversed out of a solid tile** rather than sitting bare next to the
wordmark. The wordmark begins with "A" and so does the mark, so placing the bare
glyph beside it reads as a stutter ("A ARTEMIS"). The tile makes it read as a badge.

The wordmark is **drawn, not typeset** — monoline strokes at the same weight and
round cap style as the mark, so the two are one system and the file carries no font
dependency.

The apex dot (`circle r=6`) is inherited from the original icon. At this stroke
weight it sits inside the stroke and is not separately visible; it was the same in
the original. Enlarge it if you want it to read.

## Regenerating PNGs

PNGs are derived artifacts and are not committed. To regenerate:

```bash
pip install cairosvg
python3 - <<'PY'
import cairosvg
for src, out, w in [
    ("artemis-logo.svg",      "artemis-logo-2048.png",      2048),
    ("artemis-logo.svg",      "artemis-logo-1024.png",      1024),
    ("artemis-logo-dark.svg", "artemis-logo-dark-1024.png", 1024),
    ("artemis-mark.svg",      "artemis-mark-1024.png",      1024),
    ("artemis-mark.svg",      "artemis-mark-512.png",        512),
]:
    cairosvg.svg2png(url=src, write_to=out, output_width=w)
PY
```

Omit `background_color` for transparency; pass `background_color="white"` for a
flattened version.
