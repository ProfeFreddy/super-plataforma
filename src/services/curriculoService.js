// src/services/curriculoService.js
import { api } from "../lib/api";

// Devuelve el primer OA â€œparecidoâ€; por ahora simple para no bloquear.
export async function getPrimerOA({ asignatura = "", nivel = "", unidad = "" } = {}) {
  try {
    // Si tienes tu endpoint, cÃ¡mbialo aquÃ­.
    // Ejemplo de consulta al proxy /mineduc si lo tienes en el backend:
    // const { data } = await api.get(`/mineduc?asignatura=${asignatura}&nivel=${nivel}&unidad=${unidad}`);
    // return Array.isArray(data) ? data[0] : null;
    return null; // stub
  } catch (e) {
    console.warn("[curriculoService] getPrimerOA:", e?.message || e);
    return null;
  }
}

export default { getPrimerOA };
