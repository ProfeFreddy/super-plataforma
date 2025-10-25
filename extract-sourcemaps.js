/**
 * node extract-sourcemaps.js <carpeta_entrada> <carpeta_salida>
 * Ejemplo: node extract-sourcemaps.js site-dump recovered
 *
 * Lee todos los .map (Vite/Webpack) y reconstruye los archivos originales (.js/.jsx/.ts/.tsx)
 * usando `sources` + `sourcesContent`. Si un .map no trae `sourcesContent`, intenta copiar
 * el archivo fuente relativo si existe junto al .map.
 */

const fs = require("fs");
const path = require("path");

const inRoot = process.argv[2] || "site-dump";   // carpeta con assets y .map (lo que bajaste de la web)
const outRoot = process.argv[3] || "recovered";  // carpeta donde escribiremos los archivos recuperados

function walk(dir, onFile) {
  for (const de of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, de.name);
    if (de.isDirectory()) walk(p, onFile);
    else onFile(p);
  }
}

function cleanSource(p) {
  if (!p) return "";
  return String(p)
    .replace(/^webpack:\/\//, "")
    .replace(/^vite:\/\//, "")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

if (!fs.existsSync(inRoot)) {
  console.error(`No existe la carpeta de entrada: ${inRoot}`);
  process.exit(1);
}

let written = 0;
let seen = new Set();

walk(inRoot, (file) => {
  if (!file.endsWith(".map")) return;

  let map;
  try {
    const raw = fs.readFileSync(file, "utf8");
    map = JSON.parse(raw);
  } catch (e) {
    console.warn("No pude leer/parsing map:", file);
    return;
  }

  const sources = map.sources || [];
  const contents = map.sourcesContent || [];

  // Caso A: el .map trae los contenidos embebidos (lo ideal)
  if (contents.length === sources.length && contents.length > 0) {
    sources.forEach((src, i) => {
      const cleaned = cleanSource(src);
      if (!cleaned) return;
      const outPath = path.join(outRoot, cleaned);
      try {
        ensureDirFor(outPath);
        fs.writeFileSync(outPath, contents[i] ?? "", "utf8");
        if (!seen.has(outPath)) { seen.add(outPath); written++; }
      } catch (e) {
        console.warn("Falló escribir:", outPath, e.message);
      }
    });
    return;
  }

  // Caso B: intenta copiar el archivo relativo si existe junto al .map
  const base = path.dirname(file);
  sources.forEach((src) => {
    const cleaned = cleanSource(src);
    if (!cleaned) return;

    // Candidatos típicos (algunos maps usan rutas relativas con ..)
    const candidates = [
      path.join(base, cleaned),
      path.join(base, "..", cleaned),
      path.join(inRoot, cleaned),
    ];

    const found = candidates.find((c) => fs.existsSync(c));
    if (found) {
      const outPath = path.join(outRoot, cleaned);
      try {
        ensureDirFor(outPath);
        fs.writeFileSync(outPath, fs.readFileSync(found, "utf8"), "utf8");
        if (!seen.has(outPath)) { seen.add(outPath); written++; }
      } catch (e) {
        console.warn("Falló copiar:", outPath, e.message);
      }
    }
  });
});

console.log(`\nRecuperados ${written} archivo(s) en '${outRoot}'.`);
console.log(`Revisa especialmente: ${path.join(outRoot, "src", "pages")}`);
