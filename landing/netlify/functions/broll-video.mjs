// Finds a vertical stock clip for a b-roll moment on Pexels (free API key in PEXELS_API_KEY).
// GET /api/broll-video?q=<english keywords>  →  { url, w, h, dur } (cached at the CDN per query)
export default async (req) => {
  const q = (new URL(req.url).searchParams.get('q') || '').slice(0, 80).trim();
  if (q.length < 2) return Response.json({ error: 'Falta la búsqueda.' }, { status: 400 });
  const key = Netlify.env.get('PEXELS_API_KEY');
  if (!key) return Response.json({ error: 'Pexels no está configurado.' }, { status: 503 });
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=8&size=medium`, { headers: { Authorization: key } }).catch(() => null);
  if (!r || !r.ok) return Response.json({ error: `Pexels respondió ${r ? r.status : 'sin conexión'}` }, { status: 502 });
  const data = await r.json();
  for (const vid of data.videos || []) {
    if (vid.duration < 3) continue;
    const files = (vid.video_files || []).filter(f => f.file_type === 'video/mp4' && f.height > f.width && f.height >= 960)
      .sort((a, b) => Math.abs(a.height - 1280) - Math.abs(b.height - 1280));
    if (files[0]) return Response.json({ url: files[0].link, w: files[0].width, h: files[0].height, dur: vid.duration }, {
      headers: { 'Cache-Control': 'public, max-age=86400', 'Netlify-CDN-Cache-Control': 'public, durable, max-age=604800' }
    });
  }
  return Response.json({ error: 'Sin resultados' }, { status: 404 });
};

export const config = { path: '/api/broll-video', method: 'GET' };
