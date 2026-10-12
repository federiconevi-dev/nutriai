// Finds a stock clip for a b-roll moment on Pexels (PEXELS_API_KEY) or Pixabay (PIXABAY_API_KEY), both free.
// GET /api/broll-video?q=<english keywords>  →  { url, w, h, dur } (cached at the CDN per query)
export default async (req) => {
  const q = (new URL(req.url).searchParams.get('q') || '').slice(0, 80).trim();
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
    const r = await fetch(`https://pixabay.com/api/videos/?key=${pixabay}&q=${encodeURIComponent(q)}&per_page=20&safesearch=true`).catch(() => null);
    const hits = r && r.ok ? (await r.json()).hits || [] : [];
    // Vertical clips first; a wide clip still works (it is cropped to 9:16), so use the sharpest small-enough file.
    const pick = h => { const v = h.videos || {}; return [v.medium, v.large, v.small].find(f => f && f.url && f.width && f.size < 18e6); };
    const ranked = hits.filter(h => h.duration >= 3 && pick(h)).sort((a, b) => (pick(b).height > pick(b).width) - (pick(a).height > pick(a).width));
    const h = ranked[0];
    if (h) { const f = pick(h); return Response.json({ url: `/api/clip?u=${encodeURIComponent(f.url)}`, w: f.width, h: f.height, dur: h.duration }, cache); }
  }
  return Response.json({ error: 'Sin resultados' }, { status: 404 });
};

export const config = { path: '/api/broll-video', method: 'GET' };
