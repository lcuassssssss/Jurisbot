// api/search.js — Proxy serverless para SerpAPI
// Vercel ejecuta esto en el servidor, así que no hay problemas de CORS

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Falta el parámetro query' });
  }

  const apiKey = process.env.SERP_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SERP_KEY no configurada' });
  }

  try {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('hl', 'es');
    url.searchParams.set('gl', 'ar');
    url.searchParams.set('num', '10');

    const resp = await fetch(url.toString());
    const data = await resp.json();

    const resultados = (data.organic_results || []).map(r => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet || '',
    }));

    return res.status(200).json({ resultados });
  } catch (err) {
    console.error('Error SerpAPI:', err);
    return res.status(500).json({ error: 'Error al buscar', detalle: err.message });
  }
}
