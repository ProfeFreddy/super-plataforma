// src/pages/OnboardingExpress.jsx
// Onboarding en 3 pasos: asignatura → niveles → unidad actual
// Al terminar: guarda perfil inicial y envía al profesor a configurar su horario real.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ── Constantes ── */
const ASIGNATURAS = [
  "Matemática",
  "Lenguaje",
  "Historia",
  "Física",
  "Química",
  "Biología",
  "Inglés",
  "Ciencias",
  "Tecnología",
  "Ed. Física",
  "Artes",
  "Música",
  "Filosofía",
  "Psicología",
  "Orientación",
  "Otro",
];

const NIVELES = [
  "7º Básico",
  "8º Básico",
  "1º Medio",
  "2º Medio",
  "3º Medio",
  "4º Medio",
];

// Normalizar nivel para buscar en curriculo. Ej: "3º Medio" → "3° medio"
function normNivel(nivel = "") {
  return String(nivel || "")
    .replace(/º/g, "°")
    .replace(/Básico/g, "básico")
    .replace(/Medio/g, "medio")
    .toLowerCase()
    .trim();
}

// Obtener asignaturaId para curriculo
function getAsigId(asig = "") {
  const MAP = {
    Matemática: "matematica",
    Lenguaje: "lenguaje",
    Historia: "historia",
    Física: "fisica",
    Química: "quimica",
    Biología: "biologia",
    Inglés: "ingles",
    Ciencias: "ciencias",
    Tecnología: "tecnologia",
    "Ed. Física": "edfisica",
  };

  return (
    MAP[asig] ||
    String(asig || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim()
  );
}

async function fetchUnidades(asignatura, nivel) {
  if (!asignatura || !nivel) return [];

  try {
    const asigId = getAsigId(asignatura);
    const nivelRaw = normNivel(nivel);

    const q1 = query(
      collection(db, "curriculo"),
      where("asignaturaId", "==", asigId),
      where("nivel", "==", nivelRaw)
    );

    const snap = await getDocs(q1);

    if (!snap.empty) {
      return snap.docs
        .map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            titulo: data.titulo || data.nombre || d.id,
            codUnidad: data.codUnidad || d.id,
            objetivo: Array.isArray(data.objetivos) ? data.objetivos[0] || "" : data.objetivo || "",
            habilidades: Array.isArray(data.habilidades) ? data.habilidades : [],
          };
        })
        .sort((a, b) => String(a.codUnidad).localeCompare(String(b.codUnidad)));
    }

    // Fallback: busca por asignatura y filtra nivel manualmente
    const q2 = query(collection(db, "curriculo"), where("asignaturaId", "==", asigId));
    const snap2 = await getDocs(q2);
    const nivelBase = String(nivel || "")
      .replace(/[°º]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim();

    return snap2.docs
      .filter((d) => {
        const data = d.data() || {};
        const n = String(data.nivel || "")
          .replace(/[°º]/g, "")
          .replace(/\s+/g, " ")
          .toLowerCase()
          .trim();
        return n === nivelBase || n.includes(nivelBase) || nivelBase.includes(n);
      })
      .map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          titulo: data.titulo || data.nombre || d.id,
          codUnidad: data.codUnidad || d.id,
          objetivo: Array.isArray(data.objetivos) ? data.objetivos[0] || "" : data.objetivo || "",
          habilidades: Array.isArray(data.habilidades) ? data.habilidades : [],
        };
      })
      .sort((a, b) => String(a.codUnidad).localeCompare(String(b.codUnidad)));
  } catch (e) {
    console.warn("[fetchUnidades]", e?.message || e);
    return [];
  }
}

/* ── Estilos ── */
const C = {
  bg: "radial-gradient(1200px 600px at 20% -10%, #7dd3fc22, transparent), radial-gradient(1000px 500px at 110% 10%, #a7f3d022, transparent), #f8fafc",
  brand: "#2193b0",
  brandDark: "#0e7490",
  green: "#10b981",
  white: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e5e7eb",
  soft: "#f8fafc",
};

