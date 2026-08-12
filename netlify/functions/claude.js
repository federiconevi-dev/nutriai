// Netlify Function (formato moderno, runtime "nodejs18.x" o superior).
// Corre en el servidor de Netlify — acá es el ÚNICO lugar donde vive la
// API key. El navegador del usuario nunca la ve.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Falta configurar la variable de entorno ANTHROPIC_API_KEY en Netlify (Site settings > Environment variables)." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Límite de tokens defensivo, por si alguien intenta abusar del endpoint
  const maxTokens = Math.min(Number(body.max_tokens) || 1000, 2000);

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-5",
        max_tokens: maxTokens,
        system: body.system,
        messages: body.messages,
      }),
    });

    const data = await anthropicRes.json();
    return new Response(JSON.stringify(data), {
      status: anthropicRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "No se pudo contactar a la API de Claude: " + e.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
