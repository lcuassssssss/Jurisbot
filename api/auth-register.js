// api/auth-register.js
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'jurisbot_salt').digest('hex');
}

function generarToken(email) {
  return crypto.createHash('sha256').update(email + Date.now() + 'jurisbot_token').digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });

  const hash = hashPassword(password);
  const token = generarToken(email);

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/suscriptores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ email, password_hash: hash, activo: false })
    });

    if (resp.status === 409) return res.status(400).json({ error: 'Ya existe una cuenta con ese email' });
    if (!resp.ok) {
      const err = await resp.json();
      return res.status(500).json({ error: 'Error al crear cuenta', detalle: err });
    }

    // Guardar token
    await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ mp_preapproval_id: token })
    });

    return res.status(200).json({ ok: true, token });
  } catch(e) {
    return res.status(500).json({ error: 'Error interno', detalle: e.message });
  }
}
