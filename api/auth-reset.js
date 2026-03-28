// api/auth-reset.js — Enviar email de recuperación de contraseña
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({
        email,
        gotrue_meta_security: {},
      }),
    });

    // Siempre devolvemos ok para no revelar si el email existe
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: 'Error interno', detalle: e.message });
  }
}
