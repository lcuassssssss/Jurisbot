// api/mp-subscribe.js — Crea suscripción en Mercado Pago
// Soporta 4 planes: basico-mensual, basico-anual, pro-mensual, pro-anual

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { plan, tier, email } = req.body;

  // Validaciones
  if (!plan || !['mensual', 'anual'].includes(plan)) {
    return res.status(400).json({ error: 'Plan inválido (mensual o anual)' });
  }
  if (!tier || !['basico', 'pro'].includes(tier)) {
    return res.status(400).json({ error: 'Tier inválido (basico o pro)' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN_PROD || process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
  }

  const baseUrl = 'https://jurisbot-ll83.vercel.app';

  // Tabla de precios — debe coincidir con el webhook
  const precios = {
    'basico-mensual': { monto: 12000,  frecuencia: 1,  tipo: 'months', label: 'JurisBot Básico - Mensual' },
    'basico-anual':   { monto: 120000, frecuencia: 12, tipo: 'months', label: 'JurisBot Básico - Anual' },
    'pro-mensual':    { monto: 26000,  frecuencia: 1,  tipo: 'months', label: 'JurisBot Pro - Mensual' },
    'pro-anual':      { monto: 262000, frecuencia: 12, tipo: 'months', label: 'JurisBot Pro - Anual' },
  };

  const key = `${tier}-${plan}`;
  const p = precios[key];

  if (!p) {
    return res.status(400).json({ error: 'Combinación plan/tier inválida' });
  }

  try {
    const resp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        reason: p.label,
        payer_email: email,
        external_reference: `${tier}|${plan}|${email}`, // guardamos metadata para el webhook
        auto_recurring: {
          frequency: p.frecuencia,
          frequency_type: p.tipo,
          transaction_amount: p.monto,
          currency_id: 'ARS',
        },
        back_url: `${baseUrl}?suscripcion=ok&tier=${tier}&plan=${plan}`,
        status: 'pending',
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Error MP:', data);
      return res.status(500).json({ error: 'Error de Mercado Pago', detalle: data.message });
    }

    return res.status(200).json({ init_point: data.init_point });
  } catch (err) {
    console.error('Error mp-subscribe:', err);
    return res.status(500).json({ error: 'Error interno', detalle: err.message });
  }
}
