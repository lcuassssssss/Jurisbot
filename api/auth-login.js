// api/auth-login.js
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

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });

    const usuarios = await resp.json();
    if (!usuarios || usuarios.length === 0) return res.status(400).json({ error: 'Email o contraseña incorrectos' });

    const usuario = usuarios[0];
    if (usuario.password_hash !== hash) return res.status(400).json({ error: 'Email o contraseña incorrectos' });

    const token = generarToken(email);

    // Actualizar token
    await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ mp_preapproval_id: token })
    });

    return res.status(200).json({ ok: true, token, activo: usuario.activo, plan: usuario.plan });
  } catch(e) {
    return res.status(500).json({ error: 'Error interno', detalle: e.message });
  }
}
