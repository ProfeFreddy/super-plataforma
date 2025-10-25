// src/pdf-worker-setup.js
import { pdfjs } from 'react-pdf';

// Prueba primero con el no-minificado:
import workerSrc from 'pdfjs-dist/build/pdf.worker.js?url';

// Si tu versión no trae "pdf.worker.mjs", cambia la línea de arriba por:
// import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
