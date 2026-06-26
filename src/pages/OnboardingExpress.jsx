// src/pages/OnboardingExpress.jsx
// Onboarding en 3 pasos: asignatura → niveles → unidad actual
// Al terminar: genera horario base + propaga unidades → InicioClase

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  doc, setDoc, getDoc, serverTimestamp, collection, getDocs, query, where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ── Constantes ── */
const ASIGNATURAS = [
  "Matemática", "Lenguaje", "Historia", "Física", "Química", "Biología",
  "Inglés", "Ciencias", "Tecnología", "Ed. Física", "Artes", "Música",
  "Filosofía", "Psicología", "Orientación", "Otro",
];

const NIVELES = [
  "7º Básico", "8º Básico",
  "1º Medio", "2º Medio", "3º Medio", "4º Medio",
];

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// Normalizar nivel para buscar en curriculo (ej: "3º Medio" → "3° medio")
function normNivel(nivel = "") {
  return nivel.replace(/º/g, "°").replace(/Básico/g, "básico").replace(/Medio/g, "medio").toLowerCase().trim();
}

// Obtener asignaturaId para curriculo
function getAsigId(asig = "") {
  const MAP = {
    "Matemática": "matematica", "Lenguaje": "lenguaje", "Historia": "historia",
    "Física": "fisica", "Química": "quimica", "Biología": "biologia",
    "Inglés": "ingles", "Ciencias": "ciencias", "Tecnología": "tecnologia",
  };
  return MAP[asig] || asig.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "").trim();
}

async function fetchUnidades(asignatura, nivel) {
  if (!asignatura || !nivel) return [];
  try {
    const asigId = getAsigId(asignatura);
    const nivelRaw = normNivel(nivel);
    const q = query(collection(db, "curriculo"), where("asignaturaId", "==", asigId), where("nivel", "==", nivelRaw));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({
        id: d.id,
        titulo: d.data().titulo || d.id,
        codUnidad: d.data().codUnidad || d.id,
        objetivo: Array.isArray(d.data().objetivos) ? d.data().objetivos[0] || "" : "",
        habilidades: Array.isArray(d.data().habilidades) ? d.data().habilidades : [],
      })).sort((a, b) => a.codUnidad.localeCompare(b.codUnidad));
    }
    // Fallback: solo asignatura
    const q2 = query(collection(db, "curriculo"), where("asignaturaId", "==", asigId));
    const snap2 = await getDocs(q2);
    const nivelBase = nivel.replace(/[°º]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
    return snap2.docs
      .filter((d) => {
        const n = String(d.data().nivel || "").replace(/[°º]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
        return n === nivelBase || n.includes(nivelBase) || nivelBase.includes(n);
      })
      .map((d) => ({
        id: d.id,
        titulo: d.data().titulo || d.id,
        codUnidad: d.data().codUnidad || d.id,
        objetivo: Array.isArray(d.data().objetivos) ? d.data().objetivos[0] || "" : "",
        habilidades: Array.isArray(d.data().habilidades) ? d.data().habilidades : [],
      }))
      .sort((a, b) => a.codUnidad.localeCompare(b.codUnidad));
  } catch (e) {
    console.warn("[fetchUnidades]", e?.message);
    return [];
  }
}

/* ── Estilos ── */
const C = {
  bg: "radial-gradient(1200px 600px at 20% -10%, #7dd3fc22, transparent), radial-gradient(1000px 500px at 110% 10%, #a7f3d022, transparent), #f8fafc",
  brand: "#2193b0", green: "#10b981", white: "#fff",
  text: "#0f172a", muted: "#64748b", border: "#e5e7eb",
};

