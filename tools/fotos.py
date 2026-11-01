#!/usr/bin/env python3
"""Genera las fotos de la web sin modificar los originales.

Uso (desde cualquier carpeta): python tools/fotos.py
Dependencia: python -m pip install pillow

Entrada: assets/fotos/originales/mapa.csv (UTF-8, columnas archivo,nombre).
Ejemplo: IMG_1234.jpg,hero
Salida: assets/fotos/web/. Las variantes se reemplazan al volver a ejecutar.
Los lados mayores son exactos, incluso si se debe ampliar una foto pequeña;
la advertencia de resolución se basa siempre en el original.
"""
import argparse
import base64
import csv
import io
from pathlib import Path
import re
import sys

try:
    from PIL import Image, ImageFilter, ImageOps
except ImportError:
    sys.exit("Falta Pillow. Instálalo con: python -m pip install pillow")


ROOT = Path(__file__).resolve().parents[1]
ORIGINALES = ROOT / "assets/fotos/originales"
WEB = ROOT / "assets/fotos/web"
SIZES = (2400, 1200, 600)
QUALITY = 78


def read_manifest():
    """Valida todo el mapa antes de crear o reemplazar salidas."""
    rows = []
    names = set()
    originals = ORIGINALES.resolve()
    with (ORIGINALES / "mapa.csv").open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["archivo", "nombre"]:
            raise ValueError("mapa.csv debe tener la cabecera archivo,nombre.")
        for row in reader:
            line = reader.line_num
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"mapa.csv, línea {line}: se esperan dos columnas.")
            filename, name = row["archivo"].strip(), row["nombre"].strip()
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", name):
                raise ValueError(
                    f"mapa.csv, línea {line}: nombre inválido {name!r}; "
                    "usa letras sin acentos, números, guion o guion bajo."
                )
            if name.casefold() in names:
                raise ValueError(f"mapa.csv, línea {line}: nombre duplicado {name!r}.")
            relative = Path(filename)
            source = (originals / relative).resolve()
            if (not filename or relative.is_absolute()
                    or not source.is_relative_to(originals) or not source.is_file()):
                raise ValueError(
                    f"mapa.csv, línea {line}: original inexistente o fuera de "
                    f"originales/: {filename!r}."
                )
            names.add(name.casefold())
            rows.append((source, name))
    if not rows:
        raise ValueError("mapa.csv está vacío: añade filas archivo,nombre.")
    # No seguir enlaces que puedan sobrescribir originales u otras carpetas.
    if WEB.resolve() != WEB:
        raise ValueError("web/ debe ser una carpeta local sin enlaces simbólicos.")
    for _, name in rows:
        for suffix in ("2400.webp", "1200.webp", "600.webp", "600-blur.webp", "lqip.txt"):
            target = WEB / f"{name}-{suffix}"
            if target.is_symlink() or (target.exists() and not target.is_file()):
                raise ValueError(f"Destino inválido: {target}")
    return rows


def resize(image, longest):
    width, height = image.size
    ratio = longest / max(width, height)
    return image.resize(
        (max(1, round(width * ratio)), max(1, round(height * ratio))),
        Image.Resampling.LANCZOS,
    )


def encode_webp(image):
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=QUALITY,
               exif=b"", icc_profile=b"", xmp=b"")
    return buffer.getvalue()


def generate(source, name):
    with Image.open(source) as original:
        oriented = ImageOps.exif_transpose(original)
        if max(oriented.size) < 1600:
            print(
                f"AVISO: {source.name} ({name}), {oriented.width}x{oriented.height} px: "
                "lado mayor menor de 1600 px; no sirve para fondo a pantalla completa.",
                file=sys.stderr,
            )
        mode = "RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB"
        # Imagen nueva: no arrastrar EXIF, GPS, XMP ni otros metadatos.
        clean = Image.new(mode, oriented.size)
        clean.paste(oriented.convert(mode))

    outputs = []
    for size in SIZES:
        variant = resize(clean, size)
        outputs.append((f"{name}-{size}.webp", variant.size, encode_webp(variant)))
    # Desenfocar exactamente la variante de 600 ya codificada.
    with Image.open(io.BytesIO(outputs[-1][2])) as small:
        blurred = small.filter(ImageFilter.GaussianBlur(radius=18))
        outputs.append((f"{name}-600-blur.webp", blurred.size, encode_webp(blurred)))
    tiny = resize(clean, 24)
    uri = "data:image/webp;base64," + base64.b64encode(encode_webp(tiny)).decode("ascii")
    outputs.append((f"{name}-lqip.txt", tiny.size, uri.encode("ascii")))

    rows = []
    for filename, dimensions, data in outputs:
        target = WEB / filename
        target.write_bytes(data)
        rows.append((name, filename, f"{dimensions[0]}x{dimensions[1]}", str(target.stat().st_size)))
    return rows


def print_table(rows):
    header = ("Nombre", "Archivo", "Tamaño (px)", "Peso (bytes)")
    widths = [max(len(row[i]) for row in [header, *rows]) for i in range(len(header))]
    print(" | ".join(value.ljust(width) for value, width in zip(header, widths)))
    print("-+-".join("-" * width for width in widths))
    for row in rows:
        print(" | ".join(value.ljust(width) for value, width in zip(row, widths)))


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    try:
        manifest = read_manifest()
        WEB.mkdir(parents=True, exist_ok=True)
    except (OSError, ValueError, csv.Error, UnicodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    rows = []
    errors = 0
    for source, name in manifest:
        try:
            rows.extend(generate(source, name))
        except (OSError, ValueError, Image.DecompressionBombError) as exc:
            errors += 1
            print(f"ERROR: {source.name} ({name}): {exc}", file=sys.stderr)
    print_table(rows)
    print(f"\n{len(rows)} archivos generados en {WEB}; {errors} error(es).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
