const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));

module.exports = async (req, res) => {
  const { asignatura = '', nivel = '', unidad = '' } = req.query || {};
  const url = `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=${encodeURIComponent(asignatura)}&nivel=${encodeURIComponent(nivel)}&unidad=${encodeURIComponent(unidad)}`;

  try {
    const r = await fetch(url);
    const contentType = r.headers.get('content-type') || '';
    const ok = r.ok;
    let textPreview = '';

    if (contentType.includes('application/json')) {
      const j = await r.json();
      textPreview = JSON.stringify(j).slice(0, 500);
    } else {
      const t = await r.text();
      textPreview = t.slice(0, 500);
    }

    res.status(200).json({ upstream: url, status: r.status, ok, contentType, textPreview });
  } catch (err) {
    res.status(500).json({ upstream: url, ok: false, error: String(err) });
  }
};




