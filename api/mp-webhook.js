// api/mp-webhook.js — Webhook de Mercado Pago
// Activa automáticamente al usuario cuando el pago es aprobado
// Identifica el plan por external_reference (formato: "tier|plan|email")

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN_PROD || process.env.MP_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { type, data } = req.body;

  // Solo nos interesan los eventos de suscripción o pago
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

    // Verificar estado
    const estado = mpData.status;
    const activo = estado === 'authorized' || estado === 'approved' || estado === 'active';

    if (!activo) return res.status(200).json({ ok: true, estado });

    // ─────────────────────────────────────────────────────────────
    // IDENTIFICACIÓN DEL PLAN
    // Método 1 (nuevo): external_reference con formato "tier|plan|email"
    // Método 2 (fallback): por monto, para compatibilidad con pagos viejos
    // ─────────────────────────────────────────────────────────────
    let tier = null;
    let planFrecuencia = null;

    const externalRef = mpData.external_reference || '';
    if (externalRef.includes('|')) {
      const parts = externalRef.split('|');
      if (parts.length >= 2 && ['basico', 'pro'].includes(parts[0]) && ['mensual', 'anual'].includes(parts[1])) {
        tier = parts[0];
        planFrecuencia = parts[1];
      }
    }

    // Fallback por monto si no viene external_reference válido
    if (!tier || !planFrecuencia) {
      const monto = mpData.auto_recurring?.transaction_amount || mpData.transaction_amount || 0;
      // Identificación por rango de monto
      if (monto >= 250000) { tier = 'pro'; planFrecuencia = 'anual'; }
      else if (monto >= 100000) { tier = 'basico'; planFrecuencia = 'anual'; }
      else if (monto >= 20000) { tier = 'pro'; planFrecuencia = 'mensual'; }
      else { tier = 'basico'; planFrecuencia = 'mensual'; }
    }

    // Calcular vencimiento
    const ahora = new Date();
    const vencimiento = new Date(ahora);
    if (planFrecuencia === 'anual') {
      vencimiento.setFullYear(vencimiento.getFullYear() + 1);
    } else {
      vencimiento.setMonth(vencimiento.getMonth() + 1);
    }

    // Valor que guardamos en "plan": combinación tier + frecuencia
    // Formato: "basico-mensual", "pro-anual", etc.
    const planCompleto = `${tier}-${planFrecuencia}`;

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
        plan: planCompleto,
        fecha_inicio: ahora.toISOString(),
        fecha_vencimiento: vencimiento.toISOString(),
        mp_preapproval_id: resourceId,
      })
    });

    if (!susResp.ok) {
      console.error('Error Supabase:', await susResp.text());
      return res.status(500).json({ error: 'Error actualizando Supabase' });
    }

    console.log(`✅ Usuario activado: ${email} — Plan: ${planCompleto}`);
    return res.status(200).json({ ok: true, email, plan: planCompleto });

  } catch (err) {
    console.error('Error webhook:', err);
    return res.status(500).json({ error: 'Error interno', detalle: err.message });
  }
}
