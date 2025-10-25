export default function handler(req, res) {
  // icono vacío (silencia el 500)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.status(204).end(); // No Content
}
