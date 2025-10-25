// flow_test_post.js
const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');

const FLOW_URL = 'https://sandbox.flow.cl/api/pagos'; // o /payment/create
const SECRET = process.env.FLOW_SECRET || '';
const APIKEY = process.env.FLOW_API_KEY || '';

if (!SECRET || !APIKEY) {
  console.error('Exporta FLOW_SECRET y FLOW_API_KEY en el mismo terminal antes de ejecutar.');
  process.exit(1);
}

const params = {
  apiKey: APIKEY,
  amount: 100,
  commerceOrder: 'TEST-123',
  reference: 'TEST-123',
  currency: 'CLP',
  email: 'tu@email.cl',
  subject: 'Suscripcion Pro',
  urlConfirmation: 'http://localhost:8080/api/flow/confirm',
  urlReturn: 'http://localhost:5173/pago/retorno'
};

function canonical(params, encode=false) {
  return Object.keys(params).sort().map(k=>{
    const v = params[k] == null ? '' : String(params[k]);
    return encode ? `${encodeURIComponent(k)}=${encodeURIComponent(v)}` : `${k}=${v}`;
  }).join('&');
}

function hmac(keyBuf, str, out='hex') {
  return crypto.createHmac('sha256', keyBuf).update(str).digest(out);
}

function toB64Url(b64) {
  return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

(async ()=>{
  const raw = canonical(params, false);
  const enc = canonical(params, true);
  console.log('canonical raw:', raw);
  console.log('canonical encoded:', enc);

  // prepare key buffers to try
  const keys = [
    {name:'utf8', buf: Buffer.from(SECRET,'utf8')},
    {name:'hex', buf: (()=>{ try { return Buffer.from(SECRET,'hex') } catch(e){ return null } })()},
    {name:'base64', buf: (()=>{ try { return Buffer.from(SECRET,'base64') } catch(e){ return null } })()}
  ];

  const variants = [
    {str: raw, label:'raw'},
    {str: enc, label:'encoded'}
  ];

  const attempts = [];

  for (const k of keys) {
    if (!k.buf) continue;
    for (const v of variants) {
      const hex = hmac(k.buf, v.str, 'hex');
      const b64 = hmac(k.buf, v.str, 'base64');
      const b64url = toB64Url(b64);
      attempts.push({key: k.name, variant: v.label, formName:'s', value: hex, type:'hex'});
      attempts.push({key: k.name, variant: v.label, formName:'s', value: b64, type:'b64'});
      attempts.push({key: k.name, variant: v.label, formName:'s', value: b64url, type:'b64url'});
      attempts.push({key: k.name, variant: v.label, formName:'signature', value: hex, type:'hex'});
      attempts.push({key: k.name, variant: v.label, formName:'signature', value: b64, type:'b64'});
      attempts.push({key: k.name, variant: v.label, formName:'signature', value: b64url, type:'b64url'});
    }
  }

  for (const a of attempts) {
    const bodyObj = {...params};
    // add aliases (Flow sometimes expects other names)
    bodyObj.url_confirmation = params.urlConfirmation;
    bodyObj.url_return = params.urlReturn;
    bodyObj.returnUrl = params.urlReturn;
    bodyObj.confirmationUrl = params.urlConfirmation;
    bodyObj[a.formName] = a.value;

    const body = qs.stringify(bodyObj);
    console.log('\n--- POST intent:', a);
    try {
      const r = await axios.post(FLOW_URL, body, {
        headers: {'Content-Type':'application/x-www-form-urlencoded'},
        validateStatus:()=>true,
        timeout:10000
      });
      console.log('status:', r.status, 'data preview:', JSON.stringify(r.data).slice(0,200));
      if (r.status >=200 && r.status < 300) {
        console.log('SUCCESS with', a);
        return;
      }
    } catch(e) {
      console.warn('request error', e.message);
    }
  }

  console.error('NINGUNA variante funcionó. Revisa canonical exacta y formato de secret.');
})();
