export {
  clean,
  getYearWeek,
  slotIdFromHorarioConfig,
  normalizeClase,
  claseEsValida,
  obtenerClaseActiva as getClaseVigente,
  obtenerClaseActiva,
  obtenerProximasClases,
  guardarSesionClase,
  leerSesionClase,
  limpiarSesionClase,
  crearClaseDemo,
  construirUrlParticipacion,
  construirUrlGincana,
} from "./ClaseActivaService";

export function generarSugerenciasSemana({ unidad = "" } = {}) {
  const base = unidad || "Unidad";
  return [
    { dia: "Lunes", actividad: `Introducción a ${base}` },
    { dia: "Martes", actividad: `Práctica guiada de ${base}` },
    { dia: "Miércoles", actividad: `Trabajo colaborativo sobre ${base}` },
    { dia: "Jueves", actividad: `Aplicación y ejercicios de ${base}` },
    { dia: "Viernes", actividad: `Cierre y evaluación formativa de ${base}` },
  ];
}