// api/auth-register.js — Registro con Supabase Auth
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email, password, nombre } = req.body;
  if (!email || !password || !nombre) return res.status(400).json({ error: 'Completá todos los campos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    // Crear usuario en Supabase Auth
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: { nombre },
        email_confirm: true, // No requerir confirmación de email por ahora
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      if (data.msg?.includes('already registered') || data.message?.includes('already registered')) {
        return res.status(400).json({ error: 'Ya existe una cuenta con ese email' });
      }
      return res.status(400).json({ error: data.msg || data.message || 'No se pudo crear la cuenta' });
    }

    // Guardar en tabla suscriptores
    await fetch(`${SUPABASE_URL}/rest/v1/suscriptores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, password_hash: '', activo: false }),
    });

    // Hacer login automático para obtener token
    const loginResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginResp.json();
    return res.status(200).json({ ok: true, token: loginData.access_token, nombre });
  } catch(e) {
    return res.status(500).json({ error: 'Error interno', detalle: e.message });
  }
}
