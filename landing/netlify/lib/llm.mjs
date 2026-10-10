// Text AI: Ollama cloud first (keeps Cloudflare's free daily quota for images), then Cloudflare's small model.
import { ollamaChat } from './ollama.mjs';

export async function chat(system, user, maxTokens = 800) {
  const o = await ollamaChat(system, user);
  if (o) return { text: o, model: 'ollama' };
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return { text: '', model: '' };
  for (const model of ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast']) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.5 })
      });
      if (!res.ok) continue;
      const data = await res.json();
      const r = data.result && data.result.response;
      const text = typeof r === 'string' ? r : JSON.stringify(r || '');
      if (text) return { text, model };
    } catch { /* next */ }
  }
  return { text: '', model: '' };
}
