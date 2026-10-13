// Streams a stock clip from Pixabay/Pexels with CORS headers so the editor can draw it on its canvas and export it.
// GET /api/clip?u=<https url on an allowed host>. Only this site may use it (no open proxy), only video files pass.
const HOSTS = ['cdn.pixabay.com', 'videos.pexels.com'];
const SITE = /^(videora-studio\.netlify\.app|[a-z0-9-]+--videora-studio\.netlify\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/;
const okHost = (h: string) => HOSTS.includes(h) || h.endsWith('.pixabay.com') || h.endsWith('.pexels.com');
const no = (msg: string, status: number) => new Response(msg, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export default async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return no('Method not allowed', 405);
  let from = '';
  try { from = new URL(req.headers.get('origin') || req.headers.get('referer') || '').host; } catch { /* none */ }
  if (!SITE.test(from) || req.headers.get('sec-fetch-site') === 'cross-site') return no('Forbidden', 403);
  const u = (new URL(req.url).searchParams.get('u') || '').slice(0, 600);
  let target: URL;
  try { target = new URL(u); } catch { return no('Bad url', 400); }
  if (target.protocol !== 'https:' || !HOSTS.includes(target.hostname) || target.username || target.password || target.port || !/\.mp4$/i.test(target.pathname)) return no('Not allowed', 403);
  const headers: Record<string, string> = {};
  const range = req.headers.get('range'); if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;
  const r = await fetch(target.toString(), { headers, redirect: 'follow' }).catch(() => null);
  if (!r || !(r.status === 200 || r.status === 206) || !okHost(new URL(r.url).hostname)) return no('Upstream error', 502);
  const len = Number(r.headers.get('content-length') || 0);
  if (r.status === 200 && len > 60e6) return no('Too big', 413);
  const out = new Headers({ 'Access-Control-Allow-Origin': new URL(req.url).origin, 'Vary': 'Origin', 'Content-Type': 'video/mp4', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=604800', 'Accept-Ranges': 'bytes' });
  for (const h of ['content-length', 'content-range']) { const v = r.headers.get(h); if (v) out.set(h, v); }
  return new Response(req.method === 'HEAD' ? null : r.body, { status: r.status, headers: out });
};
export const config = { path: '/api/clip', method: ['GET', 'HEAD'] };
