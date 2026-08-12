// Netlify Function — proxy hacia Google Gemini (nivel gratuito).
// Recibe el mismo formato que antes usábamos con Claude ({system, messages,
// max_tokens}) y lo traduce al formato de Gemini, y traduce la respuesta de
// vuelta al mismo formato que el frontend ya sabe leer. Así el resto de la
// app (chat, recetas, fotos, etc.) no necesitó cambiar nada.
//
// La API key de Gemini vive ACÁ, en el servidor — el navegador nunca la ve.

const GEMINI_MODEL = "gemini-3.6-flash";

function toGeminiContents(messages) {
  return (messages || []).map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    let parts;
    if (typeof m.content === "string") {
      parts = [{ text: m.content }];
    } else if (Array.isArray(m.content)) {
      parts = m.content.map((block) => {
        if (block.type === "text") return { text: block.text };
        if (block.type === "image") {
          return { inline_data: { mime_type: block.source?.media_type, data: block.source?.data } };
        }
        return { text: "" };
      });
    } else {
      parts = [{ text: String(m.content ?? "") }];
    }
    return { role, parts };
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: { message: "Método no permitido" } }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: "Falta configurar la variable de entorno GEMINI_API_KEY en Netlify (Site configuration > Environment variables)." } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: "Body inválido" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const maxTokens = Math.min(Number(body.max_tokens) || 1000, 2000);

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: body.system ? { parts: [{ text: body.system }] } : undefined,
          contents: toGeminiContents(body.messages),
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message || `Error de Gemini (${geminiRes.status})`;
      return new Response(JSON.stringify({ error: { message: msg } }), {
        status: geminiRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n");

    // Traducimos la respuesta de Gemini al mismo formato que el frontend
    // ya sabe interpretar: { content: [{ type: "text", text: "..." }] }
    return new Response(JSON.stringify({ content: [{ type: "text", text }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: "No se pudo contactar a Gemini: " + e.message } }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
