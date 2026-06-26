// JavaScript source code
const KEY = "gincana_banco_importado";

export function obtenerPreguntasImportadas() {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
        return [];
    }
}

export function guardarPreguntasImportadas(preguntas) {
    const actuales = obtenerPreguntasImportadas();
    const nuevas = [...actuales, ...preguntas];
    localStorage.setItem(KEY, JSON.stringify(nuevas));
    return nuevas;
}

export function limpiarPreguntasImportadas() {
    localStorage.removeItem(KEY);
}