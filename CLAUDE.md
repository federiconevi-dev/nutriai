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
- Current site: `videora-app` (siteId `d4647f69-4fdd-4a02-98c3-93da7ebe2ce7`, team `nevifederico`) → https://videora-app.netlify.app (old: videora-studio, other account, out of credits)
- Copy `landing/{public,netlify,netlify.toml}` to scratchpad `site/`, call `deploy-site`, run the returned `npx -y @netlify/mcp@latest --site-id … --proxy-path …` from that folder.
- Env vars (set by the user in Netlify UI): CF_ACCOUNT_ID, CF_API_TOKEN, OLLAMA_API_KEY, PIXABAY_API_KEY, (PEXELS_API_KEY optional).
- Free credits are limited: batch changes, deploy rarely. Cloudflare image quota is daily (resets 21 h Argentina) — avoid burning it in tests.

## Testing
- Headless Chromium can't decode H.264: convert test videos to VP9 webm. Playwright: `executablePath: '/opt/pw-browsers/chromium'`.
- Branch: `claude/viroedit-analysis-3n5slr`. No model names in commits.

## Code graph
- `landing/graphify-out/GRAPH_REPORT.md` + `graph.json`: map of the code. Use `graphify query "..."` / `graphify explain "X"` before reading files. Refresh with `graphify update landing` (no LLM).

## Security (keep it this way)
- Every `/api/*` function starts with `guard(req, { perMin })` from `netlify/lib/guard.mjs`: same-site only (Origin/Referer must be videora-studio.netlify.app, its deploy previews or localhost), body cap 128 KB, per-IP limit per minute (in-memory backup) + literal `config.rateLimit`. Errors via `fail()` never include upstream text or keys.
- `edge-functions/clip.ts`: same-site only, https `.mp4` on cdn.pixabay.com / videos.pexels.com only, final host re-checked after redirects, 60 MB cap. Edge config: only `path` (a `method` key breaks the build).
- `netlify.toml` [[headers]]: CSP (scripts only self + cdn.jsdelivr.net; add any new external host there or it will be blocked), frame-ancestors none, HSTS, nosniff, Permissions-Policy. No inline scripts or `on*=` handlers in HTML.
- AI output shown in the page is escaped; AI settings/toggles are whitelisted server-side and client-side.
- Testing the per-IP limit from this sandbox doesn't work: the outbound IP rotates per request.
