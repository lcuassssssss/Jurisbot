// api/calculadora.js — Calculadora de indemnizaciones LCT (despido sin causa)
// Cálculos basados en Ley de Contrato de Trabajo 20.744 y modificatorias

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const {
      fechaIngreso,
      fechaEgreso,
      mrmnh,               // Mejor remuneración mensual, normal y habitual (art. 245)
      remuMesDespido,      // Remuneración del mes del despido (para integración)
      diaDespido,          // Día del mes en que se produjo el despido (1-31)
      preavisoOtorgado,    // boolean: ¿se otorgó preaviso?
      vacacionesNoGozadas, // días no gozados del año en curso
      tope,                // opcional: tope del CCT (art. 245 segundo párrafo)
    } = req.body;

    // Validaciones
    if (!fechaIngreso || !fechaEgreso || !mrmnh) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios: fechaIngreso, fechaEgreso, mrmnh',
      });
    }

    const fIngreso = new Date(fechaIngreso);
    const fEgreso = new Date(fechaEgreso);

    if (isNaN(fIngreso) || isNaN(fEgreso)) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }
    if (fEgreso <= fIngreso) {
      return res.status(400).json({ error: 'La fecha de egreso debe ser posterior a la de ingreso' });
    }

    const mrmnhNum = parseFloat(mrmnh);
    const remuMesDespidoNum = parseFloat(remuMesDespido) || mrmnhNum;
    const vacDias = parseInt(vacacionesNoGozadas) || 0;
    const diaDesp = parseInt(diaDespido) || 1;

    // ─────────────────────────────────────────────────────────────
    // 1) ANTIGÜEDAD
    // Art. 245 LCT: se computa como año entero la fracción > 3 meses
    // ─────────────────────────────────────────────────────────────
    const msDiff = fEgreso - fIngreso;
    const diasTotales = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    const aniosExactos = diasTotales / 365.25;
    const aniosEnteros = Math.floor(aniosExactos);
    const mesesExtra = Math.floor((aniosExactos - aniosEnteros) * 12);

    let aniosArt245 = aniosEnteros;
    if (mesesExtra > 3) aniosArt245 += 1;
    if (aniosArt245 < 1) aniosArt245 = 1; // mínimo 1 año

    // ─────────────────────────────────────────────────────────────
    // 2) BASE PARA ART. 245
    // Se aplica tope del CCT si corresponde (3 x promedio CCT)
    // ─────────────────────────────────────────────────────────────
    let baseArt245 = mrmnhNum;
    if (tope && parseFloat(tope) > 0 && mrmnhNum > parseFloat(tope)) {
      // Doctrina Vizzoti: tope máximo del 33%
      const vizzotti = mrmnhNum * 0.67;
      baseArt245 = Math.max(parseFloat(tope), vizzotti);
    }

    // ─────────────────────────────────────────────────────────────
    // 3) INDEMNIZACIÓN POR ANTIGÜEDAD (art. 245 LCT)
    // = base × años (mínimo 1 mes de sueldo)
    // ─────────────────────────────────────────────────────────────
    const art245 = Math.max(baseArt245 * aniosArt245, mrmnhNum);

    // ─────────────────────────────────────────────────────────────
    // 4) PREAVISO (art. 231 y 232 LCT)
    // Sustitutiva si no se otorgó:
    //   - < 5 años antigüedad: 1 mes
    //   - >= 5 años: 2 meses
    // ─────────────────────────────────────────────────────────────
    let preaviso = 0;
    if (!preavisoOtorgado) {
      const mesesPreaviso = aniosEnteros < 5 ? 1 : 2;
      preaviso = mrmnhNum * mesesPreaviso;
    }

    // SAC sobre preaviso: 1/12 del preaviso
    const sacPreaviso = preaviso / 12;

    // ─────────────────────────────────────────────────────────────
    // 5) INTEGRACIÓN MES DE DESPIDO (art. 233 LCT)
    // Días que faltaban para terminar el mes del despido
    // ─────────────────────────────────────────────────────────────
    const diasDelMes = new Date(
      fEgreso.getFullYear(),
      fEgreso.getMonth() + 1,
      0
    ).getDate();
    const diasFaltantes = diasDelMes - diaDesp;
    const integracion = (remuMesDespidoNum / diasDelMes) * diasFaltantes;

    // SAC sobre integración: 1/12
    const sacIntegracion = integracion / 12;

    // ─────────────────────────────────────────────────────────────
    // 6) SAC PROPORCIONAL (art. 121 LCT)
    // El SAC se devenga día a día. Al cese corresponde la parte
    // proporcional del semestre en curso.
    // ─────────────────────────────────────────────────────────────
    const mesEgreso = fEgreso.getMonth(); // 0-11
    const diaEgreso = fEgreso.getDate();
    // ¿En qué semestre estamos? Primer semestre: ene-jun. Segundo: jul-dic.
    const inicioSemestre = mesEgreso < 6
      ? new Date(fEgreso.getFullYear(), 0, 1)
      : new Date(fEgreso.getFullYear(), 6, 1);
    const diasSemestre = Math.floor((fEgreso - inicioSemestre) / (1000 * 60 * 60 * 24)) + 1;
    const diasSemestreTotal = 180; // aproximación estándar
    const sacProporcional = (mrmnhNum / 2) * (diasSemestre / diasSemestreTotal);

    // ─────────────────────────────────────────────────────────────
    // 7) VACACIONES NO GOZADAS (art. 156 LCT)
    // Valor día vacacional = sueldo / 25
    // ─────────────────────────────────────────────────────────────
    const valorDiaVacacional = mrmnhNum / 25;
    const vacaciones = valorDiaVacacional * vacDias;
    const sacVacaciones = vacaciones / 12;

    // ─────────────────────────────────────────────────────────────
    // TOTAL
    // ─────────────────────────────────────────────────────────────
    const total =
      art245 +
      preaviso +
      sacPreaviso +
      integracion +
      sacIntegracion +
      sacProporcional +
      vacaciones +
      sacVacaciones;

    return res.status(200).json({
      antiguedad: {
        aniosEnteros,
        mesesExtra,
        aniosArt245,
        diasTotales,
      },
      detalle: {
        indemnizacionAntiguedad: round2(art245),
        preaviso: round2(preaviso),
        sacPreaviso: round2(sacPreaviso),
        integracionMesDespido: round2(integracion),
        sacIntegracion: round2(sacIntegracion),
        sacProporcional: round2(sacProporcional),
        vacacionesNoGozadas: round2(vacaciones),
        sacVacaciones: round2(sacVacaciones),
      },
      total: round2(total),
      baseArt245: round2(baseArt245),
      aplicoVizzotti: baseArt245 !== mrmnhNum,
    });
  } catch (err) {
    console.error('Error calculadora:', err);
    return res.status(500).json({ error: 'Error al calcular', detalle: err.message });
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
