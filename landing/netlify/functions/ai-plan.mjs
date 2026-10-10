// Art direction: turns what the person says (usually Spanish) into short English image prompts, one per moment.
// POST /api/ai-plan  { text, subjects: string[] }  →  { prompts: string[] }
const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];

export default async (req) => {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const subjects = Array.isArray(body.subjects) ? body.subjects.slice(0, 12).map(s => String(s).slice(0, 300)) : [];
  const text = String(body.text || '').slice(0, 4000);
  if (!subjects.length) return Response.json({ prompts: [] });
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return Response.json({ error: 'El servidor no tiene configurado Cloudflare.' }, { status: 503 });

  const system = 'You are the art director of viral short-form videos. For each numbered moment, write ONE vivid English image prompt (max 25 words) for a single striking visual metaphor that matches what is being said: one clear subject, centered, no text, no letters, no logos, no people talking to camera. Reply ONLY with lines in the form "N: prompt".';
  const user = `Full transcript (for context): ${text}\n\nMoments:\n${subjects.map((s, i) => `${i + 1}: ${s}`).join('\n')}`;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 900, temperature: 0.6 })
      });
      if (!res.ok) continue;
      const data = await res.json();
      const out = String((data.result && data.result.response) || '');
      const prompts = subjects.map((s, i) => {
        const m = out.match(new RegExp(`^\\s*${i + 1}\\s*[:.)-]\\s*(.+)$`, 'm'));
        return m ? m[1].replace(/^["']|["']$/g, '').trim() : s;
      });
      return Response.json({ prompts, model });
    } catch { /* try next model */ }
  }
  return Response.json({ prompts: subjects, fallback: true });
};

export const config = { path: '/api/ai-plan', method: 'POST' };
