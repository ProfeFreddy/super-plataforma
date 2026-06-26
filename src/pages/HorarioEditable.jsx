// src/pages/HorarioEditable.jsx
const safeText = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return "[obj]"; }
};

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import BannerTrial from "../components/Bannertrial";

const COLORS = {
  brandA: "#2193b0", brandB: "#6dd5ed", white: "#ffffff",
  textDark: "#0f172a", text: "#1f2937", muted: "#64748b",
  border: "#e5e7eb", chip: "#f1f5f9", warn: "#fff7ed", warnBorder: "#fdba74",
  green: "#10b981", greenLight: "#ecfdf5",
};
const wrap = {
  minHeight: "100vh",
  background: `linear-gradient(to right, ${COLORS.brandA}, ${COLORS.brandB})`,
  padding: "24px", boxSizing: "border-box",
  fontFamily: "Segoe UI, system-ui, sans-serif",
};
const card = {
  background: COLORS.white, color: COLORS.text, borderRadius: 12, padding: 20,
  border: `1px solid ${COLORS.border}`,
  boxShadow: "0 6px 18px rgba(16,24,40,.08)",
};
const btn = {
  background: COLORS.white, color: "#0ea5e9", border: "1px solid " + COLORS.border,
  borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer", fontSize: 14,
};
const btnPrimary = { ...btn, background: "#0ea5e9", color: "#fff", border: "none" };
const btnGreen = { ...btn, background: COLORS.green, color: "#fff", border: "none" };
const btnDanger = { ...btn, color: "#ef4444" };
const selectStyle = {
  padding: "7px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
  background: COLORS.white, fontSize: 14, cursor: "pointer",
};
const inputStyle = { ...selectStyle, width: "100%" };
const labelStyle = { fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 4, display: "block" };

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const NIVELES = ["7º Básico","8º Básico","1º Medio","2º Medio","3º Medio","4º Medio"];
const SECCIONES = ["A","B","C","D","E"];
const DURACIONES = [20, 30, 40, 45, 60, 90];

const ASIG_TO_ID = {
  "Matemática": "matematica", "Lenguaje": "lenguaje", "Historia": "historia",
  "Ciencias": "ciencias", "Física": "fisica", "Química": "quimica",
  "Biología": "biologia", "Inglés": "ingles", "Tecnología": "tecnologia",
  "Lengua y Literatura": "lenguaje", "Límites, Derivadas e Integrales": "matematica",
  "Probabilidades y Estadística": "matematica", "Biología Celular y Molecular": "biologia",
  "Biología de los Ecosistemas": "biologia", "Física (Electivo)": "fisica",
  "Química (Electivo)": "quimica",
};

function getAsigId(asig = "") {
  return ASIG_TO_ID[asig] || asig.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "").trim();
}

function getNivelRaw(nivel = "") {
  return nivel.replace(/º/g, "°").replace(/Básico/g, "básico").replace(/Medio/g, "medio").toLowerCase().trim();
}

