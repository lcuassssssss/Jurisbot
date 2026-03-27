// api/claude.js — Proxy serverless para Anthropic Claude
// Vercel ejecuta esto en el servidor, así que no hay problemas de CORS

const SYSTEM_PROMPTS = {
  consulta: `Sos un asistente legal especializado en derecho argentino. 
Respondé consultas legales de forma clara, precisa y útil, citando cuando sea posible 
el artículo del CCyC, CN u otras normas relevantes. 
Aclará que tu respuesta es orientativa y no reemplaza el asesoramiento de un abogado.
Respondé en español rioplatense.`,

  resumen: `Sos un asistente especializado en derecho argentino. 
Tu tarea es resumir fallos judiciales de forma clara y estructurada.
Identificá: tribunal, fecha, partes, hechos clave, decisión y fundamentos principales.
Respondé en español rioplatense con formato limpio.`,

  articulos: `Sos un asistente legal especializado en el Código Civil y Comercial (CCyC) 
y la Constitución Nacional (CN) argentina.
Cuando te pregunten por un artículo, transcribilo textualmente si lo conocés 
y luego explicá su alcance de forma clara.
Respondé en español rioplatense.`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { query, tab } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Falta el parámetro query' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_KEY no configurada' });
  }

  const systemPrompt = SYSTEM_PROMPTS[tab] || SYSTEM_PROMPTS.consulta;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Error Anthropic:', data);
      return res.status(500).json({ error: 'Error de la IA', detalle: data.error?.message });
    }

    const texto = data.content?.[0]?.text || 'No se pudo obtener respuesta.';
    return res.status(200).json({ texto });
  } catch (err) {
    console.error('Error Claude:', err);
    return res.status(500).json({ error: 'Error al consultar la IA', detalle: err.message });
  }
}
