// flow_test.js
// Uso: node flow_test.js
require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET = process.env.FLOW_SECRET;
const FLOW_URL = (process.env.FLOW_URL || 'https://sandbox.flow.cl').replace(/\/+$/,'');

if (!FLOW_API_KEY || !FLOW_SECRET) {
  console.error('ERROR: exporta FLOW_API_KEY y FLOW_SECRET en tu .env (no los pegues aquí si vas a compartir pantallas).');
  process.exit(1);
}

// Parâmetros de prueba (ajusta según necesites)
const params = {
  apiKey: FLOW_API_KEY,
  amount: 100,
  currency: 'CLP',
  commerceOrder: 'TEST-123',
  reference: 'TEST-123',
  email: 'tu@email.cl',
  subject: 'Suscripcion Pro',
  urlConfirmation: 'http://localhost:8080/api/flow/confirm',
  urlReturn: 'http://localhost:5173/pago/retorno',
};

// canonical url-encoded (Flow a menudo espera esta variante)
function canonicalEncoded(obj){
  return Object.keys(obj).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(obj[k] == null ? '' : obj[k]))}`).join('&');
}

// helpers HMAC
function hmacHex(secretBuf, str){ return crypto.createHmac('sha256', secretBuf).update(str).digest('hex'); }
function hmacB64(secretBuf, str){ return crypto.createHmac('sha256', secretBuf).update(str).digest('base64'); }
function toB64Url(b64){ return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

(async function main(){
  try{
    const canonical = canonicalEncoded(params);
    console.log('CANONICAL (encoded):', canonical);

    // probar secret tal cual texto UTF-8 y como hex bytes (dependiendo de cómo Flow te entregó la secret)
    const secretUtf8 = Buffer.from(String(FLOW_SECRET), 'utf8');
    let secretHexBuf;
    try { secretHexBuf = Buffer.from(String(FLOW_SECRET), 'hex'); } catch(e){ secretHexBuf = null; }

    console.log('\n--- SECRET treated as UTF8 string ---');
    console.log('utf8 hex :', hmacHex(secretUtf8, canonical).slice(0,16));
    console.log('utf8 b64 :', hmacB64(secretUtf8, canonical).slice(0,16));

    if (secretHexBuf) {
      console.log('\n--- SECRET treated as HEX bytes ---');
      console.log('hex-as-bytes hex :', hmacHex(secretHexBuf, canonical).slice(0,16));
      console.log('hex-as-bytes b64 :', hmacB64(secretHexBuf, canonical).slice(0,16));
    } else {
      console.log('\n--- SECRET hex decode failed (not hex) ---');
    }

    // prepare signature variants to try
    const signCandidates = [];
    // from utf8 secret
    signCandidates.push({ paramName: 's', value: hmacHex(secretUtf8, canonical), type: 'hex', note: 'utf8->hex' });
    signCandidates.push({ paramName: 's', value: hmacB64(secretUtf8, canonical), type: 'b64', note: 'utf8->b64' });
    signCandidates.push({ paramName: 'signature', value: hmacHex(secretUtf8, canonical), type: 'hex', note: 'utf8->hex (signature)' });
    signCandidates.push({ paramName: 'signature', value: hmacB64(secretUtf8, canonical), type: 'b64', note: 'utf8->b64 (signature)' });
    signCandidates.push({ paramName: 's', value: toB64Url(hmacB64(secretUtf8, canonical)), type: 'b64url', note: 'utf8->b64url' });

    // if secret could be hex bytes, add those signatures too
    if (secretHexBuf) {
      signCandidates.push({ paramName: 's', value: hmacHex(secretHexBuf, canonical), type: 'hex(hexSecret)', note: 'hexSecret->hex' });
      signCandidates.push({ paramName: 's', value: hmacB64(secretHexBuf, canonical), type: 'b64(hexSecret)', note: 'hexSecret->b64' });
      signCandidates.push({ paramName: 'signature', value: hmacB64(secretHexBuf, canonical), type: 'b64(hexSecret)', note: 'hexSecret->b64 (signature)' });
      signCandidates.push({ paramName: 's', value: toB64Url(hmacB64(secretHexBuf, canonical)), type: 'b64url(hexSecret)', note: 'hexSecret->b64url' });
    }

    console.log('\nCANDIDATE SIGS TO TRY (preview):');
    signCandidates.forEach((c,i)=> console.log(i+1, c.paramName, c.type, c.note, c.value.slice(0,16)));

    // endpoint (sandbox)
    const endpoint = `${FLOW_URL}/api/pagos`;
    console.log('\nTrying endpoint:', endpoint);

    for (const cand of signCandidates) {
      const bodyObj = { ...params };
      // aliases (algunos endpoints aceptan variantes de nombres)
      bodyObj.url_confirmation = params.urlConfirmation;
      bodyObj.returnUrl = params.urlReturn;
      bodyObj.url_return = params.urlReturn;
      bodyObj.confirmationUrl = params.urlConfirmation;
      bodyObj.reference = bodyObj.reference || bodyObj.commerceOrder;

      // attach signature under candidate name
      bodyObj[cand.paramName] = cand.value;

      const bodyStr = new URLSearchParams(bodyObj).toString();
      console.log('\n--- POST intent:', cand.paramName, cand.type, cand.note);
      console.log('body preview keys:', Object.keys(bodyObj));
      try {
        const resp = await axios.post(endpoint, bodyStr, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          validateStatus: () => true,
          timeout: 15000,
        });
        console.log('status:', resp.status, 'data preview:', typeof resp.data === 'object' ? JSON.stringify(resp.data).slice(0,200) : String(resp.data).slice(0,200));
        if (resp.status >= 200 && resp.status < 300 && resp.data && resp.data.token) {
          console.log('SUCCESS! token:', resp.data.token, 'url (maybe):', resp.data.url || resp.data.paymentURL || resp.data.paymentUrl);
          return;
        }
      } catch (e) {
        console.warn('request failed:', e && e.message);
      }
    }

    console.error('\nNINGUNA variante funcionó. Revisa: canonical EXACTA (encoded vs raw), formato del FLOW_SECRET (hex vs utf8), y si Flow espera otro conjunto de campos/nombres.');
    process.exit(2);
  } catch (err) {
    console.error('FATAL:', err && err.stack || err);
    process.exit(3);
  }
})();

