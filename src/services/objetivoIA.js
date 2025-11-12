// /src/services/objetivoIA.js
// words: [{text, value}] (WordCloud). meta: {curso, seccion, asignatura, unidad}
export function objetivoDesdeNube(words = [], meta = {}) {
  if (!words || !words.length) return "";

  // 1) Top 5 por peso
  const top = [...words]
    .filter(w => (w?.text || "").trim())
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5)
    .map(w => w.text.trim().toLowerCase());

  // 2) Heurístico simple por palabras clave
  const has = (k) => top.some(t => t.includes(k));
  const tema = top[0] || "el tema central";
  const conexion = has("función") || has("funcion") ? "las funciones" :
                   has("probabilidad") ? "la probabilidad" :
                   has("ecuación") || has("ecuacion") ? "las ecuaciones" :
                   has("derivada") ? "las derivadas" :
                   has("porcentaje") ? "porcentajes" :
                   (top[1] || "contenidos previos");
  const estrategia = has("problema") ? "resolución de problemas" :
                     has("gráfico") || has("grafico") ? "análisis de gráficos" :
                     has("tabla") ? "uso de tablas" :
                     "actividades guiadas";
  const habilidad = has("argumentar") || has("razonar") ? "argumentación" :
                    has("modelar") ? "modelación" :
                    has("calcular") ? "cálculo" :
                    "comprensión y aplicación";

  const { curso, seccion, asignatura, unidad } = meta;

  return `Objetivo sugerido: En ${asignatura || "la asignatura"}, para ${curso || "el curso"} ${seccion ? `(${seccion})` : ""}, trabajaremos ${tema} conectándolo con ${conexion}, mediante ${estrategia} para fortalecer ${habilidad}${unidad ? `, en la unidad ${unidad}` : ""}.`;
}
