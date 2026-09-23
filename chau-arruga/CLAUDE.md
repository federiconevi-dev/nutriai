# chau arruga. — Emprendimiento Vapo 1000

Emprendimiento de Fede (Buenos Aires): reventa de una plancha a vapor de mano importada de 1688, con marca propia y landing de venta directa. Todo el contenido de cara al cliente va en **español rioplatense con voseo** ("comprá", "tenés", "llevate").

## Marca
- **Nombre:** chau arruga. (en minúscula, con el punto final en fucsia)
- **Producto:** Vapo 1000 (por los 1000W). Se presenta como producto propio, nunca como genérico.
- **Instagram/TikTok:** @chauarruga (**no está verificado que esté libre**)
- **Tono:** cercano, directo, que llame a la compra. Sin exagerar ni prometer cosas no comprobadas.

## Identidad visual
| Token | Hex | Uso |
|---|---|---|
| Crema | #F7F1EA | Fondo general |
| Blanco | #FFFFFF | Tarjetas |
| Tinta | #221C1A | Texto, bloques oscuros, footer |
| Gris | #5E534D | Texto secundario |
| Fucsia | #B0126E | Acento, botones de compra (combina con el producto) |
| Rosa | #F6E1EC | Fondos suaves, chips |

- Tipografías: **Bricolage Grotesque** 800 para títulos, **DM Sans** para texto (Google Fonts).
- Las fotos son cálidas (beige/durazno) con el producto gris y fucsia; mantener esa estética.

## Producto (ficha del proveedor traducida)
- Modelo ZN-530, "plancha a vapor de mano"
- 1000W · 220V / 50Hz (también existe versión 110V pidiéndola)
- Tanque de 60 ml · calienta en 9 s
- 25 × 7,5 × 9 cm · ~500 g · cable de 1,5 m
- 2 en 1: vertical (colgada) u horizontal (apoyada), con vapor o en seco, placa cerámica
- Mango que gira 90° y se pliega con un clic
- Telas: algodón, lino, lana, paño, seda, sintéticos
- En la caja: plancha + base de apoyo + vasito medidor
- Color: gris con fucsia

## Proveedor (1688)
- Link: https://qr.1688.com/s/CrEEYzDE (offer ID 1032112108470). Solo abre desde la app de 1688; desde la web/herramientas no carga.
- Fábrica: 苍南富萌日用品厂 (Cangnan, Wenzhou, Zhejiang)
- Precio: ¥32 a ¥48,8 (≈ US$5 a 7,5), dropshipping desde ¥31,9
- +1000 vendidas, 61% de recompra, despacho en 48 h
- **Ojo:** las fotos 101592.jpg y 101593.jpg (blanca y verde) son OTRO modelo. No usarlas.
- **Pendiente:** confirmar con el proveedor qué tipo de ficha trae (las chinas de patas planas no entran en Argentina sin adaptador).

## Precios y oferta
- 1 unidad: **$39.990** (precio de lanzamiento)
- 2 unidades: **$69.990** (ahorrás $9.990) → "una para vos y otra para regalar"
- 3 cuotas sin interés de $13.330 con Mercado Pago
- Transferencia: **$35.990** (10% OFF)
- Envío gratis a todo el país, despacho 24/48 h hábiles
- Garantía de 3 meses · 10 días para arrepentirse (obligatorio por ley en ventas online, Ley 24.240)
- Referencia de mercado (Mercado Libre, sept. 2026): SmartTek ~$47.399, otras entre ~$40.000 y $55.000
- **Pendiente:** validar que el margen cierre con el costo real puesto en Argentina + envío gratis + costo de cuotas de Mercado Pago.

## Reglas de contenido (no romper)
- **No** poner precios "antes" tachados inventados (Ley de Lealtad Comercial).
- **No** inventar reseñas ni testimonios. Agregar solo reseñas reales de clientes.
- **No** usar estas promesas del fabricante, que no están comprobadas: "esteriliza el 99,99% de ácaros", "10 veces más vapor", "plancha 18 prendas por carga", "protección contra fugas eléctricas".
- No usar fotos de otras marcas sacadas de internet.

## Estructura del proyecto
```
index.html        Landing completa (HTML + CSS + JS vanilla, sin build). Responsive.
img/              Fotos del proveedor recortadas (sin texto en chino), listas para usar
assets/proveedor/ Fotos originales del proveedor (con texto en chino), solo de referencia
CLAUDE.md         Este archivo
```

### Cómo funciona `index.html`
- Objeto `CONFIG` al principio del `<script>`: número de WhatsApp y links de pago de Mercado Pago por pack.
- Si un pack no tiene link de Mercado Pago, el botón de compra abre WhatsApp con el pedido ya escrito.
- Galería con miniaturas, selector de pack (1 o 2 unidades) que actualiza el botón, FAQ con `<details>`, y barra de compra fija en mobile.

## Pendientes
1. ~~Número de WhatsApp en `CONFIG.whatsapp`~~ (hecho: 5491135149209).
2. Links de pago de Mercado Pago (1 y 2 unidades) en `CONFIG.packs`.
3. Confirmar el tipo de ficha con el proveedor.
4. Verificar que @chauarruga esté libre y, si se quiere, comprar el dominio.
5. Publicar en Netlify (sitio creado: chau-arruga.netlify.app, falta el primer deploy; `netlify.toml` publica solo index.html + img/) y agregar Pixel de Meta y TikTok para medir los anuncios.
6. Cuando haya ventas: sección de reseñas reales y fotos propias del producto.
7. Contenido para TikTok/Reels con los ángulos de la landing: "chau arrugas en 9 segundos", "entra en la cartera", "regalo para el Día de la Madre".
