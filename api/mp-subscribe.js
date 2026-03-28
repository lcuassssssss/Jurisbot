// api/mp-subscribe.js — Crea suscripción en Mercado Pago
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { plan, email } = req.body;
  if (!plan || !['mensual', 'anual'].includes(plan)) {
    return res.status(400).json({ error: 'Plan inválido' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  // Precios en centavos (MP usa la moneda en su valor entero para ARS)
  const precios = {
    mensual: { monto: 45000, frecuencia: 1, tipo: 'months', label: 'Plan Mensual JurisBot' },
    anual:   { monto: 499000, frecuencia: 12, tipo: 'months', label: 'Plan Anual JurisBot' },
  };

  const p = precios[plan];

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
        auto_recurring: {
          frequency: p.frecuencia,
          frequency_type: p.tipo,
          transaction_amount: p.monto,
          currency_id: 'ARS',
        },
        back_url: `${baseUrl}?suscripcion=ok`,
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
