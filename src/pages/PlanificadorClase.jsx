import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db, auth } from "../firebase";

/* ================== helpers compartidos ================== */
const toId = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "");
const toNivelId = (s = "") => toId(s);
const makePlanId = (asigId, nivelId, unidadId) =>
  [toId(asigId), toId(nivelId), String(unidadId || "")]
    .filter(Boolean)
    .join("_");

const ensureAuthUid = async () => {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
};

const niceBtn = (bg) => ({
  padding: ".5rem .8rem",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  background: bg,
});

const box = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "1rem",
  boxShadow:
    "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
};

/* ================== componente ================== */
export default function PlanificadorClase() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  // query params
  const asigId = sp.get("asig") || "";
  const nivelId = sp.get("nivel") || "";
  const unidadId = sp.get("unidadId") || "";
  const urlPlanId = sp.get("planId") || makePlanId(asigId, nivelId, unidadId);
  const slot = sp.get("slot") || ""; // p.ej. "16-1"

  const [uid, setUid] = useState(auth.currentUser?.uid || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Datos del catálogo
  const [unidadNombre, setUnidadNombre] = useState("");
  const [oaCat, setOaCat] = useState([]); // OA desde catálogo
  const [habilidades, setHabilidades] = useState([]);

  // Duración de bloque del usuario (para feedback)
  const [durBloque, setDurBloque] = useState(45);

  // Plan editable
  const [planId, setPlanId] = useState(urlPlanId);
  const [items, setItems] = useState([]); // { id, texto, durMin, done? }
  const [asigNombre, setAsigNombre] = useState(asigId);
  const [nivelNombre, setNivelNombre] = useState(nivelId);

  // ------- bootstrap auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u?.uid) {
        setUid(u.uid);
      } else {
        const id = await ensureAuthUid();
        setUid(id);
      }
    });
    return () => unsub();
  }, []);

  // ------- carga catálogo + config bloque + nombre asignatura si existe en catálogo
  useEffect(() => {
    if (!uid) return;

    const load = async () => {
      setLoading(true);
      try {
        // Duración de bloque
        try {
          const uref = doc(db, "usuarios", uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const cfg = usnap.data()?.horarioConfig || {};
            if (Number.isFinite(+cfg.duracionMin)) {
              setDurBloque(Number(cfg.duracionMin));
            }
          }
        } catch {}

        // UNIDAD desde catálogo (ruta nueva)
        let uDoc = null;
        try {
          const refNew = doc(
            db,
            "catalogo_curricular",
            asigId,
            "niveles",
            nivelId,
            "unidades",
            unidadId
          );
          const sNew = await getDoc(refNew);
          if (sNew.exists()) uDoc = sNew.data();
        } catch {}

        // respaldo legacy si no encontramos
        if (!uDoc) {
          try {
            const refLegacy = doc(
              db,
              "catalogo_curricular",
              `${asigId}_${nivelId}`,
              "unidades",
              unidadId
            );
            const sL = await getDoc(refLegacy);
            if (sL.exists()) uDoc = sL.data();
          } catch {}
        }

        // Normalizar
        const nombreU =
          uDoc?.nombre || uDoc?.titulo || `Unidad ${unidadId}`;
        const oa =
          Array.isArray(uDoc?.objetivos)
            ? uDoc.objetivos
            : Array.isArray(uDoc?.OA)
            ? uDoc.OA
            : [];
        const hab = Array.isArray(uDoc?.habilidades)
          ? uDoc.habilidades
          : [];

        setUnidadNombre(nombreU);
        setOaCat(oa);
        setHabilidades(hab);

        // Nombre bonito de asignatura/nivel si está en cat raíz
        try {
          const asigSnap = await getDoc(
            doc(db, "catalogo_curricular", asigId)
          );
          if (asigSnap.exists() && asigSnap.data()?.nombre) {
            setAsigNombre(asigSnap.data().nombre);
          }
        } catch {}
        setNivelNombre(nivelId);

        // Cargar plan guardado (si existe)
        try {
          const pref = doc(db, "planes_clase", uid, "planes", urlPlanId);
          const ps = await getDoc(pref);
          if (ps.exists()) {
            const d = ps.data() || {};
            setPlanId(urlPlanId);
            const its = Array.isArray(d.items) ? d.items : [];
            setItems(
              its.map((x, i) => ({
                id: x.id ?? `it-${i + 1}`,
                texto: x.texto ?? "",
                durMin: Number(x.durMin) || 10,
                done: !!x.done,
              }))
            );
          } else {
            // crear boceto desde catálogo si no hay plan
            const baseDur =
              oa.length > 0 ? Math.max(5, Math.round(durBloque / oa.length)) : 10;
            setPlanId(urlPlanId);
            setItems(
              oa.map((t, i) => ({
                id: `oa-${i + 1}`,
                texto: t,
                durMin: baseDur,
                done: false,
              }))
            );
          }
        } catch (e) {
          console.warn("load plan error:", e);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, asigId, nivelId, unidadId, urlPlanId]);

  // ------- métricas
  const totalMin = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.durMin) || 0), 0),
    [items]
  );
  const warn =
    items.length > 0 &&
    Number.isFinite(+durBloque) &&
    totalMin > Number(durBloque);

  // ------- mutadores de lista
  const up = (idx) => {
    if (idx <= 0) return;
    const arr = [...items];
    const tmp = arr[idx - 1];
    arr[idx - 1] = arr[idx];
    arr[idx] = tmp;
    setItems(arr);
  };
  const down = (idx) => {
    if (idx >= items.length - 1) return;
    const arr = [...items];
    const tmp = arr[idx + 1];
    arr[idx + 1] = arr[idx];
    arr[idx] = tmp;
    setItems(arr);
  };
  const changeDur = (idx, v) => {
    const arr = [...items];
    arr[idx] = { ...arr[idx], durMin: Math.max(1, Number(v) || 1) };
    setItems(arr);
  };
  const changeTxt = (idx, v) => {
    const arr = [...items];
    arr[idx] = { ...arr[idx], texto: v };
    setItems(arr);
  };
  const addOA = () => {
    setItems([
      ...items,
      {
        id: `new-${Date.now()}`,
        texto: "",
        durMin: 10,
        done: false,
      },
    ]);
  };
  const removeOA = (idx) => {
    const arr = [...items];
    arr.splice(idx, 1);
    setItems(arr);
  };
  const resetDesdeCatalogo = () => {
    const baseDur =
      oaCat.length > 0 ? Math.max(5, Math.round(durBloque / oaCat.length)) : 10;
    setItems(
      oaCat.map((t, i) => ({
        id: `oa-${i + 1}`,
        texto: t,
        durMin: baseDur,
        done: false,
      }))
    );
  };

  // ------- acciones
  const guardarPlan = async () => {
    if (!uid) await ensureAuthUid();
    setSaving(true);
    setMsg("Guardando plan...");
    try {
      const payload = {
        planId,
        asigId,
        nivelId,
        unidadId,
        unidadNombre,
        items: items.map((it) => ({
          id: it.id,
          texto: it.texto,
          durMin: Number(it.durMin) || 0,
          done: false,
        })),
        meta: {
          asigNombre,
          nivelNombre,
          habilidades,
        },
        updatedAt: serverTimestamp(),
      };
      await setDoc(
        doc(db, "planes_clase", uid, "planes", planId),
        payload,
        { merge: true }
      );
      setMsg("✓ Plan guardado.");
      setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const aplicarEnSlot = async () => {
    if (!slot) {
      alert("No se recibió ?slot=fila-col en la URL.");
      return;
    }
    if (items.length === 0) {
      alert("Tu plan no tiene objetivos. Agrega al menos uno.");
      return;
    }
    try {
      setSaving(true);
      setMsg("Aplicando al slot...");

      const objetivoTxt = items[0]?.texto || "";
      const oaPlan = items.map((it, i) => ({
        idx: i,
        texto: it.texto,
        durMin: Number(it.durMin) || 0,
        done: false,
      }));

      // clases_detalle
      await setDoc(
        doc(db, "clases_detalle", uid, "slots", slot),
        {
          planId,
          asigId,
          asignaturaId: asigId,
          asignatura: asigNombre || asigId,
          nivel: nivelNombre || nivelId,
          nivelId,
          unidad: unidadNombre,
          unidadId,
          objetivo: objetivoTxt,
          habilidades: (habilidades || []).join("  "),
          oaPlan,
          oaIndex: 0,
          oaAppliedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // espejo liviano en horarios/.../celdas/{slot}
      await setDoc(
        doc(db, "horarios", uid, "celdas", slot),
        {
          planId,
          codUnidad: unidadId,
          asignaturaId: asigId,
          nivelId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMsg("✓ Plan aplicado al slot.");
      setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "1.25rem" }}>
        <h2>Planificador de Clase</h2>
        Cargando…
      </div>
    );
  }

  return (
    <div style={{ padding: "1.25rem", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={niceBtn("#475569")}
        >
          ← Volver
        </button>
        <h2 style={{ margin: 0 }}>Planificador de Clase</h2>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 6 }}>
          <b>Asignatura:</b> {asigNombre} &nbsp;·&nbsp; <b>Nivel:</b>{" "}
          {nivelNombre}
          <br />
          <b>Unidad:</b> {unidadNombre} ({unidadId})
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Plan ID</div>
            <input
              value={planId}
              onChange={(e) => setPlanId(toId(e.target.value))}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: ".4rem .6rem",
                minWidth: 260,
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Duración del bloque
            </div>
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: ".4rem .6rem",
                minWidth: 100,
              }}
            >
              {durBloque} min
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Duración total</div>
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: ".4rem .6rem",
                minWidth: 120,
                background: warn ? "#fff7ed" : "#f8fafc",
              }}
              title={
                warn
                  ? "La suma supera la duración del bloque"
                  : "OK dentro del bloque"
              }
            >
              {totalMin} min {warn ? " (⚠ supera el bloque)" : ""}
            </div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={guardarPlan}
              disabled={saving}
              style={niceBtn("#2563eb")}
              title="Guardar este plan"
            >
              Guardar plan
            </button>
            {slot && (
              <button
                onClick={aplicarEnSlot}
                disabled={saving}
                style={niceBtn("#059669")}
                title={`Aplicar al slot ${slot}`}
              >
                Aplicar al slot {slot}
              </button>
            )}
          </div>
        </div>
        {msg && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>
            {msg}
          </div>
        )}
      </div>

      <div style={{ ...box, overflowX: "auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0 }}>Objetivos de Aprendizaje</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={resetDesdeCatalogo}
              style={niceBtn("#7c3aed")}
              title="Recrear lista desde el catálogo"
            >
              Reset desde catálogo
            </button>
            <button
              onClick={addOA}
              style={niceBtn("#0ea5e9")}
              title="Agregar objetivo manual"
            >
              + Agregar OA
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ color: "#64748b" }}>
            No hay objetivos. Usa “Reset desde catálogo” o “+ Agregar OA”.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 720,
            }}
          >
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Objetivo</th>
                <th style={th}>Min</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td style={td}>{idx + 1}</td>
                  <td style={{ ...td, width: "100%" }}>
                    <textarea
                      value={it.texto}
                      onChange={(e) => changeTxt(idx, e.target.value)}
                      rows={3}
                      style={{
                        width: "100%",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: ".5rem .6rem",
                        resize: "vertical",
                      }}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      min={1}
                      value={it.durMin}
                      onChange={(e) => changeDur(idx, e.target.value)}
                      style={{
                        width: 80,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: ".35rem .5rem",
                      }}
                    />
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => up(idx)}
                        style={miniBtn}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => down(idx)}
                        style={miniBtn}
                        title="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeOA(idx)}
                        style={{ ...miniBtn, background: "#ef4444" }}
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td style={td}></td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                  Total
                </td>
                <td style={{ ...td, fontWeight: 700 }}>
                  {totalMin} min {warn ? " (⚠)" : ""}
                </td>
                <td style={td}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {habilidades?.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 14, color: "#475569", marginBottom: 6 }}>
            <b>Habilidades asociadas (catálogo):</b>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {habilidades.map((h, i) => (
              <span
                key={i}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== estilos tabla ====== */
const th = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: ".5rem .5rem",
  fontWeight: 700,
  fontSize: 13,
  color: "#334155",
};
const td = {
  borderBottom: "1px solid #f1f5f9",
  padding: ".5rem .5rem",
  verticalAlign: "top",
  fontSize: 14,
  color: "#0f172a",
};

const miniBtn = {
  border: "none",
  borderRadius: 6,
  background: "#2563eb",
  color: "#fff",
  padding: ".3rem .5rem",
  cursor: "pointer",
};
