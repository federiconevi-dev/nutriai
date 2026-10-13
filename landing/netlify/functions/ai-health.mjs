// Quick status of the AI services (no secrets in the output). GET /api/ai-health
import { ollamaChat } from '../lib/ollama.mjs';
import { guard } from '../lib/guard.mjs';

export default async (req) => {
  const no = guard(req); if (no) return no;
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  const out = { cloudflare: 'sin configurar', ollama: Netlify.env.get('OLLAMA_API_KEY') ? 'configurado' : 'sin configurar' };
  if (account && token) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 })
      });
      out.cloudflare = r.ok ? 'funciona' : `error ${r.status}`;
    } catch (e) { out.cloudflare = 'error de conexión'; }
  }
  if (out.ollama === 'configurado') out.ollama = (await ollamaChat('Reply with OK.', 'OK?')) ? 'funciona' : 'no responde';
  return Response.json(out);
};

export const config = { path: '/api/ai-health', method: 'GET', rateLimit: { windowLimit: 4, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
