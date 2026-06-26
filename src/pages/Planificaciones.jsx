// src/pages/Planificaciones.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, doc, setDoc, serverTimestamp,
  query, where, getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import BannerTrial from "../components/Bannertrial";

const toId = (s = "") =>
  s.toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "").trim();

const toNivelId = (raw = "") => {
  const s = raw.toString().toLowerCase().replace(/\s+/g, " ").replace(/[°º]/g, "").replace("básico", "basico").trim();
  return toId(s);
};

const ASIG_DISPLAY = {
  matematica: "Matemática", lenguaje: "Lenguaje", ciencias: "Ciencias",
  historia: "Historia", fisica: "Física", quimica: "Química",
  biologia: "Biología", ingles: "Inglés", tecnologia: "Tecnología",
};

const NIVEL_VARIANTES = {
  "1° medio": ["1º Medio", "1° Medio", "1 Medio"],
  "2° medio": ["2º Medio", "2° Medio", "2 Medio"],
  "3° medio": ["3º Medio", "3° Medio", "3 Medio"],
  "4° medio": ["4º Medio", "4° Medio", "4 Medio"],
  "7° básico": ["7º Básico", "7° Básico", "7 Básico"],
  "8° básico": ["8º Básico", "8° Básico", "8 Básico"],
  "1° básico": ["1º Básico", "1° Básico"],
  "2° básico": ["2º Básico", "2° Básico"],
};

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

function getNivelVariantes(nivel = "") {
  const key = nivel.toLowerCase().replace(/[°º]/g, "°").trim();
  return NIVEL_VARIANTES[key] || [nivel];
}

const niceCard = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem",
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
};
const btn = (bg) => ({ padding: ".45rem .85rem", borderRadius: 8, border: "none", color: "#fff", background: bg, cursor: "pointer" });
const input = { padding: ".5rem .75rem", borderRadius: 8, border: "1px solid #d1d5db" };

