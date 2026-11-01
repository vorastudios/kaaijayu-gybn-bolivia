#!/usr/bin/env python3
"""Auditoría WCAG sRGB con Pillow: python tools/contraste.py.

Lee los tokens y TODAS las declaraciones de color de style.css. Comprueba los
colores de texto contra todas las superficies claras (incluso combinaciones
conservadoras) y el texto inverso contra su botón. Exige 4.5 también a los
títulos grandes: es más estricto que el mínimo de 3:1 para >=24 px.

Las superficies translúcidas se miden sobre capturas reales sin tinta, con el
desenfoque, velo, auroras y vidrio del CSS. Primero ejecutar
node codex/qa/contraste-fotos.cjs. Se exige P5 >= 4.5 en las cajas del texto;
no se afirma que el percentil cubra cada píxel ni todas las futuras fotos.
No evalúa antialiasing, texto dentro de fotos ni elementos aria-hidden.
Los selectores y superficies admitidos son explícitos: un color o material
nuevo exige actualizar esta auditoría, en vez de dar un aprobado silencioso.
"""
import re
import json
import math
import hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def rgb(value):
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise ValueError(f"Color no admitido: {value}")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (1, 3, 5))


def mix(foreground, background, alpha):
    return tuple(a * alpha + b * (1 - alpha) for a, b in zip(foreground, background))


def luminance(color):
    linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in color]
    return sum(c * w for c, w in zip(linear, (.2126, .7152, .0722)))


def contrast(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + .05) / (lo + .05)


def photo_rows(colors):
    """P5 por caja de texto de los tres fondos, en seis anchos responsive."""
    folder = ROOT / 'codex/qa/t6'
    for filename, digest in json.loads((folder / 'contraste-fuentes.json').read_text()).items():
        if hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() != digest:
            raise ValueError(f'Captura desactualizada: {filename}; repetir contraste-fotos.cjs')
    captures = json.loads((folder / 'contraste-zonas.json').read_text(encoding='utf-8'))
    if {(c['section'], c['width']) for c in captures} != {
        (s, w) for s in ['inicio', 'nosotros', 'sumate']
        for w in [375, 768, 860, 1024, 1280, 1440]
    }:
        raise ValueError('Faltan secciones o anchos en la captura real')
    rows = []
    for capture in captures:
        with Image.open(folder / capture['screenshot']) as source:
            source = source.convert('RGB')
            for zone in capture['zones']:
                x0, y0, x1, y1 = zone['rect']
                box = (max(0, math.ceil(x0)), max(0, math.ceil(y0)),
                       min(source.width, math.floor(x1)), min(source.height, math.floor(y1)))
                pixels = source.crop(box)
                data = pixels.get_flattened_data() if hasattr(pixels, 'get_flattened_data') else pixels.getdata()
                levels = sorted(luminance(tuple(v / 255 for v in p)) for p in data)
                if not levels:
                    raise ValueError('Zona de texto vacía')
                p5 = levels[math.floor((len(levels) - 1) * .05)]
                foreground = tuple(int(v) / 255 for v in re.findall(r'\d+', zone['color'])[:3])
                name = next((k for k, v in colors.items() if v == foreground), None)
                if name is None:
                    raise ValueError(f"Color real no auditado: {zone['color']}")
                fg = luminance(foreground)
                ratio = (max(p5, fg) + .05) / (min(p5, fg) + .05)
                rows.append(dict(section=capture['section'], width=capture['width'],
                                 text=zone['text'], token=name, luminancia_p5=p5,
                                 contraste=ratio, velo=capture['veil']))
    (folder / 'contraste-detalle.json').write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('\n## Fotos reales: percentil 5 de luminancia detrás del texto\n')
    print('Capturas Chrome DPR 1, sin tinta; incluyen foto, desenfoque, velo, auroras y vidrio reales.')
    print('Seis anchos: 375, 768, 860, 1024, 1280 y 1440 px. Se muestra el peor par por sección/token.\n')
    print('| Sección | Texto | Ancho crítico | Luminancia P5 | Contraste | AA |')
    print('|---|---|---:|---:|---:|:---:|')
    for section in ['inicio', 'nosotros', 'sumate']:
        for token in sorted({r['token'] for r in rows if r['section'] == section}):
            worst = min((r for r in rows if r['section'] == section and r['token'] == token), key=lambda r:r['contraste'])
            print(f"| {section} | {token} | {worst['width']} px | {worst['luminancia_p5']:.4f} | {worst['contraste']:.2f}:1 | {'PASA' if worst['contraste'] >= 4.5 else 'FALLA'} |")
    failures = sum(r['contraste'] < 4.5 for r in rows)
    print(f'\n{len(rows)} zonas de texto; {failures} fallos con P5. Detalle: codex/qa/t6/contraste-detalle.json.')
    return failures