const s = {
  wrap: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    background: C.bg,
    padding: 16,
    fontFamily: "Segoe UI, system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 620,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    padding: 28,
    boxShadow: "0 24px 70px rgba(2,6,23,.12)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  badge: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "#ecfeff",
    color: C.brandDark,
    fontWeight: 950,
    fontSize: 13,
  },
  h1: {
    margin: "0 0 6px",
    fontSize: "clamp(25px, 4vw, 34px)",
    color: C.text,
    fontWeight: 950,
    letterSpacing: "-.6px",
    lineHeight: 1.08,
  },
  sub: {
    margin: "0 0 22px",
    color: C.muted,
    fontSize: 15,
    lineHeight: 1.5,
  },
  label: {
    fontSize: 12,
    fontWeight: 900,
    color: C.muted,
    marginBottom: 8,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  btn: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: "none",
    background: C.brand,
    color: C.white,
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
    marginTop: 8,
    boxShadow: "0 14px 30px rgba(33,147,176,.18)",
  },
  btnGreen: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg,#10b981,#06b6d4)",
    color: C.white,
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
    marginTop: 8,
    boxShadow: "0 14px 30px rgba(16,185,129,.18)",
  },
  chip: (selected) => ({
    padding: "9px 14px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 850,
    cursor: "pointer",
    border: `2px solid ${selected ? C.brand : C.border}`,
    background: selected ? "#ecfeff" : C.white,
    color: selected ? C.brandDark : C.muted,
    transition: "all .15s",
    userSelect: "none",
  }),
  progress: (pct) => ({
    height: 7,
    borderRadius: 999,
    background: `linear-gradient(to right, ${C.brand} ${pct}%, #e5e7eb ${pct}%)`,
    marginBottom: 22,
  }),
  unidadCard: (selected) => ({
    padding: "12px 14px",
    borderRadius: 14,
    border: `2px solid ${selected ? C.brand : C.border}`,
    background: selected ? "#ecfeff" : C.white,
    cursor: "pointer",
    marginBottom: 9,
    transition: "all .15s",
  }),
  infoBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #bae6fd",
    background: "#f0f9ff",
    color: "#075985",
    fontSize: 13,
    lineHeight: 1.45,
  },
  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "9px 12px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 10,
  },
};

