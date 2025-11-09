// src/pdf-worker-setup.js
// Para pdfjs-dist v3/v4 con Vite

// Opción A: si usas react-pdf
// import { pdfjs } from 'react-pdf';
// import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

// Opción B: si usas pdfjs directo
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export {}; // no exporta nada; solo configura el worker global
