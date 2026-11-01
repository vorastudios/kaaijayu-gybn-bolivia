# El anillo — Kaaijayu

Dos composiciones de 180 cuadros, 30 fps y 6 segundos: `Anillo` (1080 × 1080) y `AnilloVertical` (1080 × 1920).

```sh
npm run preview
npx tsc --noEmit
npm run render
```

El último comando genera `out/anillo.mp4` y `out/anillo-vertical.mp4` en H.264. No se renderizó durante la preparación de T8.

## Decisiones de implementación

- Anillo de radio 380 px: cuatro repeticiones de «#YOUTHINTOACTION · », IBM Plex Mono 400 a 34 px. Cada carácter entra en 9 cuadros; el último termina en el cuadro 75 (2,5 s). Solo el anillo gira, 20° entre el primer y el último cuadro.
- El emblema mantiene su proporción original (144 × 137 px) dentro de una caja de 520 × 520 px. Su baja resolución limita la nitidez al ampliarlo. `logo-circulo.png` (288 × 288 px) queda copiado como referencia; el anillo animado se construye con letras independientes.
- Emblema y anillo comparten reducción a 0,72 y desplazamiento de −120 px entre los cuadros 96 y 138. En vertical se conserva la misma animación; título y subtítulo comienzan en y=1280 e y=1392.
- Desde el cuadro 138 solo continúan el giro del anillo y la deriva de las tres manchas al 25 %. No hay audio.
- Fraunces 300 e IBM Plex Mono 400 se cargan mediante `@remotion/google-fonts`, solo el subconjunto latino. El paquete no incluye los binarios: su primera carga en Studio o al renderizar requiere conexión a Google Fonts. No se descargaron fuentes ni se instalaron paquetes durante esta tarea.
