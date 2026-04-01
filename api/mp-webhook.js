// api/mp-webhook.js — Webhook de Mercado Pago
// Activa automáticamente al usuario cuando el pago es aprobado

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN_PROD || process.env.MP_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { type, data } = req.body;

  // Solo nos interesan los eventos de suscripción
  if (type !== 'subscription_preapproval' && type !== 'payment') {
    return res.status(200).json({ ok: true, ignorado: true });
  }

  try {
    const resourceId = data?.id;
    if (!resourceId) return res.status(200).json({ ok: true });

    // Consultar el detalle del pago/suscripción a MP
    const endpoint = type === 'payment'
      ? `https://api.mercadopago.com/v1/payments/${resourceId}`
      : `https://api.mercadopago.com/preapproval/${resourceId}`;

    const mpResp = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
    });
    const mpData = await mpResp.json();

    // Obtener email del pagador
    const email = mpData.payer?.email || mpData.payer_email;
    if (!email) return res.status(200).json({ ok: true, sin_email: true });

    // Verificar si el pago/suscripción está activo/aprobado
    const estado = mpData.status;
    const activo = estado === 'authorized' || estado === 'approved' || estado === 'active';

    if (!activo) return res.status(200).json({ ok: true, estado });

    // Determinar el plan según el monto
    const monto = mpData.auto_recurring?.transaction_amount || mpData.transaction_amount || 0;
    const plan = monto >= 400000 ? 'anual' : 'mensual';

    // Calcular fecha de vencimiento
    const ahora = new Date();
    const vencimiento = new Date(ahora);
    if (plan === 'anual') {
      vencimiento.setFullYear(vencimiento.getFullYear() + 1);
    } else {
      vencimiento.setMonth(vencimiento.getMonth() + 1);
    }

    // Activar en Supabase
    const susResp = await fetch(`${SUPABASE_URL}/rest/v1/suscriptores?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        activo: true,
        plan,
        fecha_inicio: ahora.toISOString(),
        fecha_vencimiento: vencimiento.toISOString(),
        mp_preapproval_id: resourceId,
      })
    });

    if (!susResp.ok) {
      console.error('Error Supabase:', await susResp.text());
      return res.status(500).json({ error: 'Error actualizando Supabase' });
    }

    console.log(`✅ Usuario activado: ${email} — Plan: ${plan}`);
    return res.status(200).json({ ok: true, email, plan });

  } catch (err) {
    console.error('Error webhook:', err);
    return res.status(500).json({ error: 'Error interno', detalle: err.message });
  }
}
