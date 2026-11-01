#!/usr/bin/env python3
"""Recortes reproducibles con Pillow. Nunca escribe sobre las fuentes."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/fotos/originales'
LOGOS = ROOT / 'assets/logo'


def main():
    LOGOS.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE / 'portada.png') as source:
        # La curva naranja empieza alrededor de y=709; 640 conserva solo fotos.
        source.convert('RGB').crop((0, 0, 1640, 640)).save(
            SOURCE / 'portada-recorte.jpg', quality=95, subsampling=0)
    with Image.open(SOURCE / 'logo.jpg') as source:
        logo = source.convert('RGBA')
    # El disco blanco tiene un radio útil de 281 px; 288 deja naranja.
    scale = 4
    circle = Image.new('L', (600 * scale, 600 * scale))
    ImageDraw.Draw(circle).ellipse(tuple(v * scale for v in (19, 19, 581, 581)), fill=255)
    logo.putalpha(circle.resize(logo.size, Image.Resampling.LANCZOS))
    logo.resize((288, 288), Image.Resampling.LANCZOS).save(
        LOGOS / 'logo-circulo.png', optimize=True)

    # Contorno entre las siluetas y las dos bandas de letras. Las coordenadas
    # se ajustaron sobre el original de 600 px, sin reconstruir el emblema.
    outline = [(275, 97), (345, 98), (350, 125), (402, 125),
               (457, 163), (486, 218), (498, 279), (469, 321),
               (450, 350), (429, 379), (407, 409), (386, 435),
               (346, 455), (294, 458), (248, 445), (210, 426),
               (183, 405), (156, 381), (116, 361), (98, 312),
               (99, 252), (112, 212), (150, 184), (175, 139),
               (233, 119), (275, 123)]
    mask = Image.new('L', (600 * scale, 600 * scale))
    ImageDraw.Draw(mask).polygon([(x * scale, y * scale) for x, y in outline], fill=255)
    with Image.open(SOURCE / 'logo.jpg') as source:
        emblem = source.convert('RGBA')
    emblem.putalpha(mask.resize(emblem.size, Image.Resampling.LANCZOS))
    # Quitar el blanco exterior conectado al margen, conservando el ave blanca.
    flood = Image.new('RGB', (600, 600), 'white')
    flood.paste(emblem, mask=emblem.getchannel('A'))
    # Fondo exterior casi blanco: flood fill binario evita borrar blancos internos.
    background = flood.convert('L').point(lambda p: 255 if p > 235 else 0)
    ImageDraw.floodfill(background, (0, 0), 128)
    alpha = emblem.getchannel('A')
    ap, bp = alpha.load(), background.load()
    for y in range(600):
        for x in range(600):
            if bp[x, y] == 128:
                ap[x, y] = 0
    emblem.putalpha(alpha)
    emblem = emblem.crop(emblem.getbbox())
    emblem_web = emblem.copy()
    emblem_web.thumbnail((144, 144), Image.Resampling.LANCZOS)
    emblem_web.save(LOGOS / 'logo-emblema.png', optimize=True)
    for size, filename in [(32, 'favicon.png'), (180, 'apple-touch-icon.png')]:
        icon = Image.new('RGBA', (size, size))
        fitted = emblem.copy()
        fitted.thumbnail((size, size), Image.Resampling.LANCZOS)
        icon.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
        icon.save(ROOT / filename)
    print('Recortes y cuatro PNG de identidad generados; fuentes intactas.')


if __name__ == '__main__':
    main()
