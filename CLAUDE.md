# Videora — automatic vertical video editor (free, viroedit-style)

User: Spanish (Argentina), non-technical. Reply SHORT, in Spanish, only what's needed. Never ask for or repeat API keys in chat.

## Where things are
- Site: `landing/` (static + Netlify Functions). Publish dir `landing/public`, functions `landing/netlify/functions/*.mjs` (`config.path = '/api/...'`), edge fn `landing/netlify/edge-functions/clip.ts`.
- `public/index.html` — landing + editor UI (tabs Automático / Personalizado, font pickers, formats).
- `public/ui.js` — UI wiring, AI director call (`/api/ai-direct`), font pickers, formats, typography packs.
- `public/editor.js` — the engine (canvas 720x1280): transcription (Whisper in `asr-worker.js`), plan/beats, drawing, sounds (Web Audio synth), export (WebCodecs fast export).
- Functions: `ai-direct` (AI picks format/typo/hooks/fixes words), `ai-plan` (b-roll picks + image prompts + stock search keywords), `ai-image` (Cloudflare FLUX), `broll-video` (Pixabay/Pexels + AI relevance check), `ai-health`. `lib/llm.mjs` = Ollama cloud first, then Cloudflare.

## Engine key concepts (editor.js)
- `RECIPES` = edit formats (cine, podcast, energia, historia, noticia, minimal): caption mode, capY, b-roll layout, title positions, transition, impact-screen backgrounds, pace, hook.
- `TYPO` = type pairings (title/kicker/cap/keyF + colors). `FONT_LIB` = 59 Google fonts, `fontOf`, `ensureFonts`. Roles: `baseF` (Texto base), `keyF` (Palabra destacada), `accF` (Acento cursivo).
- Style `viro` = default pro look. Captions: `viroCaption` / `lineCaption` / `wordCaption`. Titles: `viroPhotoText`. Impact screens: `drawKin`. Hook: `drawStackHook`.
- B-roll: `makeBeats` → `B.photos` (img from AI, `vid` from stock); `brollMedia`, fit-card for non-vertical media; `brollSeek` syncs clips in export.
- Sounds: `sfx(type)`; synth kit in `sfxExtra`; `WORD_SFX` maps spoken words → sounds.

## Deploy (Netlify MCP)
- Current site: `videora-studio` (siteId `224e74d4-9f44-4906-9899-168859b20df3`, team `federiconevi`) → https://videora-studio.netlify.app
- Copy `landing/{public,netlify,netlify.toml}` to scratchpad `site/`, call `deploy-site`, run the returned `npx -y @netlify/mcp@latest --site-id … --proxy-path …` from that folder.
- Env vars (set by the user in Netlify UI): CF_ACCOUNT_ID, CF_API_TOKEN, OLLAMA_API_KEY, PIXABAY_API_KEY, (PEXELS_API_KEY optional).
- Free credits are limited: batch changes, deploy rarely. Cloudflare image quota is daily (resets 21 h Argentina) — avoid burning it in tests.

## Testing
- Headless Chromium can't decode H.264: convert test videos to VP9 webm. Playwright: `executablePath: '/opt/pw-browsers/chromium'`.
- Branch: `claude/viroedit-analysis-3n5slr`. No model names in commits.
