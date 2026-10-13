// Shared protection for every /api function: only this site may call it, bodies stay small,
// and errors never reveal internals. Per-IP request limits live in each function's config.rateLimit (literal values, Netlify reads them statically).
const SITE = /^(videora-studio\.netlify\.app|[a-z0-9-]+--videora-studio\.netlify\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/;
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export const fail = (msg, status) => Response.json({ error: msg }, { status, headers: NO_STORE });

// Backup per-IP limit kept in the warm function instance (Netlify's own rateLimit also applies where the plan has it).
const hits = new Map();
function tooMany(req, perMin) {
  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '?', now = Date.now();
  const k = new URL(req.url).pathname + '|' + ip.split(',')[0].trim(), h = (hits.get(k) || []).filter(t => now - t < 60000);
  h.push(now); hits.set(k, h);
  if (hits.size > 5000) for (const [key, v] of hits) if (now - v[v.length - 1] > 60000) hits.delete(key);
  return h.length > perMin;
}

// Returns a Response to send back when the request must be refused, or null when it may go on.
export function guard(req, { maxBody = 128 * 1024, perMin = 30 } = {}) {
  // Browsers always send Origin (POST, CORS) or Referer (same-site GET) for our own page's requests.
  const from = req.headers.get('origin') || req.headers.get('referer') || '';
  let host = '';
  try { host = new URL(from).host; } catch { /* no or bad header */ }
  if (!SITE.test(host) || req.headers.get('sec-fetch-site') === 'cross-site') return fail('Acceso no permitido.', 403);
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBody) return fail('Pedido demasiado grande.', 413);
  if (tooMany(req, perMin)) return fail('Demasiados pedidos seguidos. Esperá un minuto.', 429);
  return null;
}

// Reads a JSON body with a hard size cap (content-length can be missing or lie).
export async function readJson(req, maxBody = 128 * 1024) {
  const raw = await req.text();
  if (raw.length > maxBody) throw new Error('too big');
  return JSON.parse(raw);
}
