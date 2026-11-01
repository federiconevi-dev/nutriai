# Respondo por vos

Asistente de WhatsApp con IA para negocios, con panel y control de costos.

## Cómo ahorra plata
- **Meta no cobra las respuestas dentro de las 24 h** desde el último mensaje del cliente. El bot solo contesta ahí y en un único mensaje por pregunta.
- Fuera de esa ventana bloquea los envíos libres. Solo deja mandar una **plantilla** (la única que Meta cobra), pide confirmación y anota el gasto.
- Las **preguntas frecuentes y los precios del catálogo se contestan sin IA** (costo cero). La IA (modelo barato) se usa solo para lo demás.
- Si la IA no sabe o el cliente se enoja, pasa el chat a una persona y el bot se pausa.

## Panel (`/`)
Resumen de costos, chats en vivo con la ventana de 24 h de cada uno, responder a mano, pausar el bot, probar el bot sin WhatsApp y editar los datos del negocio.

## Correrlo
```
npm start            # http://localhost:3000, sin claves funciona en modo prueba
```
Variables de entorno:
| Variable | Qué es |
|---|---|
| `WA_TOKEN`, `WA_PHONE_ID` | Token y Phone number ID de WhatsApp Cloud API (Meta for Developers) |
| `WA_VERIFY_TOKEN` | Palabra que inventás y ponés también en Meta al configurar el webhook |
| `WA_APP_SECRET` | Secreto de la app de Meta (verifica que los mensajes vengan de Meta) |
| `ANTHROPIC_API_KEY` | Clave de la IA |
| `PANEL_PASS` | Clave del panel (usuario cualquiera) |
| `PRECIO_MARKETING`, `PRECIO_UTILITY` | Precio por plantilla en USD (por defecto aprox. Argentina) |

## Conectar un cliente
1. Subir esta carpeta a un hosting con Node (Render, Railway, un VPS). Un servidor por cliente.
2. En Meta for Developers: crear app, agregar WhatsApp, cargar el número del negocio.
3. Webhook: `https://TU-URL/webhook` con el `WA_VERIFY_TOKEN`, suscribirse a `messages`.
4. Cargar los datos del negocio desde el panel (pestaña Datos del negocio).
5. Probar con las preguntas del KIT-INSTALACION antes de entregar.
