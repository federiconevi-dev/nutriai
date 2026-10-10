// Generates one image with FLUX.1 [schnell] on Cloudflare Workers AI.
// GET /api/ai-image?p=<prompt>  →  image/jpeg (cached at the CDN, so the same prompt is only paid once).
export default async (req) => {
  const url = new URL(req.url);
  const prompt = (url.searchParams.get('p') || '').slice(0, 900).trim();
  if (prompt.length < 3) return new Response('Falta la descripción de la imagen.', { status: 400 });
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return new Response('El servidor no tiene configurado Cloudflare.', { status: 503 });

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 6 })
  });
  if (!res.ok) return new Response(`Cloudflare respondió ${res.status}: ${(await res.text()).slice(0, 300)}`, { status: res.status === 429 ? 429 : 502 });
  const data = await res.json();
  const b64 = data && data.result && data.result.image;
  if (!b64) return new Response('Cloudflare no devolvió imagen.', { status: 502 });
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable'
    }
  });
};

export const config = { path: '/api/ai-image', method: 'GET' };