const s = {
  wrap: { minHeight: "100dvh", display: "grid", placeItems: "center", background: C.bg, padding: 16, fontFamily: "Segoe UI, system-ui, sans-serif" },
  card: { width: "100%", maxWidth: 560, background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, boxShadow: "0 10px 30px rgba(2,6,23,.08)" },
  h1: { margin: "0 0 4px", fontSize: 22, color: C.text, fontWeight: 900 },
  sub: { margin: "0 0 24px", color: C.muted, fontSize: 14 },
  label: { fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 },
  select: { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, outline: "none", cursor: "pointer" },
  btn: { width: "100%", padding: "12px", borderRadius: 10, border: "none", background: C.brand, color: C.white, fontWeight: 800, fontSize: 16, cursor: "pointer", marginTop: 8 },
  btnGreen: { width: "100%", padding: "14px", borderRadius: 10, border: "none", background: C.green, color: C.white, fontWeight: 800, fontSize: 16, cursor: "pointer", marginTop: 8 },
  chip: (selected) => ({
    padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `2px solid ${selected ? C.brand : C.border}`,
    background: selected ? "#eff6ff" : C.white,
    color: selected ? C.brand : C.muted,
    transition: "all .15s",
  }),
  progress: (pct) => ({
    height: 4, borderRadius: 999, background: `linear-gradient(to right, ${C.brand} ${pct}%, #e5e7eb ${pct}%)`,
    marginBottom: 24,
  }),
  unidadCard: (selected) => ({
    padding: "10px 14px", borderRadius: 10, border: `2px solid ${selected ? C.brand : C.border}`,
    background: selected ? "#eff6ff" : C.white, cursor: "pointer", marginBottom: 8,
    transition: "all .15s",
  }),
};

