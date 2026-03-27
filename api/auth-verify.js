// api/auth-verify.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ ok: false });

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });

    const usuarios = await resp.json();
    if (!usuarios || usuarios.length === 0) return res.status(200).json({ ok: false });

    const usuario = usuarios[0];
    if (usuario.mp_preapproval_id !== token) return res.status(200).json({ ok: false });

    // Verificar si la suscripción venció
    let activo = usuario.activo;
    if (activo && usuario.fecha_vencimiento) {
      if (new Date(usuario.fecha_vencimiento) < new Date()) {
        activo = false;
        await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ activo: false })
        });
      }
    }

    return res.status(200).json({ ok: true, activo, plan: usuario.plan });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