export default function OnboardingExpress() {
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [nombre, setNombre] = useState("");
  const [paso, setPaso] = useState(1);

  const [asignatura, setAsignatura] = useState("");
  const [nivelesSeleccionados, setNivelesSeleccionados] = useState([]);
  const [unidadesPorNivel, setUnidadesPorNivel] = useState({});
  const [unidadSeleccionada, setUnidadSeleccionada] = useState({});
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/registro", { replace: true });
        return;
      }

      setUid(u.uid);

      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        const data = snap.exists() ? snap.data() || {} : {};

        if (data?.nombre) setNombre(data.nombre);
        else if (u.displayName) setNombre(u.displayName);

        if (data?.asignatura) setAsignatura(data.asignatura);
        if (Array.isArray(data?.nivelesAsignados)) setNivelesSeleccionados(data.nivelesAsignados);

        if (data?.unidadActualPorNivel && typeof data.unidadActualPorNivel === "object") {
          const inicial = {};
          Object.entries(data.unidadActualPorNivel).forEach(([nivel, unidad]) => {
            inicial[nivel] = unidad?.codUnidad || unidad?.id || unidad?.titulo || "";
          });
          setUnidadSeleccionada(inicial);
        }
      } catch (e) {
        console.warn("[OnboardingExpress] cargar perfil:", e?.message || e);
      }
    });

    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (paso !== 3 || !asignatura || nivelesSeleccionados.length === 0) return;

    let stop = false;
    setLoadingUnidades(true);

    Promise.all(
      nivelesSeleccionados.map((nivel) =>
        fetchUnidades(asignatura, nivel).then((unidades) => ({ nivel, unidades }))
      )
    )
      .then((results) => {
        if (stop) return;
        const map = {};
        results.forEach((r) => {
          map[r.nivel] = r.unidades;
        });
        setUnidadesPorNivel(map);
      })
      .finally(() => {
        if (!stop) setLoadingUnidades(false);
      });

    return () => {
      stop = true;
    };
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
  const puedeAvanzar1 = !!asignatura;
  const puedeAvanzar2 = nivelesSeleccionados.length > 0;
  const puedeFinalizar = nivelesSeleccionados.every((n) => {
    const unidades = unidadesPorNivel[n] || [];
    return unidades.length === 0 || !!unidadSeleccionada[n];
  });

  async function finalizar() {
    if (!uid || saving) return;

    setSaving(true);
    setError("");

    try {
      const unidadActualPorNivel = {};

      nivelesSeleccionados.forEach((nivel) => {
        const unidades = unidadesPorNivel[nivel] || [];
        const codUnidad = unidadSeleccionada[nivel] || "";
        const unidadObj = unidades.find((u) => u.codUnidad === codUnidad || u.id === codUnidad) || null;

        unidadActualPorNivel[nivel] = {
          codUnidad: unidadObj?.codUnidad || codUnidad || "",
          titulo: unidadObj?.titulo || "",
          objetivo: unidadObj?.objetivo || "",
          habilidades: Array.isArray(unidadObj?.habilidades) ? unidadObj.habilidades : [],
        };
      });

      const payload = {
        asignatura,
        asignaturaId: getAsigId(asignatura),
        asignaturasPermitidas: [getAsigId(asignatura)],
        nivelesAsignados: nivelesSeleccionados,
        unidadActualPorNivel,
        onboarding: {
          fase: "horario_pendiente",
          completado: false,
          siguientePaso: "horario",
          ts: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "usuarios", uid), payload, { merge: true });

      await setDoc(
        doc(db, "profesores", uid),
        {
          asignatura,
          asignaturaId: getAsigId(asignatura),
          nivelesAsignados: nivelesSeleccionados,
          unidadActualPorNivel,
          onboarding: {
            fase: "horario_pendiente",
            siguientePaso: "horario",
            ts: serverTimestamp(),
          },
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem("forceHorarioOnce", "1");
        localStorage.setItem("onboarding:fromRegistro", "1");
        localStorage.setItem("onboarding:showTrialBanner", "1");
        localStorage.setItem("onboarding:asignatura", asignatura);
        localStorage.setItem("onboarding:niveles", JSON.stringify(nivelesSeleccionados));
        localStorage.setItem("onboarding:unidadActualPorNivel", JSON.stringify(unidadActualPorNivel));
      } catch {}

      navigate("/horario", {
        replace: true,
        state: {
          fromOnboarding: true,
          asignatura,
          nivelesSeleccionados,
          unidadActualPorNivel,
        },
      });
    } catch (e) {
      console.error("[OnboardingExpress] finalizar:", e);
      setError("No se pudo guardar esta configuración inicial. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.top}>
          <div style={s.badge}>Configuración inicial</div>
          <div style={{ color: C.muted, fontWeight: 800, fontSize: 13 }}>Paso {paso} de 3</div>
        </div>

        <div style={s.progress(progreso)} />

        {paso === 1 && (
          <>
            <h1 style={s.h1}>👋 Hola{nombre ? `, ${String(nombre).split(" ")[0]}` : ""}</h1>
            <p style={s.sub}>
              Primero configuramos tu perfil docente. Después crearás tu horario real bloque por bloque.
            </p>

            <label style={s.label}>¿Qué asignatura enseñas principalmente?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {ASIGNATURAS.map((a) => (
                <div key={a} style={s.chip(asignatura === a)} onClick={() => setAsignatura(a)}>
                  {a}
                </div>
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

        {paso === 2 && (
          <>
            <h1 style={s.h1}>📚 ¿Qué niveles tienes?</h1>
            <p style={s.sub}>
              Selecciona los niveles donde haces {asignatura}. Esto ayudará a preparar currículo y unidades.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {NIVELES.map((n) => (
                <div key={n} style={s.chip(nivelesSeleccionados.includes(n))} onClick={() => toggleNivel(n)}>
                  {n}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...s.btn, background: "#e5e7eb", color: "#475569", flex: 1 }} onClick={() => setPaso(1)}>
                ← Atrás
              </button>
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

        {paso === 3 && (
          <>
            <h1 style={s.h1}>🎯 ¿En qué unidad estás ahora?</h1>
            <p style={s.sub}>
              Esta información será una base inicial. Luego podrás ajustar cada bloque desde tu horario.
            </p>

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
                    <label style={{ ...s.label, color: C.brandDark }}>{nivel}</label>

                    {unidades.length === 0 ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#92400e",
                          padding: "10px 12px",
                          background: "#fef3c7",
                          borderRadius: 10,
                          lineHeight: 1.4,
                        }}
                      >
                        No encontré unidades para este nivel. No pasa nada: podrás escribirlas manualmente en Horario.
                      </div>
                    ) : (
                      unidades.map((u) => (
                        <div
                          key={u.codUnidad || u.id}
                          style={s.unidadCard(seleccionada === u.codUnidad)}
                          onClick={() => selectUnidad(nivel, u.codUnidad)}
                        >
                          <div style={{ fontWeight: 850, fontSize: 14, color: seleccionada === u.codUnidad ? C.brandDark : C.text }}>
                            {seleccionada === u.codUnidad ? "✓ " : ""}
                            {u.titulo}
                          </div>
                          {u.objetivo && (
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                              {u.objetivo.slice(0, 110)}
                              {u.objetivo.length > 110 ? "…" : ""}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })
            )}

            {error && <div style={s.error}>{error}</div>}

            <div style={s.infoBox}>
              Al continuar no se creará un horario automático. Pasarás a la pantalla de Horario para construir tu semana real.
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={{ ...s.btn, background: "#e5e7eb", color: "#475569", flex: 1 }} onClick={() => setPaso(2)}>
                ← Atrás
              </button>
              <button
                style={{ ...s.btnGreen, opacity: puedeFinalizar && !saving ? 1 : 0.5, flex: 2 }}
                disabled={!puedeFinalizar || saving}
                onClick={finalizar}
              >
                {saving ? "Guardando…" : "🕒 Configurar mi horario"}
              </button>
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
          {[1, 2, 3].map((p) => (
            <div
              key={p}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: paso >= p ? C.brand : C.border,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
