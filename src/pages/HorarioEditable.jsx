// src/pages/HorarioEditable.jsx

// Render seguro para debug (evita "Objects are not valid as a React child")
const safeText = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "[obj]";
  }
};

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

/** ====== Estilos base ====== */
const COLORS = {
  brandA: "#2193b0",
  brandB: "#6dd5ed",
  white: "#ffffff",
  textDark: "#0f172a",
  text: "#1f2937",
  muted: "#64748b",
  border: "#e5e7eb",
  chip: "#f1f5f9",
  warn: "#fff7ed",
  warnBorder: "#fdba74",
};
const wrap = {
  minHeight: "100vh",
  background: `linear-gradient(to right, ${COLORS.brandA}, ${COLORS.brandB})`,
  padding: "24px",
  boxSizing: "border-box",
  fontFamily: "Segoe UI, system-ui, sans-serif",
  color: COLORS.white,
};
const card = {
  background: COLORS.white,
  color: COLORS.text,
  borderRadius: 12,
  padding: 16,
  border: `1px solid ${COLORS.border}`,
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
};
const h1 = { margin: 0, fontSize: 22, fontWeight: 900 };
const row = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};
const tabsBar = {
  display: "flex",
  gap: 8,
  background: "#eef6fb",
  borderRadius: 10,
  padding: 4,
  marginTop: 8,
};
const tabBtn = (active) => ({
  background: active ? "#ffffff" : "transparent",
  color: active ? COLORS.textDark : "#0ea5e9",
  border: "1px solid " + (active ? COLORS.border : "transparent"),
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
});
const btn = {
  background: COLORS.white,
  color: "#0ea5e9",
  border: "1px solid " + COLORS.border,
  borderRadius: 10,
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};
const btnDisabled = { ...btn, opacity: 0.6, cursor: "not-allowed" };
const btnDanger = { ...btn, color: "#ef4444" };
const grid = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };
const th = {
  background: "#f8fafc",
  color: COLORS.textDark,
  borderBottom: `1px solid ${COLORS.border}`,
  padding: 10,
  fontWeight: 800,
  position: "sticky",
  top: 0,
  zIndex: 1,
};
const td = {
  borderBottom: `1px solid ${COLORS.border}`,
  borderRight: `1px solid ${COLORS.border}`,
  padding: 8,
  verticalAlign: "top",
  background: "#ffffff",
};
const tdLocked = { ...td, background: "#f1f5f9", color: COLORS.muted };
const selectStyle = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 8,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.white,
};
const inputStyle = { ...selectStyle };
const small = { color: COLORS.muted, fontSize: 12, marginTop: 6 };

/** ====== Config básica: bloques + recreos ====== */
const BLOQUES = [
  "08:00 - 08:45",
  "08:45 - 09:30",
  "09:30 - 09:50 (Recreo)",
  "09:50 - 10:35",
  "10:35 - 11:20",
  "11:20 - 11:30 (Recreo)",
  "11:30 - 12:15",
  "12:15 - 13:00",
  "13:00 - 13:45 (Almuerzo)",
  "13:45 - 14:30",
  "14:30 - 15:15",
  "15:15 - 15:30 (Recreo)",
  "15:30 - 16:15",
  "16:15 - 17:00",
  "17:00 - 17:45",
  "17:45 - 18:30",
];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
function marcasFromBloques(bloques) {
  const HHMM = (s) => {
    const [h, m] = s.split(":").map((n) => Number(n));
    return [isFinite(h) ? h : 0, isFinite(m) ? m : 0];
  };
  const starts = bloques.map((b) => String(b).split(" - ")[0]);
  const lastEnd = String(bloques.at(-1)).split(" - ")[1].split(" ")[0];
  const all = [...starts, lastEnd];
  return all.map((s) => HHMM(s));
}

/* ——— NIVELES (Chile): de 7º Básico a 4º Medio ——— */
const NIVELES = [
  "7º Básico",
  "8º Básico",
  "1º Medio",
  "2º Medio",
  "3º Medio",
  "4º Medio",
];

