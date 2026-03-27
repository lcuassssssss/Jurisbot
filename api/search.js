export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query requerida' });

  const SERP_KEY = process.env.SERP_KEY;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=es&gl=ar&num=20&api_key=${SERP_KEY}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const resultados = (data.organic_results || []).filter(r => {
      const l = r.link.toLowerCase(), t = r.title.toLowerCase();
      if (l.includes('boletin') || l.includes('/docs-f/') || l.includes('om.csjn.gov.ar') || l.includes('pubextrs')) return false;
      if (t.includes('novedades') || t.includes('gaceta')) return false;
      if (l.includes('-local-') || l.includes('-nacional-') || l.includes('-provincial-')) return false;
      if (t.includes('código') || t.includes('ley ') || t.includes('decreto') || t.includes('reglamento')) return false;
      if (l.includes('/doctrina/')) return false;
      return true;
    }).map(r => ({ title: r.title, link: r.link }));
    res.status(200).json({ resultados });
  } catch(e) {
    res.status(500).json({ error: 'Error al buscar' });
  }
}