export default function Planificaciones() {
  const navigate = useNavigate();

  const isOnboarding = (() => { try { return localStorage.getItem("onboarding:fromRegistro") === "1"; } catch { return false; } })();

  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [asigSel, setAsigSel] = useState("");
  const [nivelSel, setNivelSel] = useState("");
  const [q, setQ] = useState("");
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [agregando, setAgregando] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    if (!auth.currentUser) signInAnonymously(auth).catch(console.error);
    return () => unsub();
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (snap.exists()) {
          const lista = Array.isArray(snap.data()?.asignaturasPermitidas)
            ? snap.data().asignaturasPermitidas.map((s) => String(s).trim()).filter(Boolean)
            : [];
          if (lista.length) setSeleccionadas(lista);
        }
      } catch (e) { console.warn("[Planificaciones] leer asignaturasPermitidas:", e?.message); }
    })();
  }, [user]);

  useEffect(() => {
    if (!asigSel) return;
    setSeleccionadas((prev) => Array.from(new Set([...prev, asigSel])));
  }, [asigSel]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const ref = collection(db, "curriculo");
        let snap;
        if (asigSel) {
          snap = await getDocs(query(ref, where("asignaturaId", "==", asigSel)));
        } else {
          snap = await getDocs(ref);
        }
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } catch (e) { console.error("Error leyendo curriculo:", e); }
      finally { setLoading(false); }
    };
    load();
  }, [asigSel]);

  const asigOptions = useMemo(() => { const s = new Set(); items.forEach((x) => x.asignaturaId && s.add(x.asignaturaId)); return Array.from(s).sort(); }, [items]);
  const nivelOptions = useMemo(() => { const s = new Set(); items.forEach((x) => x.nivel && s.add(x.nivel)); return Array.from(s).sort(); }, [items]);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((x) => {
      if (asigSel && x.asignaturaId !== asigSel) return false;
      if (nivelSel && (x.nivel || "") !== nivelSel) return false;
      if (!qq) return true;
      return [x.titulo, x.codUnidad, x.nivel, x.grado, ...(Array.isArray(x.objetivos) ? x.objetivos : []), ...(Array.isArray(x.habilidades) ? x.habilidades : [])].join(" ").toLowerCase().includes(qq);
    });
  }, [items, asigSel, nivelSel, q]);

  async function guardarMateriasParaHorario() {
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) return alert("No hay usuario autenticado.");
    const lista = Array.from(new Set(seleccionadas.map((s) => String(s).trim()).filter(Boolean)));
    if (!lista.length) return alert("Selecciona al menos una asignatura.");
    try {
      await setDoc(doc(db, "usuarios", uid), { asignaturasPermitidas: lista, asignaturasUpdatedAt: serverTimestamp() }, { merge: true });
      alert("✅ Materias guardadas.");
    } catch (e) { console.error("guardarMateriasParaHorario:", e); alert("No se pudo guardar las materias."); }
  }

  async function continuarAInicioClase() {
    const uid = auth.currentUser?.uid || user?.uid;
    const lista = Array.from(new Set(seleccionadas.map((s) => String(s).trim()).filter(Boolean)));
    if (lista.length && uid) {
      try { await setDoc(doc(db, "usuarios", uid), { asignaturasPermitidas: lista, asignaturasUpdatedAt: serverTimestamp() }, { merge: true }); }
      catch (e) { console.warn("[Planificaciones] guardar antes de continuar:", e); }
    }
    try { localStorage.removeItem("onboarding:fromRegistro"); } catch {}
    navigate("/InicioClase", { replace: true, state: { from: "onboarding" } });
  }

  async function propagarUnidadASlots(uid, row, objetivos, habilidades, nombre) {
    try {
      const usnap = await getDoc(doc(db, "usuarios", uid));
      if (!usnap.exists()) return 0;
      const data = usnap.data() || {};
      const flat = data.horario_flat || [];
      if (!flat.length) return 0;

      const horarioConfig = data.horarioConfig || {};
      const bloquesGen = Array.isArray(horarioConfig.bloquesGenerados) ? horarioConfig.bloquesGenerados : [];

      const asigId = (row.asignaturaId || "").toLowerCase();
      const nivelVariantes = getNivelVariantes(row.nivel || "");
      const asigDisplays = [
        ASIG_DISPLAY[asigId] || asigId,
        asigId,
        asigId.charAt(0).toUpperCase() + asigId.slice(1),
      ];

      const primerObjetivo = objetivos.length ? objetivos[0] : "";
      const habilidadesArr = Array.isArray(habilidades) ? habilidades : [];
      const habilidadesTexto = habilidadesArr.join(", ");

      let slotsActualizados = 0;

      for (const cell of flat) {
        const asigCelda = (cell.asignatura || "").trim();
        const nivelCelda = (cell.nivel || "").trim();

        const asigMatch = asigDisplays.some((a) => a.toLowerCase() === asigCelda.toLowerCase());
        const nivelMatch = nivelVariantes.some((n) => n.toLowerCase() === nivelCelda.toLowerCase());

        if (!asigMatch || !nivelMatch) continue;

        const slotId = `${cell.row}-${cell.col}`;
        const seccion = cell.seccion || "";
        const nivel = cell.nivel || "";
        const curso = nivel && seccion ? `${nivel} ${seccion}` : nivel || seccion || "";
        const dia = DIAS[cell.col] || "";

        let bloqueNombre = `Bloque ${cell.row + 1}`;
        let bloqueInicio = "";
        if (bloquesGen.length) {
          const soloClases = bloquesGen.filter((b) => !/(recreo|almuerzo)/i.test(b));
          const bStr = soloClases[cell.row] || bloquesGen[cell.row] || "";
          if (bStr) {
            bloqueInicio = bStr.split(" - ")[0] || "";
            bloqueNombre = `Bloque ${cell.row + 1}`;
          }
        }

        const payload = {
          unidad: nombre,
          objetivo: primerObjetivo,
          habilidades: habilidadesArr,
          habilidadesTexto,
          codUnidad: row.codUnidad || row.id || "",
          asignatura: cell.asignatura || "",
          nivel, seccion, curso, dia,
          bloque: bloqueNombre,
          bloqueInicio,
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, "clases_detalle", uid, "slots", slotId), payload, { merge: true });
        slotsActualizados++;
      }

      return slotsActualizados;
    } catch (e) {
      console.warn("[propagarUnidadASlots]", e?.message);
      return 0;
    }
  }

  const addToMyUnits = async (row) => {
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) { alert("No hay usuario (auth anónima falló)."); return; }

    const rowId = row.id || row.codUnidad || "x";
    setAgregando(rowId);

    try {
      const asigId = (row.asignaturaId || "").toString().toLowerCase();
      const nivelId = toNivelId(row.nivel || "");
      const unidadId = (row.codUnidad || row.id || "SINID").toString();
      const objetivos = Array.isArray(row.objetivos) ? row.objetivos : Array.isArray(row.oas) ? row.oas : [];
      const habilidades = Array.isArray(row.habilidades) ? row.habilidades : [];
      const nombre = row.titulo || row.codUnidad || unidadId;

      if (asigId) setSeleccionadas((prev) => Array.from(new Set([...prev, asigId])));

      await setDoc(
        doc(db, "usuarios", uid, "planificacion_usuario", `${asigId}_${nivelId}`),
        { updatedAt: serverTimestamp(), unidades: { [unidadId]: "seleccionada" } },
        { merge: true }
      );

      await setDoc(
        doc(db, "catalogo_curricular", asigId, "niveles", nivelId, "unidades", unidadId),
        { nombre, objetivos, habilidades, horasSugeridas: row.horasSugeridas || null, grado: row.grado || "", oaClaves: row.oaClaves || row.oaCodigos || null, createdFrom: "curriculo", updatedAt: serverTimestamp() },
        { merge: true }
      );

      const slotsActualizados = await propagarUnidadASlots(uid, row, objetivos, habilidades, nombre);

      if (slotsActualizados > 0) {
        alert(`✅ "${nombre}" guardada y propagada a ${slotsActualizados} bloque${slotsActualizados !== 1 ? "s" : ""} de tu horario.`);
      } else {
        alert(`✅ Unidad "${nombre}" guardada.\n\nNo se encontraron bloques de ${ASIG_DISPLAY[asigId] || asigId} ${row.nivel} en tu horario.`);
      }
    } catch (e) {
      console.error("addToMyUnits error:", e);
      alert("No se pudo agregar. Revisa consola.");
    } finally {
      setAgregando(null);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* ✅ BANNER TRIAL - bloquea si expiró, avisa si queda 1 día */}
      <BannerTrial />

      {isOnboarding && (
        <div style={{ background: "linear-gradient(135deg, #ecfdf5, #eff6ff)", border: "1px solid #a7f3d0", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#065f46" }}>🎉 ¡Ya tienes 7 días de prueba gratis activos!</div>
            <div style={{ fontSize: 13, color: "#047857", marginTop: 4 }}>Selecciona tus asignaturas y luego continúa a tu primera clase.</div>
          </div>
          <button onClick={continuarAInicioClase} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>
            Continuar a InicioClase →
          </button>
        </div>
      )}

      <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: "#ffffff", borderBottom: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12 }}>
        <button onClick={() => navigate("/horario")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 700 }}>
          ← Volver a Horario
        </button>
        <button onClick={guardarMateriasParaHorario} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 700, color: "#0ea5e9" }}>
          💾 Guardar materias para Horario
        </button>
        {isOnboarding && (
          <button onClick={continuarAInicioClase} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontWeight: 800, marginLeft: "auto" }}>
            Continuar a InicioClase →
          </button>
        )}
        {!isOnboarding && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
            {seleccionadas.length ? `Materias seleccionadas: ${seleccionadas.join(", ")}` : "Sin materias seleccionadas"}
          </div>
        )}
      </div>

      <h1 style={{ marginTop: 0 }}>📚 Planificaciones</h1>
      <p style={{ color: "#64748b", fontSize: 14 }}>
        Selecciona la unidad que vas a trabajar. Se guardará automáticamente en todos los bloques de tu horario para esa asignatura y nivel.
      </p>

      <div style={{ ...niceCard, marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#475569" }}>Asignatura</div>
            <select value={asigSel} onChange={(e) => setAsigSel(e.target.value)} style={input}>
              <option value="">(todas)</option>
              {asigOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#475569" }}>Nivel</div>
            <select value={nivelSel} onChange={(e) => setNivelSel(e.target.value)} style={input}>
              <option value="">(todos)</option>
              {nivelOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: "#475569" }}>Buscar</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Unidad, objetivo u habilidad…" style={{ ...input, width: "100%" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {loading && <div style={{ color: "#64748b" }}>Cargando planificaciones…</div>}
        {!loading && list.length === 0 && <div style={{ color: "#64748b" }}>No hay resultados con esos filtros.</div>}

        {list.map((row) => {
          const objetivos = Array.isArray(row.objetivos) ? row.objetivos : Array.isArray(row.oas) ? row.oas : [];
          const habilidades = Array.isArray(row.habilidades) ? row.habilidades : [];
          const nombre = row.titulo || row.codUnidad || row.id;
          const isLoading = agregando === (row.id || row.codUnidad);
          return (
            <div key={row.id} style={{ ...niceCard }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{nombre}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    <b>Unidad:</b> {row.codUnidad || row.id} • <b>Asignatura:</b> {row.asignaturaId} • <b>Nivel:</b> {row.nivel} • <b>Grado:</b> {row.grado}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addToMyUnits(row)}
                  disabled={!!agregando}
                  style={{ ...btn(isLoading ? "#94a3b8" : "#2563eb"), whiteSpace: "nowrap", minWidth: 160 }}
                >
                  {isLoading ? "Guardando…" : "Agregar a Mis Unidades"}
                </button>
              </div>

              {objetivos.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Objetivos</div>
                  <ul style={{ margin: "6px 0 0 1rem" }}>
                    {objetivos.slice(0, 6).map((o, i) => <li key={i} style={{ fontSize: 13 }}>{o}</li>)}
                  </ul>
                </div>
              )}

              {habilidades.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Habilidades</div>
                  <ul style={{ margin: "6px 0 0 1rem" }}>
                    {habilidades.slice(0, 6).map((h, i) => <li key={i} style={{ fontSize: 13 }}>{h}</li>)}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isOnboarding && (
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button onClick={continuarAInicioClase} style={{ padding: "14px 32px", borderRadius: 12, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 14px rgba(16,185,129,.4)" }}>
            ✅ Listo — Ir a mi primera clase →
          </button>
        </div>
      )}
    </div>
  );
}