const SECCIONES = ["A", "B", "C", "D", "E"];
const ASIGNATURAS_BASE = [
  "Matemática",
  "Lenguaje",
  "Ciencias",
  "Historia",
  "Física",
  "Química",
  "Biología",
  "Inglés",
  "Tecnología",
];

function celdaVacia() {
  return {
    asignatura: "",
    nivel: "",
    seccion: "",
    unidad: "",
    objetivo: "",
    habilidades: "",
  };
}
function construirMatriz(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => celdaVacia())
  );
}
function esBloqueNoLectivo(idx) {
  return /\(Recreo\)|\(Almuerzo\)/i.test(BLOQUES[idx] || "");
}

/** ====== Normalizadores ====== */
const toId = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const toNivelId = (raw = "") => {
  const s = String(raw)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[°º]/g, "")
    .replace("básico", "basico")
    .replace("medio", "medio")
    .trim();
  return toId(s);
};

/** ====== Firestore helpers ====== */
function flattenHorario(matriz = []) {
  const out = [];
  for (let row = 0; row < matriz.length; row++) {
    const fila = matriz[row] || [];
    for (let col = 0; col < (fila.length || 0); col++) {
      const cell = fila[col] || {};
      out.push({ row, col, ...cell });
    }
  }
  return out;
}
function rebuildFromFlat(flat = [], rows, cols) {
  const M = construirMatriz(rows, cols);
  for (const c of flat) {
    if (
      Number.isInteger(c.row) &&
      Number.isInteger(c.col) &&
      c.row < rows &&
      c.col < cols
    ) {
      const { row, col, ...rest } = c;
      M[row][col] = { ...celdaVacia(), ...rest };
    }
  }
  return M;
}
function normalizeConfigForFS(cfg = {}) {
  const out = { ...cfg };
  if (Array.isArray(cfg.marcas)) {
    out.marcas = cfg.marcas.map((par) => {
      const [h, m] = Array.isArray(par) ? par : [0, 0];
      return { h: Number(h) || 0, m: Number(m) || 0 };
    });
  }
  return out;
}
function isEmptyCell(cell = {}) {
  return !(
    (cell.asignatura && String(cell.asignatura).trim()) ||
    (cell.unidad && String(cell.unidad).trim()) ||
    (cell.objetivo && String(cell.objetivo).trim()) ||
    (cell.habilidades && String(cell.habilidades).trim()) ||
    (cell.nivel && String(cell.nivel).trim()) ||
    (cell.seccion && String(cell.seccion).trim())
  );
}

/** — payload para Inicio/Desarrollo/Cierre (dos rutas) — */
async function writeSlotDetalle(uid, row, col, cell, profesorNombre = "") {
  const slotId = `${row}-${col}`;
  // habilidades puede venir como string; genero también arreglo y texto
  const habilidadesArr = Array.isArray(cell.habilidades)
    ? cell.habilidades
    : String(cell.habilidades || "").trim()
    ? String(cell.habilidades)
        .split(" • ")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const habilidadesTexto = habilidadesArr.length
    ? habilidadesArr.join(", ")
    : String(cell.habilidades || "");

  const payload = {
    asignatura: cell.asignatura || "",
    unidad: cell.unidad || "",
    objetivo: cell.objetivo || "",
    habilidades: habilidadesArr, // array para quien lo requiera
    habilidadesTexto, // y texto para mostrar rápido
    nivel: cell.nivel || "",
    seccion: cell.seccion || "",
    curso: (
      cell.curso ||
      ((cell.nivel || "") + (cell.seccion ? ` ${cell.seccion}` : ""))
    ).trim(),
    profesor: profesorNombre || "",
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "clases_detalle", uid, "slots", slotId), payload, {
    merge: true,
  });
  await setDoc(doc(db, "usuarios", uid, "slots", slotId), payload, {
    merge: true,
  }); // legacy
}

