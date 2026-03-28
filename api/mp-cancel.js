// api/mp-cancel.js — Cancelar suscripción en Mercado Pago
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    // Obtener el ID de suscripción de MP guardado en Supabase
    const susResp = await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}&select=mp_preapproval_id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const sus = await susResp.json();
    const preapprovalId = sus?.[0]?.mp_preapproval_id;

    if (preapprovalId) {
      // Cancelar en Mercado Pago
      await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
        body: JSON.stringify({ status: 'cancelled' })
      });
    }

    // Marcar como inactivo en Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ activo: false, plan: null })
    });

    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: 'Error interno', detalle: e.message });
  }
}
