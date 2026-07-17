// src/pages/Planificaciones.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import BannerTrial from "../components/BannerTrial";

/**
 * Planificaciones.jsx — versión simple/productiva
 *
 * Horario = día, bloque, curso, asignatura.
 * Planificación semanal = lo que cambia esa semana.
 * El profesor escribe poco; PragmaProfe completa lo demás.
 */

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const COLORS = {
  brandA: "#2193b0",
  brandB: "#6dd5ed",
  navy: "#0f172a",
  white: "#ffffff",
  soft: "#f8fafc",
  border: "#e5e7eb",
  muted: "#64748b",
  blue: "#0ea5e9",
  green: "#10b981",
  yellow: "#facc15",
};

const page = {
  minHeight: "100vh",
  background: `linear-gradient(135deg, ${COLORS.brandA}, ${COLORS.brandB})`,
  padding: 24,
  boxSizing: "border-box",
  fontFamily: "Segoe UI, system-ui, sans-serif",
};

const shell = { maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 };
const hero = {
  background: "rgba(15,23,42,.92)",
  color: "#fff",
  borderRadius: 30,
  padding: "30px 32px",
  boxShadow: "0 18px 44px rgba(15,23,42,.25)",
};
const card = {
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 18px 42px rgba(15,23,42,.12)",
};
const miniCard = { background: COLORS.soft, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 14 };
const btn = { border: `1px solid ${COLORS.border}`, borderRadius: 13, padding: "10px 14px", background: COLORS.white, color: COLORS.navy, fontWeight: 900, cursor: "pointer" };
const btnPrimary = { ...btn, border: "none", background: COLORS.blue, color: "#fff" };
const btnGreen = { ...btn, border: "none", background: COLORS.green, color: "#fff" };
const input = { width: "100%", padding: "11px 13px", borderRadius: 12, border: `1px solid ${COLORS.border}`, fontSize: 14, boxSizing: "border-box", background: "#fff", color: COLORS.navy };
const textarea = { ...input, minHeight: 98, resize: "vertical", lineHeight: 1.45, fontFamily: "Segoe UI, system-ui, sans-serif" };
const label = { display: "block", fontSize: 12, color: COLORS.muted, fontWeight: 950, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" };

function clean(v, fallback = "") {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  if (/undefined|null/i.test(s)) return fallback;
  if (/^\(sin /i.test(s)) return fallback;
  if (/^sin /i.test(s)) return fallback;
  return s;
}

function getWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function addDays(d, days) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
function previousWeekKey() { return getWeekKey(addDays(new Date(), -7)); }
function nextWeekKey() { return getWeekKey(addDays(new Date(), 7)); }
function slotFromCell(cell) { return `${Number(cell?.row ?? 0)}-${Number(cell?.col ?? 0)}`; }
function cursoFromCell(cell) {
  const nivel = clean(cell?.nivel);
  const seccion = clean(cell?.seccion);
  return clean(cell?.curso) || [nivel, seccion].filter(Boolean).join(" ");
}
function getDia(cell) { return DIAS[Number(cell?.col)] || clean(cell?.dia); }
function getBloque(cell) { return clean(cell?.bloque) || `Bloque ${Number(cell?.row || 0) + 1}`; }
function getHorario(cell) {
  const inicio = clean(cell?.bloqueInicio);
  const fin = clean(cell?.bloqueFin);
  if (inicio && fin) return `${inicio}-${fin}`;
  if (inicio) return inicio;
  return "";
}
function fromTextList(value) {
  return String(value || "").split(/,|\n/).map((x) => x.trim()).filter(Boolean);
}

function inferirUnidad({ asignatura, curso, objetivoSemana, contenidoBloque }) {
  const texto = `${objetivoSemana} ${contenidoBloque}`.toLowerCase();
  if (texto.includes("función inversa") || texto.includes("funcion inversa") || texto.includes("inversa de una función") || texto.includes("inversa de una funcion")) return "Función inversa";
  if (texto.includes("límite") || texto.includes("limite") || texto.includes("derivad") || texto.includes("integral")) return "Límites, derivadas e integrales";
  if (texto.includes("estad")) return "Estadística";
  if (texto.includes("probab")) return "Probabilidad";
  if (texto.includes("normal")) return "Distribución normal";
  if (texto.includes("binomial")) return "Distribución binomial";
  if (texto.includes("homotec")) return "Homotecia";
  if (texto.includes("logarit")) return "Logaritmos";
  if (texto.includes("trigonom")) return "Trigonometría";
  if (texto.includes("deriv")) return "Derivadas";
  if (texto.includes("circunferencia")) return "Circunferencia";
  if (texto.includes("recta")) return "Rectas";
  if (texto.includes("modelo")) return "Modelación matemática";
  return clean(asignatura, "Unidad");
}

function inferirOA({ curso, unidad, objetivoSemana }) {
  const texto = `${curso} ${unidad} ${objetivoSemana}`.toLowerCase();
  if ((texto.includes("2° medio") || texto.includes("2º medio") || texto.includes("2 medio")) && texto.includes("inversa")) return "MA2M OA05";
  if (texto.includes("homotec")) return "OA08";
  if (texto.includes("estad") || texto.includes("probab")) {
    if (texto.includes("3")) return "FG-MATE-3M";
    if (texto.includes("4")) return "FG-MATE-4M";
    return "OA";
  }
  if (texto.includes("deriv")) return "FG-MATE-LDI";
  return "OA";
}

function construirClaseMagistral(plan) {
  const curso = clean(plan.curso, "el curso");
  const asignatura = clean(plan.asignatura, "la asignatura");
  const objetivoSemana = clean(plan.objetivoSemana, "comprender el contenido central de la semana");
  const contenidoBloque = clean(plan.contenidoBloque, "el contenido de este bloque");
  // La tarjeta es la fuente pedagógica. Unidad, OA, objetivo y pregunta
  // se regeneran desde lo que el profesor acaba de escribir, sin conservar
  // valores curriculares antiguos provenientes del horario.
  const unidad = inferirUnidad({ ...plan, objetivoSemana, contenidoBloque });
  const oa = inferirOA({ ...plan, unidad, objetivoSemana });
  const objetivoClase = `Aplicar ${contenidoBloque} para avanzar en el objetivo semanal: ${objetivoSemana}.`;
  const preguntaActivacion = `¿Qué recuerdas o sabes que podría ayudarte hoy con ${unidad}?`;

  return {
    unidad,
    oa,
    objetivoClase,
    preguntaActivacion,
    introduccionFormal: `Hoy trabajaremos ${unidad} en ${asignatura}. El foco será conectar el objetivo semanal con una actividad concreta: ${contenidoBloque}.`,
    explicacionBasica: `En simple: primero activamos lo que ya saben, luego vemos el concepto, resolvemos un ejemplo guiado y finalmente lo aplicamos.`,
    explicacionNormal: `Para desarrollar ${contenidoBloque}, inicia con una situación breve, identifica datos relevantes, modela el procedimiento y pide que los estudiantes verbalicen la estrategia.`,
    explicacionAvanzada: `El nivel avanzado aparece cuando el estudiante justifica el procedimiento, compara estrategias, detecta errores y transfiere lo aprendido a otro contexto.`,
    ejemploGuiado: `1. Presenta una situación relacionada con ${contenidoBloque}.\n2. Pregunta qué información es relevante.\n3. Modela el primer paso.\n4. Pide anticipar el siguiente paso.\n5. Resuelve completo.\n6. Cierra preguntando qué estrategia se puede reutilizar.`,
    actividadPrincipal: clean(plan.actividadPrincipal) || "Trabajo en parejas con problemas reales y discusión de estrategias.",
    recursosIA: `Preparar explicación breve, ejemplo guiado, errores frecuentes, pregunta desafiante, actividad colaborativa y ticket de salida.`,
    ticketSalida: `1. Escribe con tus palabras qué aprendiste hoy.\n2. Resuelve o describe un ejemplo breve sobre ${unidad}.\n3. Explica qué parte fue más difícil y cómo la mejorarías.`,
    gincanaPrompt: `Crear evaluación gamificada para ${curso} en ${asignatura} sobre ${unidad}. Contenido: ${contenidoBloque}. Incluir preguntas baja, media y alta con retroalimentación.`,
    evaluacion: "Ticket de salida y evaluación gamificada con GincanaNexus.",
    habilidadesTexto: "Analizar, representar, argumentar",
    recursosTexto: "IA, YouTube, GeoGebra, Desmos, PDF, simulador, GincanaNexus",
  };
}

function emptyPlan(cell = {}) {
  const curso = cursoFromCell(cell);
  return {
    asignatura: clean(cell.asignatura), nivel: clean(cell.nivel), seccion: clean(cell.seccion), curso,
    dia: getDia(cell), bloque: getBloque(cell), horario: getHorario(cell),
    bloqueInicio: clean(cell.bloqueInicio), bloqueFin: clean(cell.bloqueFin),
    objetivoSemana: clean(cell.objetivoSemana),
    contenidoBloque: clean(cell.contenidoBloque || cell.contenido),
    actividadPrincipal: clean(cell.actividadPrincipal),
    observaciones: clean(cell.observaciones || cell.notasDocente),
    unidad: clean(cell.unidad), oa: clean(cell.oa || cell.objetivoCurricular),
    objetivoClase: clean(cell.objetivoClase || cell.objetivo), preguntaActivacion: clean(cell.preguntaActivacion),
    habilidadesTexto: clean(cell.habilidadesTexto) || "Analizar, representar, argumentar",
    recursosTexto: clean(cell.recursosTexto) || "IA, YouTube, GeoGebra, Desmos, PDF, simulador, GincanaNexus",
    evaluacion: clean(cell.evaluacion) || "Ticket de salida y evaluación gamificada con GincanaNexus.",
    gincana: cell.gincana ?? true,
  };
}

function completeForSave(plan) {
  const auto = construirClaseMagistral(plan);
  const finalPlan = { ...plan, ...auto };
  const habilidades = fromTextList(finalPlan.habilidadesTexto);
  const recursos = fromTextList(finalPlan.recursosTexto);
  return {
    asignatura: clean(finalPlan.asignatura), nivel: clean(finalPlan.nivel), seccion: clean(finalPlan.seccion), curso: clean(finalPlan.curso),
    dia: clean(finalPlan.dia), bloque: clean(finalPlan.bloque), horario: clean(finalPlan.horario),
    bloqueInicio: clean(finalPlan.bloqueInicio), bloqueFin: clean(finalPlan.bloqueFin),
    unidad: clean(finalPlan.unidad), oa: clean(finalPlan.oa), objetivoCurricular: clean(finalPlan.oa),
    objetivoSemana: clean(finalPlan.objetivoSemana), objetivoGeneral: clean(finalPlan.objetivoSemana),
    objetivo: clean(finalPlan.objetivoClase), objetivoClase: clean(finalPlan.objetivoClase),
    contenido: clean(finalPlan.contenidoBloque), contenidoBloque: clean(finalPlan.contenidoBloque),
    actividadPrincipal: clean(finalPlan.actividadPrincipal), observaciones: clean(finalPlan.observaciones), notasDocente: clean(finalPlan.observaciones),
    preguntaActivacion: clean(finalPlan.preguntaActivacion),
    habilidades, habilidadesTexto: habilidades.join(", "), recursos, recursosTexto: recursos.join(", "),
    evaluacion: clean(finalPlan.evaluacion), gincana: Boolean(finalPlan.gincana),
    introduccionFormal: clean(finalPlan.introduccionFormal), explicacionBasica: clean(finalPlan.explicacionBasica),
    explicacionNormal: clean(finalPlan.explicacionNormal), explicacionAvanzada: clean(finalPlan.explicacionAvanzada),
    ejemploGuiado: clean(finalPlan.ejemploGuiado), actividadPrincipalGenerada: clean(finalPlan.actividadPrincipal),
    recursosIA: clean(finalPlan.recursosIA), ticketSalida: clean(finalPlan.ticketSalida), gincanaPrompt: clean(finalPlan.gincanaPrompt),
    fase: "planificacion-semanal-simple", preparadoPara: ["InicioClase", "DesarrolloClase", "CierreClase", "GincanaNexus"],
  };
}

function Pill({ children, color = "#e0f2fe" }) {
  return <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: color, color: COLORS.navy, fontWeight: 900, fontSize: 12 }}>{children}</span>;
}
function Field({ title, children }) { return <div><label style={label}>{title}</label>{children}</div>; }