/** — resuelve unidad/objetivos/habilidades desde Planificaciones — */
async function pickUnidadDesdePlan(uid, asignatura, nivelLegible) {
  try {
    const asignaturaId = toId(asignatura);
    const nivelId = toNivelId(nivelLegible || "");
    if (!asignaturaId || !nivelId) return null;

    const pref = await getDoc(
      doc(
        db,
        "usuarios",
        uid,
        "planificacion_usuario",
        `${asignaturaId}_${nivelId}`
      )
    );
    const unidades = pref.exists() ? pref.data()?.unidades || {} : {};
    const unidadId =
      Object.keys(unidades).find((k) => unidades[k] === "seleccionada") ||
      Object.keys(unidades)[0];
    if (!unidadId) return null;

    const uDoc = await getDoc(
      doc(
        db,
        "catalogo_curricular",
        asignaturaId,
        "niveles",
        nivelId,
        "unidades",
        unidadId
      )
    );
    if (!uDoc.exists()) return null;

    const u = uDoc.data() || {};
    const nombre = u.nombre || unidadId;
    const objetivos = Array.isArray(u.objetivos) ? u.objetivos : [];
    const habilidades = Array.isArray(u.habilidades) ? u.habilidades : [];

    return {
      unidad: nombre,
      objetivo: objetivos.length ? String(objetivos[0]) : "",
      habilidadesTexto: habilidades.join(" • "),
      habilidadesArr: habilidades,
    };
  } catch {
    return null;
  }
}

