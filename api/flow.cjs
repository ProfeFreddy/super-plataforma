// api/flow.cjs
// Stub mínimo para probar. Sustituye luego con tu lógica real hacia Flow.
module.exports.init = async (req, res) => {
  // TODO: crear pago en Flow y devolver URL
  return res.json({ ok: true, echo: req.body || null });
};