export default function OnboardingExpress() {
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [nombre, setNombre] = useState("");
  const [paso, setPaso] = useState(1); // 1, 2, 3

  // Paso 1
  const [asignatura, setAsignatura] = useState("");

  // Paso 2
  const [nivelesSeleccionados, setNivelesSeleccionados] = useState([]);

  // Paso 3: unidad por nivel
  const [unidadesPorNivel, setUnidadesPorNivel] = useState({}); // { "3º Medio": [{...}] }
  const [unidadSeleccionada, setUnidadSeleccionada] = useState({}); // { "3º Medio": codUnidad }
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/registro", { replace: true }); return; }
      setUid(u.uid);
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        if (snap.exists() && snap.data()?.nombre) setNombre(snap.data().nombre);
        else if (u.displayName) setNombre(u.displayName);
      } catch {}
    });
    return () => unsub();
  }, [navigate]);

  // Cargar unidades cuando llega al paso 3
  useEffect(() => {
    if (paso !== 3 || !asignatura || nivelesSeleccionados.length === 0) return;
    setLoadingUnidades(true);
    const promises = nivelesSeleccionados.map((n) =>
      fetchUnidades(asignatura, n).then((u) => ({ nivel: n, unidades: u }))
    );
    Promise.all(promises).then((results) => {
      const map = {};
      for (const r of results) map[r.nivel] = r.unidades;
      setUnidadesPorNivel(map);
      setLoadingUnidades(false);
    });
  }, [paso, asignatura, nivelesSeleccionados]);

  function toggleNivel(nivel) {
    setNivelesSeleccionados((prev) =>
      prev.includes(nivel) ? prev.filter((n) => n !== nivel) : [...prev, nivel]
    );
  }

  function selectUnidad(nivel, codUnidad) {
    setUnidadSeleccionada((prev) => ({ ...prev, [nivel]: codUnidad }));
  }

  const progreso = paso === 1 ? 33 : paso === 2 ? 66 : 99;

  async function finalizar() {
    if (!uid) return;
    setSaving(true);
    setError("");

    try {
      // Construir horario base: 10 bloques, L-V, misma asignatura en todos los slots
      // Los niveles se distribuyen en slots
      const CONFIG_BASE = {
        horaInicio: "08:00", duracionMin: 45, totalBloques: 10,
        pausas: [
          { id: "p1", despuesDeBloque: 2, duracion: 15, tipo: "recreo" },
          { id: "p2", despuesDeBloque: 4, duracion: 15, tipo: "recreo" },
          { id: "p3", despuesDeBloque: 6, duracion: 45, tipo: "almuerzo" },
          { id: "p4", despuesDeBloque: 8, duracion: 15, tipo: "recreo" },
        ],
      };

      // Generar marcas de tiempo
      const marcas = [];
      let min = 8 * 60;
      const eventos = [];
      const pausasOrd = [...CONFIG_BASE.pausas].sort((a, b) => a.despuesDeBloque - b.despuesDeBloque);
      for (let i = 0; i < CONFIG_BASE.totalBloques; i++) {
        const h = Math.floor(min / 60), m = min % 60;
        marcas.push({ h, m });
        eventos.push({ tipo: "clase", inicio: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` });
        min += CONFIG_BASE.duracionMin;
        const pausa = pausasOrd.find((p) => p.despuesDeBloque === i + 1);
        if (pausa) min += pausa.duracion;
      }
      const hFin = Math.floor(min / 60), mFin = min % 60;
      marcas.push({ h: hFin, m: mFin });

      // Horario flat: distribuir niveles en filas
      const flat = [];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 5; col++) {
          // Asignar nivel según índice (cicla si hay varios)
          const nivelIdx = row % nivelesSeleccionados.length;
          const nivel = nivelesSeleccionados[nivelIdx] || nivelesSeleccionados[0] || "";
          const codUnidad = unidadSeleccionada[nivel] || "";
          const unidades = unidadesPorNivel[nivel] || [];
          const unidadObj = unidades.find((u) => u.codUnidad === codUnidad);

          flat.push({
            row, col,
            asignatura,
            nivel,
            seccion: "",
            unidad: unidadObj?.codUnidad || "",
            unidadTitulo: unidadObj?.titulo || "",
            objetivo: unidadObj?.objetivo || "",
            habilidades: unidadObj?.habilidades || [],
            bloqueId: `B${row + 1}`,
          });
        }
      }

      const horarioConfig = {
        bloquesGenerados: eventos.map((e, i) => `${e.inicio} - ${eventos[i + 1]?.inicio || "17:00"}`),
        marcas,
        estructura: CONFIG_BASE,
      };

      // Guardar en usuarios/{uid}
      await setDoc(doc(db, "usuarios", uid), {
        asignatura,
        asignaturasPermitidas: [getAsigId(asignatura)],
        horario_flat: flat,
        horarioConfig,
        horarioEstructura: CONFIG_BASE,
        onboarding: { fase: "completado", ts: serverTimestamp() },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Guardar slots en clases_detalle
      for (const cell of flat) {
        if (!cell.asignatura) continue;
        const slotId = `${cell.row}-${cell.col}`;
        await setDoc(doc(db, "clases_detalle", uid, "slots", slotId), {
          asignatura: cell.asignatura,
          nivel: cell.nivel,
          seccion: cell.seccion || "",
          curso: cell.nivel || "",
          bloque: `Bloque ${cell.row + 1}`,
          bloqueInicio: eventos[cell.row]?.inicio || "08:00",
          dia: DIAS[cell.col] || "",
          unidad: cell.unidadTitulo || cell.unidad || "",
          objetivo: cell.objetivo || "",
          habilidades: Array.isArray(cell.habilidades) ? cell.habilidades : [],
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Limpiar flags
      try {
        localStorage.removeItem("forceHorarioOnce");
        localStorage.setItem("onboarding:fromRegistro", "1");
        localStorage.setItem("onboarding:showTrialBanner", "1");
      } catch {}

      navigate("/InicioClase", { replace: true });

    } catch (e) {
      console.error("[OnboardingExpress] finalizar:", e);
      setError("No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  const puedeAvanzar1 = !!asignatura;
  const puedeAvanzar2 = nivelesSeleccionados.length > 0;
  const puedeFinalizar = nivelesSeleccionados.every((n) => !!unidadSeleccionada[n]);

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        {/* Barra de progreso */}
        <div style={s.progress(progreso)} />

        {/* Paso 1: Asignatura */}
        {paso === 1 && (
          <>
            <h1 style={s.h1}>👋 Hola{nombre ? `, ${nombre.split(" ")[0]}` : ""}!</h1>
            <p style={s.sub}>3 preguntas rápidas y tu clase estará lista. Menos de 2 minutos.</p>

            <label style={s.label}>¿Qué asignatura enseñas?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {ASIGNATURAS.map((a) => (
                <div key={a} style={s.chip(asignatura === a)} onClick={() => setAsignatura(a)}>{a}</div>
              ))}
            </div>

            <button
              style={{ ...s.btn, opacity: puedeAvanzar1 ? 1 : 0.5 }}
              disabled={!puedeAvanzar1}
              onClick={() => setPaso(2)}
            >
              Continuar →
            </button>
          </>
        )}

        {/* Paso 2: Niveles */}
        {paso === 2 && (
          <>
            <h1 style={s.h1}>📚 ¿Qué niveles tienes?</h1>
            <p style={s.sub}>Selecciona todos los cursos donde haces {asignatura}.</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {NIVELES.map((n) => (
                <div key={n} style={s.chip(nivelesSeleccionados.includes(n))} onClick={() => toggleNivel(n)}>{n}</div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...s.btn, background: "#e5e7eb", color: "#475569", flex: 1 }} onClick={() => setPaso(1)}>← Atrás</button>
              <button
                style={{ ...s.btn, opacity: puedeAvanzar2 ? 1 : 0.5, flex: 2 }}
                disabled={!puedeAvanzar2}
                onClick={() => setPaso(3)}
              >
                Continuar →
              </button>
            </div>
          </>
        )}

        {/* Paso 3: Unidad actual por nivel */}
        {paso === 3 && (
          <>
            <h1 style={s.h1}>🎯 ¿En qué unidad estás?</h1>
            <p style={s.sub}>Selecciona la unidad que estás trabajando <strong>ahora</strong> en cada nivel.</p>

            {loadingUnidades ? (
              <div style={{ textAlign: "center", padding: 32, color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                Cargando unidades del currículo…
              </div>
            ) : (
              nivelesSeleccionados.map((nivel) => {
                const unidades = unidadesPorNivel[nivel] || [];
                const seleccionada = unidadSeleccionada[nivel] || "";
                return (
                  <div key={nivel} style={{ marginBottom: 20 }}>
                    <label style={{ ...s.label, color: C.brand }}>{nivel}</label>
                    {unidades.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#f59e0b", padding: "8px 12px", background: "#fefce8", borderRadius: 8 }}>
                        No hay unidades en el currículo para este nivel. Puedes configurarlo desde el Horario más adelante.
                      </div>
                    ) : (
                      unidades.map((u) => (
                        <div
                          key={u.codUnidad}
                          style={s.unidadCard(seleccionada === u.codUnidad)}
                          onClick={() => selectUnidad(nivel, u.codUnidad)}
                        >
                          <div style={{ fontWeight: 700, fontSize: 14, color: seleccionada === u.codUnidad ? C.brand : C.text }}>
                            {seleccionada === u.codUnidad ? "✓ " : ""}{u.titulo}
                          </div>
                          {u.objetivo && (
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>
                              {u.objetivo.slice(0, 80)}{u.objetivo.length > 80 ? "…" : ""}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })
            )}

            {error && (
              <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...s.btn, background: "#e5e7eb", color: "#475569", flex: 1 }} onClick={() => setPaso(2)}>← Atrás</button>
              <button
                style={{ ...s.btnGreen, opacity: (puedeFinalizar && !saving) ? 1 : 0.5, flex: 2 }}
                disabled={!puedeFinalizar || saving}
                onClick={finalizar}
              >
                {saving ? "Preparando tu clase…" : "🚀 ¡Empezar a usar PragmaProfe!"}
              </button>
            </div>

            {!puedeFinalizar && !loadingUnidades && (
              <div style={{ marginTop: 8, fontSize: 12, color: C.muted, textAlign: "center" }}>
                Selecciona una unidad para cada nivel para continuar.
              </div>
            )}
          </>
        )}

        {/* Indicador de pasos */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
          {[1,2,3].map((p) => (
            <div key={p} style={{ width: 8, height: 8, borderRadius: "50%", background: paso >= p ? C.brand : C.border }} />
          ))}
        </div>
      </div>
    </div>
  );
}