function normNivel(n = "") {
  return n.replace(/[°º]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
}

const ASIGNATURAS_BASE = [
  "Matemática", "Lenguaje", "Historia", "Ciencias", "Física", "Química", "Biología",
  "Inglés", "Ed. Física", "Artes", "Música", "Orientación", "Tecnología", "Religión",
  "Filosofía", "Psicología", "Lengua y Literatura", "Educación Ciudadana",
  "Matemática (Plan Común)", "Ciencias para la Ciudadanía",
  "Historia, Geografía y Ciencias Sociales", "Artes (Plan Electivo)",
  "Ed. Física y Salud (Plan Electivo)", "Taller de Literatura",
  "Lectura y Escritura Especializadas", "Participación y Argumentación en Democracia",
  "Límites, Derivadas e Integrales", "Probabilidades y Estadística",
  "Pensamiento Computacional y Programación", "Geometría 3D",
  "Biología de los Ecosistemas", "Biología Celular y Molecular", "Ciencias de la Salud",
  "Física (Electivo)", "Química (Electivo)",
  "Artes Visuales, Audiovisuales y Multimediales", "Creación y Composición Musical",
  "Diseño y Arquitectura", "Interpretación y Creación en Danza",
  "Interpretación y Creación en Teatro", "Interpretación Musical",
  "Promoción de Estilos de Vida Activos y Saludables",
  "Ciencias del Ejercicio Físico y Deportivo", "Expresión Corporal",
  "Libre Disposición", "Consejo de Curso", "Tutoría", "Reforzamiento", "Taller", "Otro",
];

const _unidadesCache = {};

async function fetchUnidades(asignatura, nivel) {
  if (!asignatura || !nivel) return [];
  const key = `${asignatura}||${nivel}`;
  if (_unidadesCache[key]) return _unidadesCache[key];
  try {
    const asigId = getAsigId(asignatura);
    const nivelRaw = getNivelRaw(nivel);
    const q1 = query(collection(db, "curriculo"), where("asignaturaId", "==", asigId), where("nivel", "==", nivelRaw));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const unidades = snap1.docs.map((d) => ({ id: d.id, titulo: d.data().titulo || d.id, codUnidad: d.data().codUnidad || d.id, objetivo: Array.isArray(d.data().objetivos) ? d.data().objetivos[0] || "" : "", habilidades: Array.isArray(d.data().habilidades) ? d.data().habilidades : [] })).sort((a, b) => a.codUnidad.localeCompare(b.codUnidad));
      _unidadesCache[key] = unidades; return unidades;
    }
    const q2 = query(collection(db, "curriculo"), where("asignaturaId", "==", asigId));
    const snap2 = await getDocs(q2);
    const nivelBase = normNivel(nivel);
    const filtered = snap2.docs.filter((d) => { const nFS = normNivel(String(d.data().nivel || "")); return nFS === nivelBase || nFS.includes(nivelBase) || nivelBase.includes(nFS); }).map((d) => ({ id: d.id, titulo: d.data().titulo || d.id, codUnidad: d.data().codUnidad || d.id, objetivo: Array.isArray(d.data().objetivos) ? d.data().objetivos[0] || "" : "", habilidades: Array.isArray(d.data().habilidades) ? d.data().habilidades : [] })).sort((a, b) => a.codUnidad.localeCompare(b.codUnidad));
    _unidadesCache[key] = filtered; return filtered;
  } catch (e) { console.warn("[fetchUnidades]", e?.message); return []; }
}

function generarBloques(config) {
  const { horaInicio, duracionMin, pausas } = config;
  const [hIni, mIni] = horaInicio.split(":").map(Number);
  let minActual = hIni * 60 + mIni;
  const bloques = []; let numBloque = 1;
  const totalBloques = config.totalBloques || 10;
  const pausasOrdenadas = [...(pausas || [])].sort((a, b) => a.despuesDeBloque - b.despuesDeBloque);
  for (let i = 0; i < totalBloques; i++) {
    const inicio = minToHHMM(minActual); minActual += duracionMin; const fin = minToHHMM(minActual);
    bloques.push({ id: `B${numBloque}`, tipo: "clase", label: `Bloque ${numBloque}`, inicio, fin }); numBloque++;
    const pausa = pausasOrdenadas.find((p) => p.despuesDeBloque === i + 1);
    if (pausa) { const pInicio = minToHHMM(minActual); minActual += pausa.duracion; const pFin = minToHHMM(minActual); bloques.push({ id: `P${i}`, tipo: pausa.tipo, label: pausa.tipo === "almuerzo" ? "Almuerzo" : "Recreo", inicio: pInicio, fin: pFin }); }
  }
  return bloques;
}

