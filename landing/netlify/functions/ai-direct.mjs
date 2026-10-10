import { ollamaChat } from '../lib/ollama.mjs';
// AI director: reads what the person says and picks the whole edit (or applies a change asked in plain words).
// POST /api/ai-direct { text, request?, current? } → { settings, hookTitle, reason }
const ALLOWED = {
  style: ['viral', 'hormozi', 'editorial', 'coral', 'minimal'],
  mg: ['noir', 'dark', 'bw', 'cine', 'photo', 'vintage', 'coral', 'neonpink', 'clean'],
  ovStyle: ['auto', 'glass', 'neon', 'mono', 'graph', 'femtech', 'cyber'],
  hookFx: ['flash', 'blur', 'cine', 'none'],
  grade: ['none', 'warm', 'teal', 'punch', 'film', 'bw'],
  fBase: ['auto', 'Plus Jakarta Sans', 'Inter', 'Montserrat', 'Poppins', 'Outfit', 'Space Grotesk'],
  fKey: ['auto', 'Anton', 'Bebas Neue', 'Archivo Black', 'Montserrat', 'Outfit'],
  fAccent: ['auto', 'Instrument Serif', 'Playfair Display', 'DM Serif Display', 'Caveat', 'Permanent Marker', 'Great Vibes'],
  cKey: ['auto', '#ffe14d', '#22e06b', '#ff4d6d', '#ef233c', '#ff6046', '#38bdf8', '#a855f7', '#f472b6', '#ffffff']
};
const TOGGLES = ['optBig', 'optPhotos', 'optAI', 'optMG', 'optOverlay', 'optStats', 'optEmoji', 'optFx', 'optZoom', 'optFrame', 'optCut', 'optSfx', 'optHook', 'optBar'];

const GUIDE = `Options (pick exactly from these):
style (caption look): viral=clean white captions with glowing key word (personal brand, calm, educational) | hormozi=bold captions with colored box (high energy, sales, motivation) | editorial=elegant italic serif (storytelling, emotional, reflective) | coral=warm cream/coral cards (friendly tips, lifestyle, wellness) | minimal=text on dark band (tutorials, information)
mg (look of animated screens): noir=black + lime | dark=black + yellow | bw=black & white press, red box | cine=warm noir, gold | photo=real AI photos, dark | vintage=paper collage, red | coral=cream & coral 3D | neonpink=neon pink | clean=white & blue
ovStyle (idea cards): auto|glass|neon|mono|graph|femtech|cyber
hookFx (first second): flash (energetic) | blur (soft, aesthetic) | cine (dramatic letterbox) | none
grade (video color): none|warm|teal|punch|film|bw
fBase/fKey/fAccent fonts: ${['fBase', 'fKey', 'fAccent'].map(k => `${k}: ${ALLOWED[k].join(', ')}`).join('; ')}
cKey (key word color): ${ALLOWED.cKey.join(', ')}
toggles (true/false): ${TOGGLES.join(', ')} (optFrame = video inside a card with title, use only for motivational/quote videos)
Keep colors coherent: when you pick mg, set cKey to "auto" unless the user asks for a color.`;

export default async (req) => {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const text = String(body.text || '').slice(0, 4000), request = String(body.request || '').slice(0, 400);
  const current = body.current && typeof body.current === 'object' ? JSON.stringify(body.current).slice(0, 1500) : '{}';
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return Response.json({ error: 'El servidor no tiene configurado Cloudflare.' }, { status: 503 });

  const system = `You are a world-class short-form video editor (TikTok/Reels). ${request ? 'Apply the user\'s requested change to the current settings, changing only what is needed.' : 'Read the transcript and choose the best possible edit for this specific video: tone, topic and audience must drive every choice.'}
${GUIDE}
Also write "hookTitle": a short, punchy on-screen hook (max 8 words) in the SAME language as the transcript, based on its real content (no clickbait lies), and "reason": one sentence in Spanish (rioplatense) explaining the choice to the creator.
Reply with ONLY one JSON object: {"style":..,"mg":..,"ovStyle":..,"hookFx":..,"grade":..,"fBase":..,"fKey":..,"fAccent":..,"cKey":..,"toggles":{..},"hookTitle":..,"reason":..}`;
  const user = `Transcript: ${text || '(no speech)'}\nCurrent settings: ${current}${request ? `\nUser request: ${request}` : ''}`;
  let last = '';
  for (const model of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct']) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 700, temperature: 0.4 })
      });
      if (!res.ok) { last = `${model} ${res.status} ${(await res.text()).slice(0, 200)}`; continue; }
      const data = await res.json();
      const r0 = data.result && data.result.response;
      const out = typeof r0 === 'string' ? r0 : JSON.stringify(r0 || '');
      last = `${model}: ${out.slice(0, 300)}`;
      const m = out.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const raw = JSON.parse(m[0]);
      const settings = {};
      for (const [k, list] of Object.entries(ALLOWED)) if (list.includes(raw[k])) settings[k] = raw[k];
      const toggles = {};
      if (raw.toggles && typeof raw.toggles === 'object') for (const k of TOGGLES) if (typeof raw.toggles[k] === 'boolean') toggles[k] = raw.toggles[k];
      return Response.json({ settings, toggles, hookTitle: String(raw.hookTitle || '').slice(0, 70), reason: String(raw.reason || '').slice(0, 300), model });
    } catch (e) { last += ` | ${e.message}`; }
  }
  const alt = await ollamaChat(system, user);
  const m2 = alt.match(/\{[\s\S]*\}/);
  if (m2) {
    try {
      const raw = JSON.parse(m2[0]);
      const settings = {};
      for (const [k, list] of Object.entries(ALLOWED)) if (list.includes(raw[k])) settings[k] = raw[k];
      const toggles = {};
      if (raw.toggles && typeof raw.toggles === 'object') for (const k of TOGGLES) if (typeof raw.toggles[k] === 'boolean') toggles[k] = raw.toggles[k];
      return Response.json({ settings, toggles, hookTitle: String(raw.hookTitle || '').slice(0, 70), reason: String(raw.reason || '').slice(0, 300), model: 'ollama' });
    } catch (e) { last += ` | ollama ${e.message}`; }
  }
  console.log('ai-direct failed', last);
  return Response.json({ error: 'La IA no respondió. Probá de nuevo.', detail: last.slice(0, 400) }, { status: 502 });
};

export const config = { path: '/api/ai-direct', method: 'POST' };
