// compute_sig.js
const crypto = require('crypto');

const CANONICAL = `amount=100&apiKey=32DFEB9D-C49C-4388-911B-97A43C410LBA&commerceOrder=TEST-123&currency=CLP&email=tu%40email.cl&reference=TEST-123&subject=Suscripcion%20Pro&urlConfirmation=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fflow%2Fconfirm&urlReturn=http%3A%2F%2Flocalhost%3A5173%2Fpago%2Fretorno`;

// Pega aquí EXACTO el FLOW_SECRET que Node imprimió (sin comillas)
const SECRET = `7785925932dbb93630b6318ad747db3daf63a08f`;

function hmacHex(bufSecret, str) {
  return crypto.createHmac('sha256', bufSecret).update(str).digest('hex');
}
function hmacB64(bufSecret, str) {
  return crypto.createHmac('sha256', bufSecret).update(str).digest('base64');
}

console.log('CANONICAL:', CANONICAL);
console.log('--- SECRET treated as UTF8 string ---');
console.log('utf8 hex:', hmacHex(Buffer.from(SECRET, 'utf8'), CANONICAL));
console.log('utf8 b64:', hmacB64(Buffer.from(SECRET, 'utf8'), CANONICAL));
console.log('--- SECRET treated as HEX bytes (Buffer.from(secret, \"hex\")) ---');
try {
  const sHex = Buffer.from(SECRET, 'hex');
  console.log('hex-as-bytes hex:', hmacHex(sHex, CANONICAL));
  console.log('hex-as-bytes b64:', hmacB64(sHex, CANONICAL));
} catch (e) {
  console.log('hex decoding failed:', e.message);
}
console.log('--- SECRET treated as BASE64 bytes (Buffer.from(secret, \"base64\")) ---');
try {
  const sB64 = Buffer.from(SECRET, 'base64');
  console.log('b64-decoded hex:', hmacHex(sB64, CANONICAL));
  console.log('b64-decoded b64:', hmacB64(sB64, CANONICAL));
} catch (e) {
  console.log('base64 decoding failed:', e.message);
}
