export async function leerJsonFallback(ruta, valorPorDefecto = null) {
  try {
    const res = await fetch(ruta, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo leer " + ruta);
    return await res.json();
  } catch (error) {
    console.warn("[PragmaFallback]", ruta, error);
    return valorPorDefecto;
  }
}

export async function leerProfesorFallback() {
  return leerJsonFallback("/data/fallback/profesor.json", {
    nombre: "Profesor",
    colegio: "Institución educativa",
    pais: "",
    ciudad: ""
  });
}

export async function leerHorarioFallback() {
  return leerJsonFallback("/data/fallback/horario.json", {});
}

export async function leerClaseFallback(slotId = "9-3") {
  const horario = await leerHorarioFallback();
  return horario?.[slotId] || null;
}