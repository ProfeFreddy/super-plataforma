// src/lib/pdfSafe.js
// No importes pdf.worker*.js en ningún sitio. Esto arma solo el worker.
let _boot;

/**
 * Inicializa pdf.js y fija el workerSrc de forma compatible con Vite.
 * Llama una vez (o muchas; es idempotente).
 */
export async function ensurePdfJs() {
  if (_boot) return _boot;

  _boot = (async () => {
    // Carga ESM de pdf.js:
    const pdfjs = await import('pdfjs-dist');
    // GlobalWorkerOptions vive en el build ESM:
    const { GlobalWorkerOptions } = await import('pdfjs-dist/build/pdf');

    // Worker empaquetado por Vite (seguro para Netlify/Vercel):
    const workerUrl = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    GlobalWorkerOptions.workerSrc = workerUrl;

    // Alternativa CDN si alguna vez lo necesitas:
    // const { version } = await import('pdfjs-dist/build/pdf');
    // GlobalWorkerOptions.workerSrc =
    //   `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;

    return pdfjs;
  })();

  return _boot;
}

