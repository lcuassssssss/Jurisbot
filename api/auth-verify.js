// api/auth-verify.js — Verificar token de Supabase Auth
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { email, token } = req.body;
  if (!email || !token) return res.status(200).json({ ok: false });

  try {
    // Verificar token con Supabase
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!resp.ok) return res.status(200).json({ ok: false });

    const user = await resp.json();
    if (user.email !== email) return res.status(200).json({ ok: false });

    const nombre = user.user_metadata?.nombre || email.split('@')[0];

    // Obtener estado de suscripción
    const susResp = await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}&select=activo,plan,fecha_vencimiento`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const sus = await susResp.json();
    let activo = sus?.[0]?.activo || false;
    const plan = sus?.[0]?.plan || null;

    // Verificar vencimiento
    if (activo && sus?.[0]?.fecha_vencimiento) {
      if (new Date(sus[0].fecha_vencimiento) < new Date()) {
        activo = false;
        await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ activo: false })
        });
      }
    }

    return res.status(200).json({ ok: true, activo, plan, nombre });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
