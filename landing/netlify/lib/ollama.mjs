// Backup text AI: Ollama's cloud API (used only when Cloudflare's text model fails).
export async function ollamaChat(system, user) {
  const key = Netlify.env.get('OLLAMA_API_KEY');
  if (!key) return '';
  for (const model of ['gpt-oss:120b', 'gpt-oss:20b']) {
    try {
      const res = await fetch('https://ollama.com/api/chat', {
        method: 'POST',
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
