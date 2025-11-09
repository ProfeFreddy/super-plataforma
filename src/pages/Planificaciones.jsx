import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

const toId = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const toNivelId = (raw = "") => {
  const s = raw
    .toString()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[°º]/g, "")
    .replace("básico", "basico")
    .trim();
  return toId(s);
};

const niceCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "1rem",
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
};
const btn = (bg) => ({
  padding: ".45rem .85rem",
  borderRadius: 8,
  border: "none",
  color: "#fff",
  background: bg,
  cursor: "pointer",
});
const input = {
  padding: ".5rem .75rem",
  borderRadius: 8,
  border: "1px solid #d1d5db",
};

export default function Planificaciones() {
  const navigate = useNavigate();

  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  // Filtros activos
  const [asigSel, setAsigSel] = useState("");
  const [nivelSel, setNivelSel] = useState("");
  const [q, setQ] = useState("");

  // Asignaturas elegidas para habilitar en Horario
  const [seleccionadas, setSeleccionadas] = useState([]);

  // ─── Auth anónima si hace falta ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(console.error);
    }
    return () => unsub();
  }, []);

  // 🔄 Precarga asignaturasPermitidas como preseleccionadas
  useEffect(() => {
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) return;
    (async () => {
      try {
        const uref = doc(db, "usuarios", uid);
        const snap = await getDoc(uref);
        if (snap.exists()) {
          const data = snap.data() || {};
          const lista = Array.isArray(data.asignaturasPermitidas)
            ? data.asignaturasPermitidas.map((s) => String(s).trim()).filter(Boolean)
            : [];
          if (lista.length) setSeleccionadas(lista);
        }
      } catch (e) {
        console.warn("[Planificaciones] leer asignaturasPermitidas:", e?.message);
      }
    })();
  }, [user]);

  // Cada vez que el usuario elige una asignatura en el filtro, la agregamos a “seleccionadas”
  useEffect(() => {
    if (!asigSel) return;
    setSeleccionadas((prev) => Array.from(new Set([...prev, asigSel])));
  }, [asigSel]);

  // ─── Cargar curriculo (filtrando por asignatura en servidor si aplica) ─────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const ref = collection(db, "curriculo");
        let snap;
        if (asigSel) {
          const qAsig = query(ref, where("asignaturaId", "==", asigSel));
          snap = await getDocs(qAsig);
        } else {
          snap = await getDocs(ref);
        }
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setItems(rows);
      } catch (e) {
        console.error("Error leyendo curriculo:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [asigSel]);

  // ─── Opciones únicas para selects ───────────────────────────────────────────────
  const asigOptions = useMemo(() => {
    const s = new Set();
    items.forEach((x) => x.asignaturaId && s.add(x.asignaturaId));
    return Array.from(s).sort();
  }, [items]);

  const nivelOptions = useMemo(() => {
    const s = new Set();
    items.forEach((x) => x.nivel && s.add(x.nivel));
    return Array.from(s).sort();
  }, [items]);

  // ─── Filtro final en cliente (ya sin grado/sección) ────────────────────────────
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((x) => {
      if (asigSel && x.asignaturaId !== asigSel) return false;
      if (nivelSel && (x.nivel || "") !== nivelSel) return false;

      if (!qq) return true;
      const hay = [
        x.titulo,
        x.codUnidad,
        x.nivel,
        x.grado,
        ...(Array.isArray(x.objetivos) ? x.objetivos : []),
        ...(Array.isArray(x.habilidades) ? x.habilidades : []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(qq);
    });
  }, [items, asigSel, nivelSel, q]);

  // ─── Guardar materias permitidas para el Horario ───────────────────────────────
  async function guardarMateriasParaHorario() {
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) return alert("No hay usuario autenticado.");
    const lista = Array.from(
      new Set(seleccionadas.map((s) => String(s).trim()).filter(Boolean))
    );
    if (!lista.length) {
      return alert("Selecciona al menos una asignatura.");
    }
    try {
      await setDoc(
        doc(db, "usuarios", uid),
        {
          asignaturasPermitidas: lista,
          asignaturasUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      alert("✅ Materias guardadas. En Horario verás solo esas asignaturas.");
    } catch (e) {
      console.error("guardarMateriasParaHorario:", e);
      alert("No se pudo guardar las materias.");
    }
  }

  // ─── Agregar a Mis Unidades + materializar en catalogo_curricular ──────────────
  const addToMyUnits = async (row) => {
    try {
      const uid = auth.currentUser?.uid || user?.uid;
      if (!uid) {
        alert("No hay usuario (auth anónima falló).");
        return;
      }

      const asigId = (row.asignaturaId || "").toString().toLowerCase();
      const nivelId = toNivelId(row.nivel || "");
      const unidadId = (row.codUnidad || row.id || "SINID").toString();

      if (asigId) {
        setSeleccionadas((prev) => Array.from(new Set([...prev, asigId])));
      }

      const prefDoc = doc(
        db,
        "usuarios",
        uid,
        "planificacion_usuario",
        `${asigId}_${nivelId}`
      );
      await setDoc(
        prefDoc,
        {
          updatedAt: serverTimestamp(),
          unidades: { [unidadId]: "seleccionada" },
        },
        { merge: true }
      );

      const unidadDoc = doc(
        db,
        "catalogo_curricular",
        asigId,
        "niveles",
        nivelId,
        "unidades",
        unidadId
      );
      const objetivos = Array.isArray(row.objetivos)
        ? row.objetivos
        : Array.isArray(row.oas)
        ? row.oas
        : [];
      const habilidades = Array.isArray(row.habilidades) ? row.habilidades : [];
      const nombre = row.titulo || row.codUnidad || unidadId;

      await setDoc(
        unidadDoc,
        {
          nombre,
          objetivos,
          habilidades,
          horasSugeridas: row.horasSugeridas || null,
          grado: row.grado || "",
          oaClaves: row.oaClaves || row.oaCodigos || null,
          createdFrom: "curriculo",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert(`✓ Agregada: ${nombre}\nAsignatura: ${asigId} • Nivel: ${nivelId} • Unidad: ${unidadId}`);
    } catch (e) {
      console.error("addToMyUnits error:", e);
      alert("No se pudo agregar. Revisa consola.");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* Barra superior fija */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "10px 12px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => navigate("/horario")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
          title="Volver al Horario"
        >
          ← Volver a Horario
        </button>

        <button
          onClick={guardarMateriasParaHorario}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            color: "#0ea5e9",
          }}
          title="Guardar materias seleccionadas para usarlas en el Horario"
        >
          💾 Guardar materias para Horario
        </button>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
          {seleccionadas.length
            ? `Materias seleccionadas: ${seleccionadas.join(", ")}`
            : "Sin materias seleccionadas"}
        </div>
      </div>

      <h1 style={{ marginTop: 0 }}>📚 Planificaciones</h1>
      <p>
        (Aquí verás lo que viene de <code>curriculo</code>. Agrega lo que usarás
        y luego vuelve a Horario.)
      </p>

      <div style={{ ...niceCard, marginBottom: "1rem" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#475569" }}>Asignatura</div>
            <select
              value={asigSel}
              onChange={(e) => setAsigSel(e.target.value)}
              style={input}
            >
              <option value="">(todas)</option>
              {asigOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#475569" }}>Nivel</div>
            <select
              value={nivelSel}
              onChange={(e) => setNivelSel(e.target.value)}
              style={input}
            >
              <option value="">(todos)</option>
              {nivelOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: "#475569" }}>Buscar</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Unidad, objetivo u habilidad…"
              style={{ ...input, width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {loading && <div style={{ color: "#64748b" }}>Cargando planificaciones…</div>}
        {!loading && list.length === 0 && (
          <div style={{ color: "#64748b" }}>No hay resultados con esos filtros.</div>
        )}

        {list.map((row) => {
          const objetivos = Array.isArray(row.objetivos)
            ? row.objetivos
            : Array.isArray(row.oas)
            ? row.oas
            : [];
          const habilidades = Array.isArray(row.habilidades)
            ? row.habilidades
            : [];
          const nombre = row.titulo || row.codUnidad || row.id;

          return (
            <div key={row.id} style={{ ...niceCard }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{nombre}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    <b>Unidad:</b> {row.codUnidad || row.id} • <b>Asignatura:</b>{" "}
                    {row.asignaturaId} • <b>Nivel:</b> {row.nivel} • <b>Grado:</b>{" "}
                    {row.grado}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addToMyUnits(row)}
                  style={btn("#2563eb")}
                >
                  Agregar a Mis Unidades
                </button>
              </div>

              {objetivos.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Objetivos</div>
                  <ul style={{ margin: "6px 0 0 1rem" }}>
                    {objetivos.slice(0, 6).map((o, i) => (
                      <li key={i} style={{ fontSize: 13 }}>
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {habilidades.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Habilidades</div>
                  <ul style={{ margin: "6px 0 0 1rem" }}>
                    {habilidades.slice(0, 6).map((h, i) => (
                      <li key={i} style={{ fontSize: 13 }}>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



