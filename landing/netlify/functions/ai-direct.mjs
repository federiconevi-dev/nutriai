import { chat } from '../lib/llm.mjs';
import { guard, fail, readJson } from '../lib/guard.mjs';
// AI director: reads what the person says and picks the whole edit (or applies a change asked in plain words).
// POST /api/ai-direct { text, request?, current? } → { settings, hookTitle, reason }
const ALLOWED = {
  style: ['viro', 'viral', 'hormozi', 'editorial', 'coral', 'minimal'],
  mg: ['noir', 'dark', 'bw', 'cine', 'photo', 'vintage', 'coral', 'neonpink', 'clean'],
  ovStyle: ['auto', 'glass', 'neon', 'mono', 'graph', 'femtech', 'cyber'],
  hookFx: ['flash', 'zoom', 'iris', 'swipe', 'glitch', 'blackout', 'blur', 'cine', 'none'],
  hookText: ['auto', 'stack', 'viro', 'big', 'card', 'question', 'none'],
  brollLayout: ['auto', 'split', 'card', 'full'],
  hookSfx: ['auto', 'impact', 'riser', 'whoosh', 'scratch', 'notif', 'drop', 'zap', 'bass', 'cash', 'glitch', 'suspense', 'heart', 'none'],
  grade: ['none', 'warm', 'teal', 'punch', 'film', 'bw'],
  fBase: ['auto', 'Plus Jakarta Sans', 'Inter Tight', 'Manrope', 'DM Sans', 'Sora', 'Montserrat', 'Poppins', 'Outfit', 'Space Grotesk', 'Bricolage Grotesque'],
  fKey: ['auto', 'Anton', 'Bebas Neue', 'Oswald', 'Big Shoulders Display', 'Archivo Black', 'Unbounded', 'Syne', 'Montserrat', 'Outfit'],
  fAccent: ['auto', 'Instrument Serif', 'Fraunces', 'Cormorant Garamond', 'Playfair Display', 'DM Serif Display', 'Caveat'],
  music: ['motiva', 'chill', 'lujo', 'misterio', 'none'],
  recipe: ['cine', 'podcast', 'energia', 'historia', 'noticia', 'minimal'],
  typo: ['nova', 'lujo', 'revista', 'tech', 'suave', 'clasico', 'urbano'],
  cKey: ['auto', '#ffe14d', '#22e06b', '#ff4d6d', '#ef233c', '#ff6046', '#38bdf8', '#a855f7', '#f472b6', '#ffffff']
};
const TOGGLES = ['optFollow', 'optPunch', 'optLoop', 'optGallery', 'optBig', 'optPhotos', 'optAI', 'optMG', 'optOverlay', 'optStats', 'optEmoji', 'optFx', 'optZoom', 'optFrame', 'optCut', 'optSfx', 'optHook', 'optBar'];

const GUIDE = `Options (pick exactly from these):
style (caption look): viro=pro look (full-screen AI images with elegant titles, short phrases on white/black screens, small captions with a glowing word; the default and best for almost every video) | viral=clean white captions with glowing key word (personal brand, calm, educational) | hormozi=bold captions with colored box (high energy, sales, motivation) | editorial=elegant italic serif (storytelling, emotional, reflective) | coral=warm cream/coral cards (friendly tips, lifestyle, wellness) | minimal=text on dark band (tutorials, information)
mg (look of animated screens): noir=black + lime | dark=black + yellow | bw=black & white press, red box | cine=warm noir, gold | photo=real AI photos, dark | vintage=paper collage, red | coral=cream & coral 3D | neonpink=neon pink | clean=white & blue
ovStyle (idea cards): auto|glass|neon|mono|graph|femtech|cyber
hookFx (first second): flash (energetic) | zoom (punch-in) | iris (circle opening) | swipe (TikTok swipe-up) | glitch (tech) | blackout (title on black, then cut) | blur (soft, aesthetic) | cine (dramatic letterbox) | none
brollLayout (how supporting images appear): split (image top, person bottom - great for explaining) | card (image card on top) | full (full-screen cutaway)
hookText: stack (3 stacked mixed-font lines at the top, strongest) | viro (the hook title over the opening image) | big (giant word) | card (white card on top) | question (big question over the opening) | auto
hookSfx (sound in the first second): impact | riser (build-up + hit) | whoosh | scratch (record scratch, funny) | notif (phone notification) | drop (bass drop) | zap | bass (808 hit) | cash (cash register, money topics) | glitch (tech/AI) | suspense (rising tension, secrets) | heart (heartbeat, emotional) | auto
grade (video color): none|warm|teal|punch|film|bw
fBase/fKey/fAccent fonts: ${['fBase', 'fKey', 'fAccent'].map(k => `${k}: ${ALLOWED[k].join(', ')}`).join('; ')}
music (generated background music, ducked under the voice): motiva (upbeat drums, sales/fitness/motivation) | chill (soft lo-fi, advice, lifestyle, calm talks) | lujo (trap hats, premium, money, fashion) | misterio (dark, secrets, stories, true facts) | none\nrecipe (edit format, the most important choice; pick what will hold THIS audience best): cine=full-screen images with titles, glowing captions, warm light leaks (versatile, aspirational, business, lifestyle) | podcast=split screen, white pill captions, calm (interviews, explanations, long talks) | energia=fast cuts, colored box on the spoken word, flashes, many impact screens (sales, fitness, motivation, hype) | historia=elegant cursive captions, images in cards, soft zooms (stories, emotional, reflective, travel) | noticia=one big word at a time, black opening title, slides (news, facts, controversial takes, lists) | minimal=sober, small captions, few screens (premium, minimal, design, calm advice)\ntypo (type pairing for the pro look): nova=modern grotesk + serif italic, blue keys (business, growth, tech-light) | lujo=wide luxury display + classic italic, gold (premium, money, fashion) | revista=magazine serif, coral (stories, opinions, culture) | tech=geometric wide + mono, violet (AI, apps, programming) | suave=friendly rounded, pink (lifestyle, beauty, wellness, food) | clasico=heavy black + Playfair italic, yellow (motivation, sales, fitness) | urbano=grotesk + handwritten, green (casual, gaming, humor)
cKey (key word color): ${ALLOWED.cKey.join(', ')}
toggles (true/false): ${TOGGLES.join(', ')} (optFrame = video inside a card with title, use only for motivational/quote videos)
Keep colors coherent: when you pick mg, set cKey to "auto" unless the user asks for a color.`;

