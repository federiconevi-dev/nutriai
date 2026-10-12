// Streams a stock clip from Pixabay/Pexels with CORS headers so the editor can draw it on its canvas and export it.
// GET /api/clip?u=<https url on an allowed host>
const HOSTS = ['cdn.pixabay.com', 'videos.pexels.com'];
export default async (req: Request) => {
  const u = new URL(req.url).searchParams.get('u') || '';
  let target: URL;
  try { target = new URL(u); } catch { return new Response('Bad url', { status: 400 }); }
  if (target.protocol !== 'https:' || !HOSTS.includes(target.hostname)) return new Response('Host not allowed', { status: 403 });
  const headers: Record<string, string> = {};
  const range = req.headers.get('range'); if (range) headers.Range = range;
  const r = await fetch(target.toString(), { headers });
  const out = new Headers({ 'Access-Control-Allow-Origin': '*', 'Content-Type': 'video/mp4', 'Cache-Control': 'public, max-age=604800', 'Accept-Ranges': 'bytes' });
  for (const h of ['content-length', 'content-range']) { const v = r.headers.get(h); if (v) out.set(h, v); }
  return new Response(r.body, { status: r.status, headers: out });
};
export const config = { path: '/api/clip' };