function minToHHMM(min) { const h = Math.floor(min / 60); const m = min % 60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
function celdaVacia() { return { asignatura: "", nivel: "", seccion: "", unidad: "", unidadTitulo: "", objetivo: "", habilidades: [] }; }
function construirMatrizDesde(bloques) { return bloques.filter((b) => b.tipo === "clase").map(() => Array.from({ length: 5 }, () => celdaVacia())); }
function normalizarConfigParaFS(config) { return { horaInicio: config.horaInicio, duracionMin: config.duracionMin, totalBloques: config.totalBloques, pausas: config.pausas || [] }; }

function rebuildMatriz(flat, clasesBloques) {
  const m = construirMatrizDesde(clasesBloques);
  for (const c of flat || []) {
    if (Number.isInteger(c.row) && Number.isInteger(c.col) && c.row < m.length && c.col < 5) {
      m[c.row][c.col] = { asignatura: c.asignatura || "", nivel: c.nivel || "", seccion: c.seccion || "", unidad: c.unidad || "", unidadTitulo: c.unidadTitulo || c.unidad || "", objetivo: c.objetivo || "", habilidades: Array.isArray(c.habilidades) ? c.habilidades : [] };
    }
  }
  return m;
}

function flattenMatriz(matriz, bloqueClases) {
  const out = [];
  for (let row = 0; row < matriz.length; row++) {
    for (let col = 0; col < 5; col++) {
      const cell = matriz[row]?.[col] || celdaVacia();
      out.push({ row, col, ...cell, bloqueId: bloqueClases[row]?.id || "" });
    }
  }
  return out;
}

async function writeSlots(uid, matriz, bloqueClases, profesorNombre) {
  for (let row = 0; row < matriz.length; row++) {
    for (let col = 0; col < 5; col++) {
      const cell = matriz[row]?.[col] || celdaVacia();
      if (!cell.asignatura) continue;
      const slotId = `${row}-${col}`;
      const payload = { asignatura: cell.asignatura, nivel: cell.nivel || "", seccion: cell.seccion || "", curso: ((cell.nivel || "") + (cell.seccion ? ` ${cell.seccion}` : "")).trim(), bloque: bloqueClases[row]?.label || "", bloqueInicio: bloqueClases[row]?.inicio || "", dia: DIAS[col] || "", profesor: profesorNombre || "", unidad: cell.unidadTitulo || cell.unidad || "", objetivo: cell.objetivo || "", habilidades: Array.isArray(cell.habilidades) ? cell.habilidades : [], updatedAt: serverTimestamp() };
      await setDoc(doc(db, "clases_detalle", uid, "slots", slotId), payload, { merge: true });
    }
  }
}

function ConfiguradorHorario({ onConfirmar, configInicial }) {
  const [horaInicio, setHoraInicio] = useState(configInicial?.horaInicio || "08:00");
  const [duracionMin, setDuracionMin] = useState(configInicial?.duracionMin || 45);
  const [totalBloques, setTotalBloques] = useState(configInicial?.totalBloques || 10);
  const [pausas, setPausas] = useState(configInicial?.pausas || [
    { id: "p1", despuesDeBloque: 2, duracion: 15, tipo: "recreo" },
    { id: "p2", despuesDeBloque: 4, duracion: 15, tipo: "recreo" },
    { id: "p3", despuesDeBloque: 6, duracion: 45, tipo: "almuerzo" },
    { id: "p4", despuesDeBloque: 8, duracion: 15, tipo: "recreo" },
  ]);
  const config = { horaInicio, duracionMin, totalBloques, pausas };
  const bloques = useMemo(() => generarBloques(config), [horaInicio, duracionMin, totalBloques, pausas]);
  function agregarPausa() { setPausas((prev) => [...prev, { id: `p${Date.now()}`, despuesDeBloque: Math.max(1, totalBloques - 1), duracion: 15, tipo: "recreo" }]); }
  function actualizarPausa(id, field, value) { setPausas((prev) => prev.map((p) => p.id === id ? { ...p, [field]: field === "duracion" || field === "despuesDeBloque" ? Number(value) : value } : p)); }
  function eliminarPausa(id) { setPausas((prev) => prev.filter((p) => p.id !== id)); }
  const horaTermino = bloques.at(-1)?.fin || "—";
  const nRecreos = pausas.filter((p) => p.tipo === "recreo").length;
  const nAlmuerzos = pausas.filter((p) => p.tipo === "almuerzo").length;
  return (
    <div style={card}>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, color: COLORS.textDark }}>⚙️ Paso 1: Configura la estructura del día</h2>
      <p style={{ margin: "0 0 20px", color: COLORS.muted, fontSize: 14 }}>Define cómo están organizados los bloques de tu colegio.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div><label style={labelStyle}>Hora de inicio</label><input type="time" style={inputStyle} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></div>
        <div><label style={labelStyle}>Duración de cada bloque</label><select style={selectStyle} value={duracionMin} onChange={(e) => setDuracionMin(Number(e.target.value))}>{DURACIONES.map((d) => <option key={d} value={d}>{d} minutos</option>)}</select></div>
        <div><label style={labelStyle}>Número de bloques lectivos</label><select style={selectStyle} value={totalBloques} onChange={(e) => setTotalBloques(Number(e.target.value))}>{[4,5,6,7,8,9,10,11,12].map((n) => <option key={n} value={n}>{n} bloques</option>)}</select></div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div><label style={{ ...labelStyle, marginBottom: 0 }}>Recreos y almuerzos</label><span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 8 }}>{nRecreos} recreo{nRecreos !== 1 ? "s" : ""} · {nAlmuerzos} almuerzo{nAlmuerzos !== 1 ? "s" : ""}</span></div>
          <button style={{ ...btnPrimary, fontSize: 12, padding: "6px 12px" }} onClick={agregarPausa}>+ Agregar pausa</button>
        </div>
        {pausas.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: 13, fontStyle: "italic", padding: "8px 12px", background: COLORS.chip, borderRadius: 8 }}>Sin pausas. Haz clic en "+ Agregar pausa" para añadir recreos o almuerzos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pausas.map((p) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "center", background: p.tipo === "almuerzo" ? "#fefce8" : "#fef2f2", borderRadius: 8, padding: "10px 12px", border: `1px solid ${p.tipo === "almuerzo" ? "#fde047" : "#fca5a5"}` }}>
                <div><label style={{ ...labelStyle, fontSize: 11 }}>Tipo</label><select style={selectStyle} value={p.tipo} onChange={(e) => actualizarPausa(p.id, "tipo", e.target.value)}><option value="recreo">🔴 Recreo</option><option value="almuerzo">🟡 Almuerzo</option></select></div>
                <div><label style={{ ...labelStyle, fontSize: 11 }}>Después del bloque</label><select style={selectStyle} value={p.despuesDeBloque} onChange={(e) => actualizarPausa(p.id, "despuesDeBloque", e.target.value)}>{Array.from({ length: totalBloques }, (_, i) => (<option key={i+1} value={i+1}>Bloque {i+1}</option>))}</select></div>
                <div><label style={{ ...labelStyle, fontSize: 11 }}>Duración</label><select style={selectStyle} value={p.duracion} onChange={(e) => actualizarPausa(p.id, "duracion", e.target.value)}>{[5,10,15,20,30,45,60].map((d) => <option key={d} value={d}>{d} min</option>)}</select></div>
                <button style={{ ...btnDanger, padding: "6px 10px", fontSize: 13, marginTop: 18 }} onClick={() => eliminarPausa(p.id)} title="Eliminar">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Vista previa · {bloques.filter(b => b.tipo === "clase").length} bloques lectivos · termina a las {horaTermino}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {bloques.map((b) => (<div key={b.id} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: b.tipo === "clase" ? "#e0f2fe" : b.tipo === "almuerzo" ? "#fef9c3" : "#fee2e2", color: b.tipo === "clase" ? "#0369a1" : b.tipo === "almuerzo" ? "#854d0e" : "#b91c1c", border: `1px solid ${b.tipo === "clase" ? "#bae6fd" : b.tipo === "almuerzo" ? "#fde047" : "#fca5a5"}` }}>{b.label} · {b.inicio}–{b.fin}</div>))}
        </div>
      </div>
      <button style={{ ...btnPrimary, padding: "12px 28px", fontSize: 15 }} onClick={() => onConfirmar(config, bloques)}>Continuar a completar horario →</button>
    </div>
  );
}