export default async (req) => {
  const no = guard(req); if (no) return no;
  let body;
  try { body = await readJson(req); } catch { return fail('Pedido inválido.', 400); }
  const text = String(body.text || '').slice(0, 4000), request = String(body.request || '').slice(0, 400);
  const info = body.info && typeof body.info === 'object' ? JSON.stringify(body.info).slice(0, 400) : '{}';
  const current = body.current && typeof body.current === 'object' ? JSON.stringify(body.current).slice(0, 1500) : '{}';
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return Response.json({ error: 'El servidor no tiene configurado Cloudflare.' }, { status: 503 });

  const system = `You are a world-class short-form video editor (TikTok/Reels). ${request ? 'Apply the user\'s requested change to the current settings, changing only what is needed.' : 'Read the transcript and choose the best possible edit for this specific video: tone, topic and audience must drive every choice. Keep style "viro" and brollLayout "auto"; pick the "music" mood, the "recipe" (edit format) and the "typo" that best fit the topic, tone and audience (vary them: do not default to the same one every time), the visual hook (hookFx: blur, flash, zoom, iris or cine) and the sound hook (hookSfx) that best grab attention for this topic.'}
${GUIDE}
Also write "hookTitle": a short, punchy on-screen hook (max 8 words) in the SAME language as the transcript, based on its real content (no clickbait lies). It must be perfectly natural and grammatical, with correct spelling and accents, addressed to the viewer (for Spanish from Argentina use correct voseo, e.g. "¿Querés subir de nivel?", never mixed forms like "¿Subí de nivel y dominá…?"). Also write "hookAlts": an array of 3 more alternative hooks (same rules, different angles: curiosity, bold claim, question). And "post": the text to publish with the video, in the same language: 1-2 short catchy lines + a call to comment, then 5-8 relevant hashtags. Also write "fixes": an object mapping single words the automatic transcription clearly misheard or misspelled to the correct single word, with accents (e.g. {"desloqueas":"desbloqueás"}); only obvious errors, {} if none. And "reason": one short sentence in Spanish (rioplatense) explaining the look you chose to the creator: talk only about the typography (by its name) and the mood, never mention caption styles or internal option keys.
Reply with ONLY one JSON object: {"style":..,"recipe":..,"typo":..,"mg":..,"ovStyle":..,"hookFx":..,"hookText":..,"hookSfx":..,"brollLayout":..,"grade":..,"fBase":..,"fKey":..,"fAccent":..,"cKey":..,"toggles":{..},"hookTitle":..,"hookAlts":[..],"post":..,"fixes":{..},"reason":..}`;
  const user = `Video facts: ${info}\nTranscript: ${text || '(no speech)'}\nCurrent settings: ${current}${request ? `\nUser request: ${request}` : ''}`;
  let last = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text: out, model } = await chat(system, user, 1100);
    last = out.slice(0, 300);
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) continue;
    try {
      const raw = JSON.parse(m[0]);
      const settings = {};
      for (const [k, list] of Object.entries(ALLOWED)) if (list.includes(raw[k])) settings[k] = raw[k];
      const toggles = {};
      if (raw.toggles && typeof raw.toggles === 'object') for (const k of TOGGLES) if (typeof raw.toggles[k] === 'boolean') toggles[k] = raw.toggles[k];
      return Response.json({ settings, toggles, hookTitle: String(raw.hookTitle || '').slice(0, 70), hookAlts: Array.isArray(raw.hookAlts) ? raw.hookAlts.slice(0, 3).map(x => String(x).slice(0, 70)) : [], post: String(raw.post || '').slice(0, 600), fixes: raw.fixes && typeof raw.fixes === 'object' ? Object.fromEntries(Object.entries(raw.fixes).slice(0, 40).map(([a, b]) => [String(a).slice(0, 30), String(b).slice(0, 30)])) : {}, reason: String(raw.reason || '').slice(0, 300), model });
    } catch (e) { last += ` | ${e.message}`; }
  }
  console.log('ai-direct failed', last);
  return fail('La IA no respondió. Probá de nuevo.', 502);
};

export const config = { path: '/api/ai-direct', method: 'POST', rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