function PreviewBox({ plan }) {
  const auto = construirClaseMagistral(plan);
  const unidad = auto.unidad;
  const oa = auto.oa;
  const objetivoClase = auto.objetivoClase;
  return (
    <div style={{ ...miniCard, background: "#f0f9ff", borderColor: "#bae6fd" }}>
      <div style={{ fontWeight: 950, color: COLORS.navy, marginBottom: 8 }}>Vista automática que usará PragmaProfe</div>
      <div style={{ display: "grid", gap: 6, fontSize: 13, color: COLORS.navy }}>
        <div><b>Unidad detectada:</b> {unidad}</div>
        <div><b>OA sugerido:</b> {oa}</div>
        <div><b>Objetivo de clase:</b> {objetivoClase}</div>
        <div><b>Gincana:</b> {plan.gincana ? "Sí, evaluar en el cierre" : "No"}</div>
      </div>
    </div>
  );
}

function SimplePlanCard({ cell, value, onChange, onSave, saving }) {
  const slotId = slotFromCell(cell);
  const listo = clean(value.objetivoSemana) && clean(value.contenidoBloque);
  function update(field, val) { onChange(slotId, { ...value, [field]: val }); }
  return (
    <div style={{ ...card, borderColor: listo ? "#86efac" : COLORS.border }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <Pill>{value.dia}</Pill><Pill>{value.bloque}</Pill>{value.horario && <Pill>{value.horario}</Pill>}
          </div>
          <div style={{ fontSize: 25, fontWeight: 950, color: COLORS.navy }}>{value.curso || "Curso"} · {value.asignatura || "Asignatura"}</div>
          <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Slot {slotId} · El profesor escribe lo esencial, PragmaProfe arma la clase.</div>
        </div>
        <Pill color={listo ? "#dcfce7" : "#fef9c3"}>{listo ? "✓ Lista para ejecutar" : "Falta objetivo/contenido"}</Pill>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <Field title="1. Objetivo de esta semana">
          <textarea style={textarea} value={value.objetivoSemana} onChange={(e) => update("objetivoSemana", e.target.value)} placeholder="Ej: Analizar datos estadísticos para tomar decisiones fundamentadas." />
        </Field>
        <Field title="2. Contenido que pasaré en este bloque">
          <textarea style={textarea} value={value.contenidoBloque} onChange={(e) => update("contenidoBloque", e.target.value)} placeholder="Ej: Resolver ejercicios PAES de distribución normal usando tabla Z." />
        </Field>
        <Field title="3. Actividad principal">
          <textarea style={{ ...textarea, minHeight: 82 }} value={value.actividadPrincipal} onChange={(e) => update("actividadPrincipal", e.target.value)} placeholder="Ej: Trabajo en parejas con problemas reales y discusión de respuestas." />
        </Field>
        <Field title="4. Observaciones del profesor">
          <textarea style={{ ...textarea, minHeight: 72 }} value={value.observaciones} onChange={(e) => update("observaciones", e.target.value)} placeholder="Ej: Llevar calculadora, apoyar a estudiantes PIE, revisar guía anterior." />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: COLORS.navy }}>
          <input type="checkbox" checked={Boolean(value.gincana)} onChange={(e) => update("gincana", e.target.checked)} />
          Evaluar esta clase con GincanaNexus en el cierre
        </label>
        <PreviewBox plan={value} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Al guardar se generan automáticamente unidad, OA sugerido, introducción, explicación, actividad, ticket de salida y prompt para Gincana.</div>
          <button style={{ ...btnGreen, minWidth: 190 }} disabled={saving} onClick={() => onSave(slotId)}>{saving ? "Guardando…" : "💾 Guardar clase"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Planificaciones() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [weekKey, setWeekKey] = useState(getWeekKey());
  const [usuario, setUsuario] = useState(null);
  const [bloques, setBloques] = useState([]);
  const [plans, setPlans] = useState({});
  const [filterDia, setFilterDia] = useState("Todos");
  const [filterCurso, setFilterCurso] = useState("Todos");
  const [search, setSearch] = useState("");
  const slotSolicitado = clean(location.state?.slotId);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setLoading(false); return; }
    async function load() {
      setLoading(true);
      try {
        const usnap = await getDoc(doc(db, "usuarios", uid));
        const udata = usnap.exists() ? usnap.data() || {} : {};
        setUsuario(udata);
        const flat = Array.isArray(udata.horario_flat) ? udata.horario_flat : [];
        const reales = flat.filter((c) => clean(c.asignatura) && (clean(c.nivel) || clean(c.curso))).sort((a, b) => Number(a.col) - Number(b.col) || Number(a.row) - Number(b.row));
        setBloques(reales);
        const nextPlans = {};
        for (const cell of reales) {
          const slotId = slotFromCell(cell);
          const snap = await getDoc(doc(db, "clases_detalle", uid, "slots", slotId));
          const saved = snap.exists() ? snap.data() || {} : {};
          const base = emptyPlan(cell);
          nextPlans[slotId] = {
            ...base, ...saved,
            objetivoSemana: clean(saved.objetivoSemana || saved.objetivoGeneral) || base.objetivoSemana,
            contenidoBloque: clean(saved.contenidoBloque || saved.contenido) || base.contenidoBloque,
            actividadPrincipal: clean(saved.actividadPrincipal) || base.actividadPrincipal,
            observaciones: clean(saved.observaciones || saved.notasDocente) || base.observaciones,
            gincana: saved.gincana ?? base.gincana,
          };
        }
        setPlans(nextPlans);
      } catch (e) {
        console.error("[Planificaciones] load:", e);
        alert("No se pudo cargar tu horario real. Revisa la consola.");
      } finally { setLoading(false); }
    }
    load();
  }, [user]);

  const cursos = useMemo(() => {
    const set = new Set();
    bloques.forEach((c) => { const curso = cursoFromCell(c); if (curso) set.add(curso); });
    return Array.from(set).sort();
  }, [bloques]);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bloques.filter((c) => {
      const dia = getDia(c); const curso = cursoFromCell(c); const slotId = slotFromCell(c); const plan = plans[slotId] || {};
      // Si el profesor llegó desde "Editar tarjeta" en InicioClase,
      // se muestra únicamente el slot activo. Así no puede editar por error
      // otra tarjeta del mismo viernes.
      if (slotSolicitado && slotId !== slotSolicitado) return false;
      if (filterDia !== "Todos" && dia !== filterDia) return false;
      if (filterCurso !== "Todos" && curso !== filterCurso) return false;
      if (!q) return true;
      return [dia, curso, c.asignatura, plan.objetivoSemana, plan.contenidoBloque, plan.actividadPrincipal, plan.observaciones].join(" ").toLowerCase().includes(q);
    });
  }, [bloques, plans, filterDia, filterCurso, search, slotSolicitado]);

  const stats = useMemo(() => {
    const total = bloques.length; let listos = 0; let conGincana = 0;
    bloques.forEach((cell) => { const p = plans[slotFromCell(cell)] || {}; if (clean(p.objetivoSemana) && clean(p.contenidoBloque)) listos++; if (p.gincana) conGincana++; });
    return { total, listos, conGincana };
  }, [bloques, plans]);

  function updatePlan(slotId, value) { setPlans((prev) => ({ ...prev, [slotId]: value })); }

  async function saveOne(slotId) {
    const uid = user?.uid;
    if (!uid) return alert("Debes iniciar sesión.");
    const plan = plans[slotId];
    if (!plan) return;
    if (!clean(plan.objetivoSemana) || !clean(plan.contenidoBloque)) return alert("Completa al menos el objetivo de la semana y el contenido de este bloque.");
    setSaving(slotId);
    try {
      const payload = {
        ...completeForSave(plan), semana: weekKey,
        profesor: clean(usuario?.nombre || user?.displayName || user?.email, "Profesor"),
        nombreProfesor: clean(usuario?.nombre || user?.displayName || user?.email, "Profesor"),
        institucion: clean(usuario?.colegio || usuario?.institucion, "Liceo Presidente Balmaceda"),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "clases_detalle", uid, "slots", slotId), payload, { merge: true });
      setPlans((prev) => ({ ...prev, [slotId]: { ...prev[slotId], ...payload, objetivoSemana: payload.objetivoSemana, contenidoBloque: payload.contenidoBloque, actividadPrincipal: payload.actividadPrincipal, observaciones: payload.observaciones } }));
      try {
        const fecha = new Date().toISOString().slice(0, 10);
        localStorage.removeItem(`pragma:tarjetaConfirmada:${fecha}:${slotId}`);
        localStorage.setItem("__lastSlotId", slotId);
      } catch {}

      alert("✅ Clase guardada. Inicio, Desarrollo, Cierre y Gincana leerán esta planificación.");

      const volverA = location.state?.volverA;
      const slotSolicitado = location.state?.slotId;
      if (volverA && (!slotSolicitado || slotSolicitado === slotId)) {
        navigate(volverA, { replace: true });
      }
    } catch (e) { console.error("[Planificaciones] saveOne:", e); alert("No se pudo guardar esta clase."); }
    finally { setSaving(""); }
  }

  async function saveAll() {
    const uid = user?.uid;
    if (!uid) return alert("Debes iniciar sesión.");
    const pendientes = bloques.filter((cell) => { const p = plans[slotFromCell(cell)] || {}; return !clean(p.objetivoSemana) || !clean(p.contenidoBloque); });
    if (pendientes.length) return alert(`Hay ${pendientes.length} bloque(s) sin objetivo/contenido. Guarda primero esos datos.`);
    setSaving("all");
    try {
      for (const cell of bloques) {
        const slotId = slotFromCell(cell); const plan = plans[slotId]; if (!plan) continue;
        await setDoc(doc(db, "clases_detalle", uid, "slots", slotId), {
          ...completeForSave(plan), semana: weekKey,
          profesor: clean(usuario?.nombre || user?.displayName || user?.email, "Profesor"),
          nombreProfesor: clean(usuario?.nombre || user?.displayName || user?.email, "Profesor"),
          institucion: clean(usuario?.colegio || usuario?.institucion, "Liceo Presidente Balmaceda"),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      alert("✅ Semana completa guardada.");
    } catch (e) { console.error("[Planificaciones] saveAll:", e); alert("No se pudo guardar toda la semana."); }
    finally { setSaving(""); }
  }

  if (!user) return (
    <div style={page}><div style={{ ...card, maxWidth: 680, margin: "80px auto" }}><h1 style={{ marginTop: 0 }}>Debes iniciar sesión</h1><p style={{ color: COLORS.muted }}>Para planificar tu semana, primero entra con tu cuenta de profesor.</p><button style={btnPrimary} onClick={() => navigate("/login")}>Ir al login</button></div></div>
  );

  return (
    <div style={page}>
      <BannerTrial />
      <div style={shell}>
        <section style={hero}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ maxWidth: 780 }}>
              <div style={{ display: "inline-block", padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,.12)", fontWeight: 950, marginBottom: 12 }}>📚 Planificación semanal simple · PragmaProfe v1.0</div>
              <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.06 }}>Escribe poco. PragmaProfe arma la clase.</h1>
              <p style={{ margin: "12px 0 0", fontSize: 17, opacity: .92, lineHeight: 1.55 }}>Para cada bloque solo completas cuatro cosas: objetivo semanal, contenido del bloque, actividad y observaciones. El sistema genera unidad, OA sugerido, explicación, ticket de salida y Gincana.</p>
            </div>
            <div style={{ display: "grid", gap: 8, minWidth: 230 }}>
              <button style={btn} onClick={() => navigate("/horario")}>← Volver al horario</button>
              <button style={btnPrimary} onClick={() => navigate("/InicioClase")}>Ir a InicioClase →</button>
              <button style={btnGreen} onClick={saveAll} disabled={saving === "all"}>{saving === "all" ? "Guardando…" : "💾 Guardar toda la semana"}</button>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <div style={miniCard}><b>Total de bloques</b><div style={{ fontSize: 30, fontWeight: 950 }}>{stats.total}</div></div>
          <div style={miniCard}><b>Listos</b><div style={{ fontSize: 30, fontWeight: 950 }}>{stats.listos}</div></div>
          <div style={miniCard}><b>Con Gincana</b><div style={{ fontSize: 30, fontWeight: 950 }}>{stats.conGincana}</div></div>
          <div style={miniCard}><b>Semana</b><div style={{ fontSize: 20, fontWeight: 950 }}>{weekKey}</div></div>
        </section>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div><div style={{ fontWeight: 950, fontSize: 20, color: COLORS.navy }}>Tus clases reales de la semana</div><div style={{ color: COLORS.muted, fontSize: 13 }}>Salen de tu horario guardado. Aquí no hay unidades mezcladas ni datos inventados.</div></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select style={{ ...input, width: 180 }} value={weekKey} onChange={(e) => setWeekKey(e.target.value)}><option value={previousWeekKey()}>Semana anterior · {previousWeekKey()}</option><option value={getWeekKey()}>Esta semana · {getWeekKey()}</option><option value={nextWeekKey()}>Próxima semana · {nextWeekKey()}</option></select>
              <select style={{ ...input, width: 150 }} value={filterDia} onChange={(e) => setFilterDia(e.target.value)}><option>Todos</option>{DIAS.map((d) => <option key={d}>{d}</option>)}</select>
              <select style={{ ...input, width: 170 }} value={filterCurso} onChange={(e) => setFilterCurso(e.target.value)}><option>Todos</option>{cursos.map((c) => <option key={c}>{c}</option>)}</select>
              <input style={{ ...input, width: 220 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar curso o contenido..." />
            </div>
          </div>
        </section>

        {loading && <div style={card}>Cargando tu horario real…</div>}
        {!loading && bloques.length === 0 && <div style={card}><h2 style={{ marginTop: 0 }}>Aún no tienes horario real guardado</h2><p style={{ color: COLORS.muted }}>Primero completa tu horario: día, bloque, curso y asignatura. Luego vuelves aquí y planificas cada bloque.</p><button style={btnPrimary} onClick={() => navigate("/horario")}>Completar horario</button></div>}
        {!loading && visibles.length === 0 && bloques.length > 0 && <div style={card}>No hay bloques con esos filtros.</div>}
        {!loading && visibles.length > 0 && <div style={{ display: "grid", gap: 16 }}>{visibles.map((cell) => { const slotId = slotFromCell(cell); return <SimplePlanCard key={slotId} cell={cell} value={plans[slotId] || emptyPlan(cell)} onChange={updatePlan} onSave={saveOne} saving={saving === slotId} />; })}</div>}
      </div>
    </div>
  );
}
