// Usa fetch nativo en Node 18+; si no existe, importa node-fetch con un import dinámico que Vite no analiza.
const fetch =
  globalThis.fetch ||
  (async (...a) =>
    (await new Function('s', 'return import(s)')('node-fetch')).default(...a));

module.exports = async (req, res) => {
  try {
    // Asegura header JSON siempre
    if (res.setHeader) res.setHeader('content-type', 'application/json; charset=utf-8');

    // params del query
    const { asignatura = '', nivel = '', unidad = '' } = req.query || {};

    // --------- Llama al upstream (opcional) ---------
    // Si falla o devuelve HTML, servimos MOCK.
    let items = null;
    try {
      const url = `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=${encodeURIComponent(asignatura)}&nivel=${encodeURIComponent(nivel)}&unidad=${encodeURIComponent(unidad)}`;
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      const ct = (r.headers && (r.headers.get?.('content-type') || r.headers['content-type'])) || '';

      if (r.ok && String(ct).includes('application/json')) {
        const data = await r.json();
        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        items = list.map((x, i) => ({
          id: String(x.id ?? x.codigo ?? `OA-${i + 1}`),
          titulo: String(x.titulo ?? x.descripcion ?? x.nombre ?? `Objetivo ${i + 1}`),
          minutos: Number(x.minutos ?? 45),
          unidad: String(x.unidad ?? unidad ?? 'UNIDAD').toUpperCase(),
        }));
      }
    } catch (_) {
      // seguimos al mock
    }

    // --------- MOCK si no hubo JSON válido ---------
    if (!items) {
      items = [
        { id: 'MOCK-OA1', titulo: 'OA: FRACCIONES 1', minutos: 45, unidad: 'FRACCIONES' },
        { id: 'MOCK-OA2', titulo: 'OA: FRACCIONES 2', minutos: 45, unidad: 'FRACCIONES' },
      ];
    }

    res.status(200).json(items);
  } catch (err) {
    console.error('mineduc error', err);
    res.status(500).json({ ok: false, error: 'mineduc_failed' });
  }
};








