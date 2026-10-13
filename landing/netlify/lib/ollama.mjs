// Main text AI: Ollama's cloud API (Cloudflare's text model is the fallback, see llm.mjs).
export async function ollamaChat(system, user) {
  const key = Netlify.env.get('OLLAMA_API_KEY');
  if (!key) return '';
  // Time-boxed so a slow answer never makes the whole function time out (Cloudflare's model takes over).
  for (const [model, ms] of [['gpt-oss:120b', 9000], ['gpt-oss:20b', 6000]]) {
    try {
      const res = await fetch('https://ollama.com/api/chat', {
        method: 'POST', signal: AbortSignal.timeout(ms),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
      });
      if (!res.ok) { console.log('ollama', model, res.status); continue; }
      const data = await res.json();
      const out = data && data.message && data.message.content;
      if (out) return String(out);
    } catch (e) { console.log('ollama', model, e.message); }
  }
  return '';
}
