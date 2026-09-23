# Roll-up SAN Insumos Digitales (85 × 200 cm)

- `rollup-85x200.pdf`: archivo para imprenta, a tamaño real (850 × 2000 mm) y vectorial.
- `rollup-preview.png`: vista previa.
- `rollup.html`: fuente editable (1 px = 1 mm).

Los textos salen de www.insumosdigitales.com. Las máquinas están dibujadas como ilustraciones vectoriales.
Para usar fotos reales, copialas en `fotos/` con estos nombres y volvé a generar el PDF:

| Máquina | Archivo |
|---|---|
| Láser Color | `fotos/01-laser-color.jpg` |
| Láser Blanco y Negro | `fotos/02-laser-bn.jpg` |
| Híbrida UV | `fotos/03-hibrida-uv.jpg` |
| Ecosolvente + plotter integrado | `fotos/04-ecosolvente.jpg` |
| UV CMYK + Blanco + Barniz | `fotos/05-uv-stickers.jpg` |
| DTF Textil | `fotos/06-dtf-textil.jpg` |
| Plotter de corte QR | `fotos/07-plotter-corte.jpg` |
| Corte Láser | `fotos/08-corte-laser.jpg` |
| Laminado y montaje | `fotos/09-laminado.jpg` |

Para regenerar: `npm i playwright && node render.js`.

Zona de seguridad: los últimos ~7 cm quedan dentro de la base del roll-up y solo llevan color.
Tipografía: Montserrat (SIL Open Font License, ver `fonts/OFL.txt`).