function CeldaHorario({ cell, rowIdx, col, onChange }) {
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  useEffect(() => {
    if (!cell.asignatura || !cell.nivel) { setUnidades([]); return; }
    setLoadingUnidades(true);
    fetchUnidades(cell.asignatura, cell.nivel).then((u) => { setUnidades(u); setLoadingUnidades(false); });
  }, [cell.asignatura, cell.nivel]);
  function handleAsignatura(value) { onChange(rowIdx, col, "asignatura", value); onChange(rowIdx, col, "unidad", ""); onChange(rowIdx, col, "unidadTitulo", ""); onChange(rowIdx, col, "objetivo", ""); onChange(rowIdx, col, "habilidades", []); }
  function handleNivel(value) { onChange(rowIdx, col, "nivel", value); onChange(rowIdx, col, "unidad", ""); onChange(rowIdx, col, "unidadTitulo", ""); onChange(rowIdx, col, "objetivo", ""); onChange(rowIdx, col, "habilidades", []); }
  function handleUnidad(codUnidad) {
    if (!codUnidad) { onChange(rowIdx, col, "unidad", ""); onChange(rowIdx, col, "unidadTitulo", ""); onChange(rowIdx, col, "objetivo", ""); onChange(rowIdx, col, "habilidades", []); return; }
    const u = unidades.find((x) => x.codUnidad === codUnidad);
    if (u) { onChange(rowIdx, col, "unidad", u.codUnidad); onChange(rowIdx, col, "unidadTitulo", u.titulo); onChange(rowIdx, col, "objetivo", u.objetivo || ""); onChange(rowIdx, col, "habilidades", u.habilidades || []); }
  }
  const tieneUnidades = unidades.length > 0;
  const unidadSeleccionada = cell.unidad || "";
  return (
    <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, borderLeft: `1px solid ${COLORS.border}`, verticalAlign: "top", minWidth: 160 }}>
      <select style={{ ...selectStyle, width: "100%", marginBottom: 5, fontSize: 13 }} value={cell.asignatura || ""} onChange={(e) => handleAsignatura(e.target.value)}><option value="">—</option>{ASIGNATURAS_BASE.map((a) => <option key={a} value={a}>{a}</option>)}</select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 5 }}>
        <select style={{ ...selectStyle, fontSize: 11 }} value={cell.nivel || ""} onChange={(e) => handleNivel(e.target.value)}><option value="">Nivel</option>{NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
        <select style={{ ...selectStyle, fontSize: 11 }} value={cell.seccion || ""} onChange={(e) => onChange(rowIdx, col, "seccion", e.target.value)}><option value="">Secc.</option>{SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      {cell.asignatura && cell.nivel && (
        <div>
          {loadingUnidades ? (<div style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic", padding: "3px 6px" }}>Cargando unidades…</div>
          ) : tieneUnidades ? (
            <select style={{ ...selectStyle, width: "100%", fontSize: 11, background: unidadSeleccionada ? "#eff6ff" : COLORS.white, borderColor: unidadSeleccionada ? "#93c5fd" : COLORS.border, fontWeight: unidadSeleccionada ? 700 : 400 }} value={unidadSeleccionada} onChange={(e) => handleUnidad(e.target.value)} title="Selecciona la unidad que estás trabajando actualmente">
              <option value="">📚 ¿Qué unidad trabajas?</option>
              {unidades.map((u) => (<option key={u.codUnidad} value={u.codUnidad}>{u.titulo}</option>))}
            </select>
          ) : (<div style={{ fontSize: 10, color: "#f59e0b", fontStyle: "italic", padding: "3px 6px", background: "#fefce8", borderRadius: 4 }}>Sin unidades en currículo</div>)}
        </div>
      )}
      {cell.asignatura && cell.nivel && (
        <div style={{ marginTop: 5, fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 6px", textAlign: "center", background: cell.unidad ? "#eff6ff" : COLORS.greenLight, color: cell.unidad ? "#2563eb" : COLORS.green }}>
          {cell.unidad ? `✓ ${cell.unidadTitulo || cell.unidad}` : `${cell.nivel}${cell.seccion ? ` ${cell.seccion}` : ""}`}
        </div>
      )}
    </td>
  );
}

function TablaHorario({ bloques, matriz, onChange, onGuardar, onEditarConfig, saving }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.textDark }}>📅 Paso 2: Completa tu horario</h2>
          <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: 13 }}>Indica asignatura, nivel, sección y <strong>qué unidad estás trabajando</strong>. InicioClase lo mostrará automáticamente.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={onEditarConfig}>⬅️ Ajustar estructura</button>
          <button style={{ ...btnGreen, opacity: saving ? 0.7 : 1 }} onClick={onGuardar} disabled={saving}>{saving ? "Guardando…" : "💾 Guardar horario"}</button>
        </div>
      </div>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1e40af" }}>
        💡 <strong>Elige la unidad</strong> en cada bloque. Cuando cambies de unidad, vuelve aquí y actualízala — InicioClase siempre mostrará la correcta automáticamente.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {bloques.map((b) => (<div key={b.id} style={{ padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: b.tipo === "clase" ? "#e0f2fe" : b.tipo === "almuerzo" ? "#fef9c3" : "#fee2e2", color: b.tipo === "clase" ? "#0369a1" : b.tipo === "almuerzo" ? "#854d0e" : "#b91c1c" }}>{b.label} {b.inicio}–{b.fin}</div>))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ background: "#f8fafc", padding: "10px 12px", textAlign: "left", fontWeight: 800, fontSize: 13, borderBottom: `2px solid ${COLORS.border}`, width: 130 }}>Bloque</th>
              {DIAS.map((d) => (<th key={d} style={{ background: "#f8fafc", padding: "10px 12px", fontWeight: 800, fontSize: 13, borderBottom: `2px solid ${COLORS.border}`, textAlign: "center" }}>{d}</th>))}
            </tr>
          </thead>
          <tbody>
            {bloques.map((bloque, bIdx) => {
              if (bloque.tipo !== "clase") {
                return (<tr key={bloque.id}><td colSpan={6} style={{ padding: "6px 12px", background: bloque.tipo === "almuerzo" ? "#fefce8" : "#fef2f2", color: bloque.tipo === "almuerzo" ? "#854d0e" : "#b91c1c", fontSize: 12, fontWeight: 700, textAlign: "center", borderBottom: `1px solid ${COLORS.border}` }}>{bloque.label} · {bloque.inicio} – {bloque.fin}</td></tr>);
              }
              const rowIdx = bloques.slice(0, bIdx + 1).filter((b) => b.tipo === "clase").length - 1;
              return (
                <tr key={bloque.id}>
                  <td style={{ padding: "8px 12px", background: "#f8fafc", fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${COLORS.border}`, verticalAlign: "middle" }}>
                    <div style={{ fontWeight: 800 }}>{bloque.label}</div>
                    <div style={{ color: COLORS.muted, fontWeight: 400, fontSize: 11 }}>{bloque.inicio} – {bloque.fin}</div>
                  </td>
                  {Array.from({ length: 5 }).map((_, col) => { const cell = matriz?.[rowIdx]?.[col] || celdaVacia(); return (<CeldaHorario key={col} cell={cell} rowIdx={rowIdx} col={col} onChange={onChange} />); })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HorarioEditable() {
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [profesorNombre, setProfesorNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [paso, setPaso] = useState("config");
  const [configEstructura, setConfigEstructura] = useState(null);
  const [bloques, setBloques] = useState([]);
  const [matriz, setMatriz] = useState([]);

  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) { const cred = await signInAnonymously(auth); if (!alive) return; setUid(cred.user?.uid || null); }
        else { setUid(u.uid); setProfesorNombre(u.displayName || u.email || ""); }
      } catch { setUid(null); }
    });
    return () => { alive = false; unsub && unsub(); };
  }, []);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (!snap.exists()) return;
        const data = snap.data() || {};
        if (data.nombre) setProfesorNombre(String(data.nombre));
        if (data.horarioEstructura) {
          const cfg = data.horarioEstructura;
          setConfigEstructura(cfg);
          const bqs = generarBloques(cfg);
          setBloques(bqs);
          setMatriz(Array.isArray(data.horario_flat) && data.horario_flat.length ? rebuildMatriz(data.horario_flat, bqs) : construirMatrizDesde(bqs));
          setPaso("tabla");
        }
      } catch (e) { console.warn("[HorarioEditable] load:", e?.message); }
    })();
  }, [uid]);

  function handleConfirmarConfig(config, bloquesGenerados) {
    setConfigEstructura(config); setBloques(bloquesGenerados);
    const bloqueClases = bloquesGenerados.filter((b) => b.tipo === "clase");
    if (matriz.length !== bloqueClases.length) setMatriz(construirMatrizDesde(bloquesGenerados));
    setPaso("tabla");
  }

  const handleCambiarCelda = useCallback((row, col, field, value) => {
    setMatriz((prev) => { const next = prev.map((r) => r.slice()); next[row] = [...(next[row] || [])]; next[row][col] = { ...(next[row][col] || celdaVacia()), [field]: value }; return next; });
  }, []);

  async function guardarHorario() {
    if (!uid) return alert("No hay usuario autenticado.");
    if (!configEstructura) return alert("Primero configura la estructura del horario.");
    setSaving(true);
    try {
      const bloqueClases = bloques.filter((b) => b.tipo === "clase");
      const flat = flattenMatriz(matriz, bloqueClases);
      const marcas = bloques.map((b) => { const [h, m] = b.inicio.split(":").map(Number); return { h, m }; });
      const lastBloque = bloques.at(-1);
      const [hFin, mFin] = lastBloque.fin.split(":").map(Number);
      marcas.push({ h: hFin, m: mFin });
      const horarioConfig = { bloquesGenerados: bloques.map((b) => `${b.inicio} - ${b.fin}${b.tipo !== "clase" ? ` (${b.label})` : ""}`), marcas, marcasStr: bloques.map((b) => b.inicio).concat([lastBloque.fin]), estructura: normalizarConfigParaFS(configEstructura) };
      await setDoc(doc(db, "usuarios", uid), { horario_flat: flat, horarioMeta: { rows: bloqueClases.length, cols: 5 }, horarioConfig, horarioEstructura: normalizarConfigParaFS(configEstructura), updatedAt: serverTimestamp() }, { merge: true });
      await writeSlots(uid, matriz, bloqueClases, profesorNombre);
      const isOnboarding = localStorage.getItem("onboarding:fromRegistro") === "1" || localStorage.getItem("forceHorarioOnce") === "1";
      try { localStorage.removeItem("forceHorarioOnce"); } catch {}
      navigate(isOnboarding ? "/planificaciones" : "/InicioClase");
    } catch (e) { console.error("Guardar horario:", e); alert("No se pudo guardar el horario."); }
    finally { setSaving(false); }
  }

  return (
    <div style={wrap}>
      {/* ✅ BANNER TRIAL - bloquea si expiró, avisa si queda 1 día */}
      <BannerTrial />

      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ color: COLORS.white }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>🗓️ Horario Editable</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.85, fontSize: 14 }}>{paso === "config" ? "Configura la estructura de tu jornada escolar." : "Completa qué asignatura y unidad tienes en cada bloque."}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["config","tabla"].map((p, i) => (
            <React.Fragment key={p}>
              <div style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, background: paso === p ? COLORS.white : "rgba(255,255,255,0.25)", color: paso === p ? COLORS.brandA : COLORS.white, cursor: p === "config" ? "pointer" : "default" }} onClick={() => { if (p === "config") setPaso("config"); }}>
                {i + 1}. {p === "config" ? "Estructura del día" : "Completar horario"}
              </div>
              {i < 1 && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 18 }}>→</div>}
            </React.Fragment>
          ))}
        </div>
        {paso === "config" && <ConfiguradorHorario onConfirmar={handleConfirmarConfig} configInicial={configEstructura} />}
        {paso === "tabla" && bloques.length > 0 && <TablaHorario bloques={bloques} matriz={matriz} onChange={handleCambiarCelda} onGuardar={guardarHorario} onEditarConfig={() => setPaso("config")} saving={saving} />}
      </div>
    </div>
  );
}