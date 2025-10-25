module.exports = async (req, res) => {
  try {
    const { prompt = '' } = (req.body || {});
    res.status(200).json({
      ok: true,
      prompt,
      result: `preview://shape/${encodeURIComponent(prompt)}`,
      note: 'Mock generado localmente'
    });
  } catch (err) {
    console.error('shape error', err);
    res.status(500).json({ ok: false, error: 'shape_failed' });
  }
};