def main():
    tokens_css = (ROOT / 'css/tokens.css').read_text(encoding='utf-8')
    style = (ROOT / 'css/style.css').read_text(encoding='utf-8')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    tokens = dict(re.findall(r"(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", tokens_css))
    colors = {name: rgb(value) for name, value in tokens.items()}
    # Excluye únicamente adornos comprobados en el HTML (no texto informativo).
    decorations = {'proposito-comilla', 'eje-icono--verde', 'eje-icono--morado', 'eje-icono--agua'}
    for name in decorations:
        matches = re.findall(r'<[^>]+class="[^\"]*\b' + name + r'\b[^\"]*"[^>]*>', html)
        if not matches or any('aria-hidden="true"' not in tag for tag in matches):
            raise ValueError(f"{name} ya no es exclusivamente decorativo")

    clean_style = re.sub(r'/\*.*?\*/', '', style, flags=re.S)
    text_tokens = set()
    for block in re.finditer(r'([^{}]+)\{([^{}]*)\}', clean_style):
        selector, body = block.groups()
        # Evita background-color, border-color, etc.
        declarations = re.findall(r'(?:^|;)\s*color\s*:\s*([^;]+)', body)
        for declaration in declarations:
            if declaration.strip() == 'inherit':
                continue
            token = re.fullmatch(r'var\((--[\w-]+)\)', declaration.strip())
            if not token:
                raise ValueError(f"Color de texto sin auditar: {selector.strip()}: {declaration}")
            name = token[1]
            if any(re.fullmatch(r'\s*\.' + decoration + r'\s*', selector) for decoration in decorations):
                continue
            if name not in colors:
                raise ValueError(f"Token no definido: {name}")
            text_tokens.add(name)
    expected = {'--tinta', '--tinta-2', '--verde-texto', '--morado', '--blanco'}
    if text_tokens != expected:
        raise ValueError(f"Cambió el conjunto de colores de texto: {sorted(text_tokens)}")

    # Superficies sólidas; las translúcidas se auditan con la foto real abajo.
    surfaces = {
        '--blanco': colors['--blanco'],
        '--niebla': colors['--niebla'],
    }
    chip = re.search(r'\.accion-chips li\s*\{(.*?)\}', style, re.S)
    if not chip or 'var(--cielo) 15%' not in chip[1]:
        raise ValueError('Cambió el fondo de los chips: auditar el nuevo material')
    surfaces['chip --cielo 15% / --niebla'] = mix(colors['--cielo'], colors['--niebla'], .15)
    button = re.search(r'\.boton\s*\{(.*?)\}', style, re.S)
    if not button or 'background: var(--verde-texto)' not in button[1] or 'color: var(--blanco)' not in button[1]:
        raise ValueError('Cambió el botón inverso: auditar su par')

    rows = []
    for foreground in sorted(text_tokens - {'--blanco'}):
        for name, surface in surfaces.items():
            ratio = contrast(colors[foreground], surface)
            rows.append((foreground, name, ratio, 4.5))
    rows.append(('--blanco', '--verde-texto (botón)', contrast(colors['--blanco'], colors['--verde-texto']), 4.5))
    print('WCAG AA: texto normal >= 4.5:1; texto >= 24 px >= 3:1.')
    print('Se exige 4.5:1 a todo el texto, incluidos títulos; superficies sólidas.\n')
    print('| Texto | Fondo | Contraste | Mínimo aplicado | AA |')
    print('|---|---|---:|---:|:---:|')
    for foreground, background, ratio, minimum in rows:
        print(f'| {foreground} | {background} | {ratio:.2f}:1 | {minimum:.1f}:1 | {"PASA" if ratio >= minimum else "FALLA"} |')
    failures = sum(ratio < minimum for _, _, ratio, minimum in rows)
    print(f'\n{len(rows)} pares sólidos; {failures} fallos. Adornos aria-hidden excluidos.')
    return bool(failures + photo_rows(colors))


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except ValueError as error:
        raise SystemExit(f'ERROR DE COBERTURA: {error}')
