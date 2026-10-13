import { chat } from '../lib/llm.mjs';
import { guard, fail } from '../lib/guard.mjs';
// Finds a stock clip for a b-roll moment on Pexels (PEXELS_API_KEY) or Pixabay (PIXABAY_API_KEY), both free.
// GET /api/broll-video?q=<english keywords>  →  { url, w, h, dur } (cached at the CDN per query)
export default async (req) => {
  const no = guard(req); if (no) return no;
  const sp = new URL(req.url).searchParams, q = (sp.get('q') || '').slice(0, 80).trim(), want2 = (sp.get('want') || '').slice(0, 300);
  if (q.length < 2) return Response.json({ error: 'Falta la búsqueda.' }, { status: 400 });
  const cache = { headers: { 'Cache-Control': 'public, max-age=86400', 'Netlify-CDN-Cache-Control': 'public, durable, max-age=604800' } };
  const pexels = Netlify.env.get('PEXELS_API_KEY'), pixabay = Netlify.env.get('PIXABAY_API_KEY');
  if (!pexels && !pixabay) return Response.json({ error: 'No hay clave de videos de stock.' }, { status: 503 });
  if (pexels) {
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=8&size=medium`, { headers: { Authorization: pexels } }).catch(() => null);
    const data = r && r.ok ? await r.json() : {};
    for (const vid of data.videos || []) {
      if (vid.duration < 3) continue;
      const files = (vid.video_files || []).filter(f => f.file_type === 'video/mp4' && f.height > f.width && f.height >= 960)
        .sort((a, b) => Math.abs(a.height - 1280) - Math.abs(b.height - 1280));
      if (files[0]) return Response.json({ url: `/api/clip?u=${encodeURIComponent(files[0].link)}`, w: files[0].width, h: files[0].height, dur: vid.duration }, cache);
    }
  }
  if (pixabay) {
    const r = await fetch(`https://pixabay.com/api/videos/?key=${encodeURIComponent(pixabay.trim())}&q=${encodeURIComponent(q)}&per_page=20&safesearch=true`).catch(() => null);
    if (!r || !r.ok) { console.log('pixabay', r ? r.status : 'offline'); return fail('El banco de videos no respondió.', 502); }
    const hits = (await r.json()).hits || [];
    // Vertical clips first; a wide clip still works (it is cropped to 9:16), so use the sharpest small-enough file.
    const pick = h => { const v = h.videos || {}; return [v.medium, v.large, v.small].find(f => f && f.url && f.width && f.size < 18e6); };
    // Only clips whose tags really match what is being said (Pixabay search alone returns loose matches).
    const want = q.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2);
    const score = h => { const tags = (h.tags || '').toLowerCase(); return want.filter(w => tags.includes(w.replace(/s$/, ''))).length; };
    const need = Math.min(2, want.length);
    const ranked = hits.filter(h => h.duration >= 3 && pick(h) && score(h) >= need)
      .sort((a, b) => (score(b) - score(a)) * 2 + ((pick(b).height > pick(b).width) - (pick(a).height > pick(a).width))).slice(0, 6);
    // A second AI check: the clip must clearly show what the moment needs, or nothing is used.
    let h = null, check = '';
    if (ranked.length && want2) {
      const { text } = await chat('You check stock footage for a video editor. Reply ONLY with the number of the clip whose tags clearly show the wanted scene, or 0 if none clearly fits. Be strict: a loosely related or symbolic clip is 0.', `Wanted scene: ${want2}\nClips:\n${ranked.map((c, i) => `${i + 1}: ${c.tags}`).join('\n')}`, 60).catch(() => ({ text: '' }));
      check = String(text || '').slice(0, 80);
      const n = parseInt((text.match(/\d+/) || ['0'])[0], 10);
      h = n >= 1 && n <= ranked.length ? ranked[n - 1] : null;
    } else h = ranked[0] || null;
    if (!h && ranked.length) { console.log('broll check', check); return fail('Ningún clip encaja', 404); }
    if (h) { const f = pick(h); return Response.json({ url: `/api/clip?u=${encodeURIComponent(f.url)}`, w: f.width, h: f.height, dur: h.duration }, cache); }
  }
  return Response.json({ error: 'Sin resultados' }, { status: 404 });
};

export const config = { path: '/api/broll-video', method: 'GET', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
