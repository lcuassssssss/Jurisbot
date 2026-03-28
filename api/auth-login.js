// api/auth-login.js — Login con Supabase Auth
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Completá todos los campos' });

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }

    const token = data.access_token;
    const nombre = data.user?.user_metadata?.nombre || email.split('@')[0];

    // Obtener estado de suscripción
    const susResp = await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}&select=activo,plan`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const sus = await susResp.json();
    const activo = sus?.[0]?.activo || false;
    const plan = sus?.[0]?.plan || null;

    return res.status(200).json({ ok: true, token, nombre, activo, plan });
  } catch(e) {
    return res.status(500).json({ error: 'Error interno', detalle: e.message });
  }
}
