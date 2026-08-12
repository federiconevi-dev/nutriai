# NutriAI — listo para desplegar

App de nutrición, entrenamiento y seguimiento con IA. Frontend en React + Vite,
backend en una Netlify Function que guarda tu API key de Claude del lado del
servidor (nunca queda expuesta en el navegador).

## 1. Conseguí tu API key de Claude

Andá a https://console.anthropic.com → API Keys → "Create Key". Copiala, la vas a
necesitar en el paso 4. (Esto es un proyecto aparte de tu cuenta de Claude.ai —
la API se paga por uso, revisá precios en console.anthropic.com).

## 2. Subí el proyecto a GitHub

```bash
cd nutriai-deploy
git init
git add .
git commit -m "NutriAI"
```

Creá un repo en GitHub y pusheá:

```bash
git remote add origin https://github.com/TU_USUARIO/nutriai.git
git branch -M main
git push -u origin main
```

## 3. Conectá el repo en Netlify

1. Entrá a https://app.netlify.com → "Add new site" → "Import an existing project"
2. Elegí GitHub y seleccioná tu repo `nutriai`
3. Netlify va a detectar automáticamente `netlify.toml` (build command `npm run build`,
   carpeta `dist`, funciones en `netlify/functions`) — no toques nada, dale "Deploy"

## 4. Configurá la API key (paso crítico)

En el dashboard de Netlify de tu sitio:

**Site configuration → Environment variables → Add a variable**

- Key: `ANTHROPIC_API_KEY`
- Value: la key que copiaste en el paso 1
- Scopes: dejalo en "All scopes" / "Same value for all deploy contexts"

Después hacé un **re-deploy** (Deploys → Trigger deploy → Deploy site) para que la
función tome la variable nueva.

## 5. Listo

Tu sitio va a estar en algo como `https://tu-nombre-random.netlify.app`. Desde
Netlify podés:
- Cambiarle el nombre del subdominio (Site configuration → Domain management)
- Conectarle un dominio propio si tenés uno

## Probarlo en tu computadora antes de subirlo (opcional)

```bash
npm install
npm install -g netlify-cli   # una sola vez
netlify dev
```

`netlify dev` levanta el frontend Y la función juntos en `localhost:8888`, usando
un archivo `.env` local (copiá `.env.example` a `.env` y poné tu key ahí — ese
archivo nunca se sube a GitHub gracias al `.gitignore`).

## Cómo funciona la seguridad de la API key

El frontend (`src/App.jsx`) nunca llama directo a `api.anthropic.com`. Llama a
`/.netlify/functions/claude`, una función que corre en el servidor de Netlify,
lee `ANTHROPIC_API_KEY` de las variables de entorno, y ahí sí llama a la API de
Claude. Nadie que abra tu sitio puede ver la key mirando el código del navegador.

## Datos del usuario

Cada persona que use la app tiene sus datos guardados en el `localStorage` de
*su propio navegador* (perfil, comidas, entrenamientos, peso). No hay base de
datos compartida — si alguien borra el sitio de su navegador o entra desde otro
dispositivo, no ve sus datos anteriores. Para eso ya sería el siguiente paso:
sumar una base de datos real (ej. Supabase) con cuentas de usuario.
