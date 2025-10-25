// src/services/PlanificadorService.js
export function getYearWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}
export function slotIdFrom({ marcas = [[8,0],[9,0],[10,0],[11,0],[12,0],[13,0]], dow = new Date().getDay() } = {}) {
  const now = new Date(); const mins = now.getHours()*60 + now.getMinutes();
  let fila = 0;
  for (let i=0;i<marcas.length-1;i++){
    const [sh,sm]=marcas[i], [eh,em]=marcas[i+1];
    if (mins>=sh*60+sm && mins<eh*60+em){ fila=i; break; }
  }
  const col = (dow>=1 && dow<=5) ? dow-1 : 0;
  return `${fila}-${col}`;
}
export async function getClaseVigente(){ return null; }
export function generarSugerenciasSemana({ unidad="" }={}) {
  const base = unidad || "Unidad";
  return [
    { dia:"Lunes", actividad:`IntroducciÃƒÂ³n a ${base}` },
    { dia:"Martes", actividad:`PrÃƒÂ¡ctica guiada de ${base}` },
    { dia:"MiÃƒÂ©rcoles", actividad:`Trabajo colaborativo sobre ${base}` },
    { dia:"Jueves", actividad:`AplicaciÃƒÂ³n y ejercicios de ${base}` },
    { dia:"Viernes", actividad:`Cierre y evaluaciÃƒÂ³n formativa de ${base}` },
  ];
}
export default { getYearWeek, slotIdFrom, getClaseVigente, generarSugerenciasSemana };
