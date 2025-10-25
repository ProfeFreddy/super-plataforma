import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, setDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

const toId = (s = "") =>
  s.toString().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const toNivelId = (raw = "") => {
  // Ejemplos: "7° básico" -> "7basico", "1 Medio" -> "1medio"
  const s = raw.toString().toLowerCase()
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
const btn = (bg) => ({ padding: ".45rem .85rem", borderRadius: 8, border: "none", color: "#fff", background: bg, cursor: "pointer" });
const input = { padding: ".5rem .75rem", borderRadius: 8, border: "1px solid #d1d5db" };

export default function Planificaciones() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  // Filtros
  const [asigSel, setAsigSel] = useState("");
  const [nivelSel, setNivelSel] = useState("");
  const [gradoSel, setGradoSel] = useState("");
  const [q, setQ] = useState("");

  // ────────────────────────────────────────────────────────────────────────────────
  // Auth anónima si hace falta
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    if (!auth.currentUser) { signInAnonymously(auth).catch(console.error); }
    return () => unsub();
  }, []);

  // ────────────────────────────────────────────────────────────────────────────────
  // Cargar curriculo (puedes limitar por asignatura para reducir lecturas)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const ref = collection(db, "curriculo");
        let snap;

        // Si hay asignatura seleccionada, filtramos en servidor por asignaturaId
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

  // ────────────────────────────────────────────────────────────────────────────────
  // Opciones únicas para selects
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

  const gradoOptions = useMemo(() => {
    const s = new Set();
    items.forEach((x) => x.grado && s.add(x.grado));
    return Array.from(s).sort();
  }, [items]);

  // ────────────────────────────────────────────────────────────────────────────────
  // Filtro final en cliente
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((x) => {
      if (asigSel && x.asignaturaId !== asigSel) return false;
      if (nivelSel && (x.nivel || "") !== nivelSel) return false;
      if (gradoSel && (x.grado || "") !== gradoSel) return false;

      if (!qq) return true;
      const hay = [
        x.titulo, x.codUnidad, x.nivel, x.grado,
        ...(Array.isArray(x.objetivos) ? x.objetivos : []),
        ...(Array.isArray(x.habilidades) ? x.habilidades : []),
      ].join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [items, asigSel, nivelSel, gradoSel, q]);

  // ────────────────────────────────────────────────────────────────────────────────
  // Agregar a "Mis Unidades" + materializar en catalogo_curricular
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

      // 1) planificacion_usuario → marca “seleccionada”
      const prefDoc = doc(db, "usuarios", uid, "planificacion_usuario", `${asigId}_${nivelId}`);
      await setDoc(prefDoc, {
        updatedAt: serverTimestamp(),
        // guardamos/actualizamos un map simple id->estado
        unidades: {
          [unidadId]: "seleccionada",
        },
      }, { merge: true });

      // 2) catalogo_curricular → materializa la unidad (para que HorarioEditable la encuentre)
      const unidadDoc = doc(db, "catalogo_curricular", asigId, "niveles", nivelId, "unidades", unidadId);
      const objetivos = Array.isArray(row.objetivos) ? row.objetivos
                        : Array.isArray(row.oas) ? row.oas
                        : [];
      const habilidades = Array.isArray(row.habilidades) ? row.habilidades : [];
      const nombre = row.titulo || row.codUnidad || unidadId;

      await setDoc(unidadDoc, {
        nombre,
        objetivos,
        habilidades,
        horasSugeridas: row.horasSugeridas || null,
        grado: row.grado || "",
        oaClaves: row.oaClaves || row.oaCodigos || null,
        createdFrom: "curriculo",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert(`✓ Agregada: ${nombre}\nAsignatura: ${asigId} • Nivel: ${nivelId} • Unidad: ${unidadId}`);
    } catch (e) {
      console.error("addToMyUnits error:", e);
      alert("No se pudo agregar. Revisa consola.");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ marginTop: 0 }}>📚 Planificaciones</h1>
      <p>(Aquí verás lo que viene de <code>curriculo</code>. Agrega lo que usarás y luego vuelve a Horario.)</p>

      <div style={{ ...niceCard, marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#475569" }}>Asignatura</div>
            <select value={asigSel} onChange={(e)=>setAsigSel(e.target.value)} style={input}>
              <option value="">(todas)</option>
              {asigOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#475569" }}>Nivel</div>
            <select value={nivelSel} onChange={(e)=>setNivelSel(e.target.value)} style={input}>
              <option value="">(todos)</option>
              {nivelOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#475569" }}>Grado/Sección</div>
            <select value={gradoSel} onChange={(e)=>setGradoSel(e.target.value)} style={input}>
              <option value="">(todos)</option>
              {gradoOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: "#475569" }}>Buscar</div>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Unidad, objetivo u habilidad…" style={{ ...input, width: "100%" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {loading && <div style={{ color: "#64748b" }}>Cargando planificaciones…</div>}
        {!loading && list.length === 0 && (
          <div style={{ color: "#64748b" }}>No hay resultados con esos filtros.</div>
        )}

        {list.map((row) => {
          const objetivos = Array.isArray(row.objetivos) ? row.objetivos
            : Array.isArray(row.oas) ? row.oas
            : [];
          const habilidades = Array.isArray(row.habilidades) ? row.habilidades : [];
          const nombre = row.titulo || row.codUnidad || row.id;

          return (
            <div key={row.id} style={{ ...niceCard }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{nombre}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    <b>Unidad:</b> {row.codUnidad || row.id} • <b>Asignatura:</b> {row.asignaturaId} • <b>Nivel:</b> {row.nivel} • <b>Grado:</b> {row.grado}
                  </div>
                </div>
                <button type="button" onClick={()=>addToMyUnits(row)} style={btn("#2563eb")}>
                  Agregar a Mis Unidades
                </button>
              </div>

              {objetivos.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Objetivos</div>
                  <ul style={{ margin: "6px 0 0 1rem" }}>
                    {objetivos.slice(0,6).map((o, i) => <li key={i} style={{ fontSize: 13 }}>{o}</li>)}
                  </ul>
                </div>
              )}

              {habilidades.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Habilidades</div>
                  <ul style={{ margin: "6px 0 0 1rem" }}>
                    {habilidades.slice(0,6).map((h, i) => <li key={i} style={{ fontSize: 13 }}>{h}</li>)}
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
