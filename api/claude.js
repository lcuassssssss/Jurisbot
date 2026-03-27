export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, tab } = req.body;
  if (!query) return res.status(400).json({ error: 'Query requerida' });

  const sistemas = {
    consulta: 'Sos un asistente legal argentino experto. Respondé la consulta de forma clara, citando artículos del CCyC, CN o leyes cuando corresponda. Aclará que tu respuesta es orientativa y no reemplaza el asesoramiento de un abogado matriculado.',
    resumen: 'Sos un asistente legal argentino. Resumí el fallo o caso descripto de forma clara: partes, hechos principales, decisión del tribunal y fundamentos. Sé conciso y preciso.',
    articulos: 'Sos un asistente legal argentino. El usuario pregunta por artículos del Código Civil y Comercial (CCyC) o la Constitución Nacional (CN). Transcribí el artículo solicitado y explicá brevemente su aplicación práctica con ejemplos concretos.'
  };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: sistemas[tab] || sistemas.consulta,
        messages: [{ role: 'user', content: query }]
      })
    });
    const data = await resp.json();
    const texto = data.content?.[0]?.text || 'No se pudo obtener respuesta.';
    res.status(200).json({ texto });
  } catch(e) {
    res.status(500).json({ error: 'Error al consultar IA' });
  }
}