export default function HorarioEditable() {
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState("horario");
  const [matriz, setMatriz] = useState(() =>
    construirMatriz(BLOQUES.length, DIAS.length)
  );

  // materias permitidas
  const [permitidas, setPermitidas] = useState([]);

  // nombre del profesor (para tarjeta en InicioClase)
  const [profesorNombre, setProfesorNombre] = useState("");

  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) {
          const cred = await signInAnonymously(auth);
          if (!alive) return;
          setUid(cred.user?.uid || null);
          setProfesorNombre(
            cred.user?.displayName || cred.user?.email || ""
          );
        } else {
          setUid(u.uid);
          setProfesorNombre(u.displayName || u.email || "");
        }
      } catch {
        setUid(null);
        setProfesorNombre("");
      }
    });
    return () => {
      alive = false;
      unsub && unsub();
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      try {
        const uref = doc(db, "usuarios", uid);
        const snap = await getDoc(uref);
        if (snap.exists()) {
          const data = snap.data() || {};
          const rows = BLOQUES.length,
            cols = DIAS.length;

          if (data.nombre && !profesorNombre)
            setProfesorNombre(String(data.nombre));

          if (Array.isArray(data.horario_flat) && data.horario_flat.length) {
            setMatriz(rebuildFromFlat(data.horario_flat, rows, cols));
          } else if (Array.isArray(data.horario) && data.horario.length) {
            const base = construirMatriz(rows, cols);
            for (let r = 0; r < rows; r++)
              for (let c = 0; c < cols; c++)
                base[r][c] = {
                  ...celdaVacia(),
                  ...(data.horario?.[r]?.[c] || {}),
                };
            setMatriz(base);
          }

          if (
            Array.isArray(data.asignaturasPermitidas) &&
            data.asignaturasPermitidas.length
          ) {
            setPermitidas(
              data.asignaturasPermitidas
                .map((s) => String(s || "").trim())
                .filter(Boolean)
            );
          } else {
            setPermitidas([]);
          }
        } else {
          setPermitidas([]);
        }
      } catch (e) {
        console.warn("[HorarioEditable] load:", e?.code || e?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]); // eslint-disable-line

  async function guardarHorario() {
    if (!uid) return alert("No hay usuario autenticado.");
    if (!permitidas.length)
      return alert(
        "Primero configura tus Planificaciones (materias permitidas)."
      );

    try {
      const marcas = marcasFromBloques(BLOQUES);
      const marcasStr = marcas.map(
        ([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );
      const horarioConfig = normalizeConfigForFS({
        bloquesGenerados: BLOQUES,
        marcas,
        marcasStr,
      });

      const plano = flattenHorario(matriz);

      for (const c of plano) {
        if (!Number.isInteger(c.row) || !Number.isInteger(c.col)) continue;
        if (esBloqueNoLectivo(c.row)) continue;
        if (!c.asignatura) continue;

        if (!permitidas.includes(c.asignatura)) {
          return alert(
            `La asignatura "${c.asignatura}" no está en tus materias permitidas. Ajusta Planificaciones.`
          );
        }

        const faltan = !(c.unidad && c.objetivo && c.habilidades);
        if (faltan) {
          const meta = await pickUnidadDesdePlan(
            uid,
            c.asignatura,
            c.nivel || ""
          );
          if (meta) {
            c.unidad = c.unidad || meta.unidad || "";
            c.objetivo = c.objetivo || meta.objetivo || "";
            // guardo texto para edición rápida; al escribir se enviará también como array/texto
            c.habilidades = c.habilidades || meta.habilidadesTexto || "";
          }
        }

        c.curso =
          c.curso ||
          ((c.nivel || "") + (c.seccion ? ` ${c.seccion}` : ""));
      }

      await setDoc(
        doc(db, "usuarios", uid),
        {
          horario_flat: plano,
          horarioMeta: { rows: BLOQUES.length, cols: DIAS.length },
          horarioConfig,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      for (const c of plano) {
        if (!Number.isInteger(c.row) || !Number.isInteger(c.col)) continue;
        if (esBloqueNoLectivo(c.row)) continue;

        const cell = {
          asignatura: c.asignatura,
          unidad: c.unidad,
          objetivo: c.objetivo,
          habilidades: c.habilidades, // texto (lo transformo a array/texto en writeSlotDetalle)
          nivel: c.nivel,
          seccion: c.seccion,
          curso: c.curso,
        };
        if (isEmptyCell(cell)) continue;
        await writeSlotDetalle(uid, c.row, c.col, cell, profesorNombre);
      }

      setEdit(false);
      navigate("/InicioClase");
    } catch (e) {
      console.error("Guardar horario:", e);
      alert("No se pudo guardar el horario.");
    }
  }

  function limpiarHorario() {
    const rows = BLOQUES.length,
      cols = DIAS.length;
    setMatriz(construirMatriz(rows, cols));
  }

  const onChangeCelda = (r, c, field, value) => {
    setMatriz((prev) => {
      const next = prev.map((fila) => fila.slice());
      next[r][c] = { ...next[r][c], [field]: value };
      return next;
    });
  };

  const lectivoCols = useMemo(() => DIAS.length, []);
  const materiasOpciones = useMemo(
    () => (permitidas.length ? permitidas : ASIGNATURAS_BASE),
    [permitidas]
  );

  function goPlanificador(r, c) {
    const cell = matriz?.[r]?.[c] || {};
    const params = new URLSearchParams({
      dia: String(c),
      bloque: String(r),
      diaNombre: DIAS[c] || "",
      bloqueHora: BLOQUES[r] || "",
      asignatura: cell.asignatura || "",
      nivel: cell.nivel || "",
      seccion: cell.seccion || "",
    }).toString();
    navigate(`/planificador?${params}`, { replace: false });
  }
  function goPlanificaciones() {
    navigate(`/planificaciones`, { replace: false });
  }

  const planReady = permitidas.length > 0;

  return (
    <div style={wrap}>
      <div style={{ ...card, maxWidth: 1200, margin: "0 auto" }}>
        <div style={row}>
          <div>
            <h1 style={h1}>Horario Editable</h1>
            <div style={tabsBar}>
              <button
                style={tabBtn(tab === "horario")}
                onClick={() => setTab("horario")}
              >
                Horario
              </button>
              <button
                style={tabBtn(tab === "plan")}
                onClick={() => setTab("plan")}
              >
                Seleccione o realice su Planificación
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {!edit && tab === "horario" && (
              <button
                style={btn}
                onClick={() => setEdit(true)}
                title="Habilitar edición del horario"
              >
                ✏️ Editar
              </button>
            )}
            {edit && tab === "horario" && (
              <>
                <button
                  style={planReady ? btn : btnDisabled}
                  onClick={planReady ? guardarHorario : undefined}
                  title={
                    planReady
                      ? "Guardar horario"
                      : "Configura tus planificaciones primero"
                  }
                >
                  💾 Guardar horario
                </button>
                <button
                  style={btnDanger}
                  onClick={() => {
                    if (
                      confirm(
                        "¿Limpiar todas las celdas (excepto recreos/almuerzo)?"
                      )
                    )
                      limpiarHorario();
                  }}
                >
                  🧹 Limpiar
                </button>
                <button style={btn} onClick={() => setEdit(false)}>
                  ❌ Cancelar
                </button>
              </>
            )}
            {tab === "plan" && (
              <>
                <button style={btn} onClick={goPlanificaciones}>
                  📚 Abrir Planificaciones
                </button>
              </>
            )}
          </div>
        </div>

        {!planReady && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 10,
              background: COLORS.warn,
              border: `1px solid ${COLORS.warnBorder}`,
            }}
          >
            <b>Primero configura tus Planificaciones.</b> Define tus materias en
            el panel de <em>Planificaciones</em>. Luego volverás aquí y solo
            verás esas materias en el Horario.
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
              }}
            >
              <button style={btn} onClick={() => setTab("plan")}>
                Ir a pestaña Planificaciones
              </button>
              <button style={btn} onClick={goPlanificaciones}>
                Abrir Planificaciones 📚
              </button>
            </div>
          </div>
        )}

        {tab === "horario" && (
          <>
            <div style={small}>
              * El botón <b>Guardar horario</b> solo aparece en modo edición.
              Tras guardar, el horario queda congelado para evitar cambios
              accidentales.
            </div>

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={grid}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 160 }}>Bloque</th>
                    {DIAS.map((d) => (
                      <th key={d} style={th}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BLOQUES.map((b, r) => {
                    const locked = esBloqueNoLectivo(r);
                    return (
                      <tr key={r}>
                        <td
                          style={{
                            ...td,
                            background: "#f8fafc",
                            fontWeight: 700,
                          }}
                        >
                          {b}
                        </td>
                        {Array.from({ length: lectivoCols }).map((_, c) => {
                          const cell = matriz?.[r]?.[c] || celdaVacia();
                          if (locked) {
                            return (
                              <td key={`${r}-${c}`} style={tdLocked}>
                                {/\(Recreo\)/i.test(b) ? "Recreo" : "Almuerzo"}
                              </td>
                            );
                          }
                          return (
                            <td key={`${r}-${c}`} style={td}>
                              {edit ? (
                                <select
                                  style={selectStyle}
                                  value={cell.asignatura || ""}
                                  onChange={(e) =>
                                    onChangeCelda(
                                      r,
                                      c,
                                      "asignatura",
                                      e.target.value
                                    )
                                  }
                                  disabled={!planReady}
                                  title={
                                    planReady
                                      ? ""
                                      : "Configura Planificaciones para habilitar materias"
                                  }
                                >
                                  <option value="">(asignatura)</option>
                                  {materiasOpciones.map((a) => (
                                    <option key={a} value={a}>
                                      {a}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div style={{ fontWeight: 700 }}>
                                  {cell.asignatura || (
                                    <span style={{ color: COLORS.muted }}>
                                      (—)
                                    </span>
                                  )}
                                </div>
                              )}

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: 6,
                                  marginTop: 6,
                                }}
                              >
                                {edit ? (
                                  <>
                                    <select
                                      style={selectStyle}
                                      value={cell.nivel || ""}
                                      onChange={(e) =>
                                        onChangeCelda(
                                          r,
                                          c,
                                          "nivel",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="">(nivel)</option>
                                      {NIVELES.map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      style={selectStyle}
                                      value={cell.seccion || ""}
                                      onChange={(e) =>
                                        onChangeCelda(
                                          r,
                                          c,
                                          "seccion",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="">(sección)</option>
                                      {SECCIONES.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </>
                                ) : (
                                  <>
                                    <div
                                      style={{
                                        background: COLORS.chip,
                                        borderRadius: 999,
                                        padding: "2px 8px",
                                        textAlign: "center",
                                        fontSize: 12,
                                      }}
                                    >
                                      {cell.nivel || "—"}
                                    </div>
                                    <div
                                      style={{
                                        background: COLORS.chip,
                                        borderRadius: 999,
                                        padding: "2px 8px",
                                        textAlign: "center",
                                        fontSize: 12,
                                      }}
                                    >
                                      {cell.seccion || "—"}
                                    </div>
                                  </>
                                )}
                              </div>

                              <div style={{ marginTop: 6 }}>
                                {edit ? (
                                  <>
                                    <input
                                      style={inputStyle}
                                      placeholder="Unidad (opcional)"
                                      value={cell.unidad || ""}
                                      onChange={(e) =>
                                        onChangeCelda(
                                          r,
                                          c,
                                          "unidad",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      style={{ ...inputStyle, marginTop: 6 }}
                                      placeholder="Objetivo (opcional)"
                                      value={cell.objetivo || ""}
                                      onChange={(e) =>
                                        onChangeCelda(
                                          r,
                                          c,
                                          "objetivo",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      style={{ ...inputStyle, marginTop: 6 }}
                                      placeholder="Habilidades (opcional)"
                                      value={cell.habilidades || ""}
                                      onChange={(e) =>
                                        onChangeCelda(
                                          r,
                                          c,
                                          "habilidades",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </>
                                ) : (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: COLORS.muted,
                                    }}
                                  >
                                    {cell.unidad ||
                                    cell.objetivo ||
                                    cell.habilidades ? (
                                      <>
                                        {cell.unidad && (
                                          <div>
                                            <b>Unidad:</b> {cell.unidad}
                                          </div>
                                        )}
                                        {cell.objetivo && (
                                          <div>
                                            <b>Objetivo:</b> {cell.objetivo}
                                          </div>
                                        )}
                                        {cell.habilidades && (
                                          <div>
                                            <b>Habilidades:</b>{" "}
                                            {cell.habilidades}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <em>(sin detalles)</em>
                                    )}
                                  </div>
                                )}
                              </div>

                              {!edit && !locked && (
                                <div style={{ marginTop: 8 }}>
                                  <button
                                    style={{ ...btn, width: "100%" }}
                                    onClick={() => goPlanificador(r, c)}
                                    title="Planificar este bloque"
                                  >
                                    🧭 Planificar
                                  </button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: COLORS.muted,
              }}
            >
              • Se guardan en{" "}
              <code>{`usuarios/${safeText(uid) || "{uid}"}`}</code>:{" "}
              <code>horario_flat</code>, <code>horarioMeta</code> y{" "}
              <code>horarioConfig</code>.
              <br />
              • Además se actualiza{" "}
              <code>{`clases_detalle/${
                safeText(uid) || "{uid}"
              }/slots/{row}-{col}`}</code>{" "}
              y{" "}
              <code>{`usuarios/${
                safeText(uid) || "{uid}"
              }/slots/{row}-{col}`}</code>{" "}
              para que Inicio/Desarrollo/Cierre lean la unidad, objetivo,
              habilidades, curso y profesor.
              <br />
              • Los recreos y el almuerzo no son editables.
            </div>
          </>
        )}

        {tab === "plan" && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                ...card,
                borderStyle: "dashed",
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                Seleccione o realice su Planificación
              </h3>
              <p style={{ color: COLORS.muted }}>
                Elija un bloque en la tabla de Horario y pulse{" "}
                <b>“Planificar”</b>, o abra el panel de planificaciones para
                crear/editar unidades y objetivos que luego verás
                automáticamente en<b> InicioClase</b>, <b>Desarrollo</b> y{" "}
                <b>Cierre</b>.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button style={btn} onClick={goPlanificaciones}>
                  📚 Abrir Planificaciones
                </button>
                <button
                  style={btn}
                  onClick={() => navigate("/planificador")}
                >
                  🆕 Nuevo plan en blanco
                </button>
                <button style={btn} onClick={() => setTab("horario")}>
                  ⬅️ Volver al Horario
                </button>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: COLORS.muted,
                }}
              >
                <b>Materias permitidas actuales:</b>{" "}
                {permitidas.length
                  ? permitidas.join(", ")
                  : "(aún sin definir)"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}












