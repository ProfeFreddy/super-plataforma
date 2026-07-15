// src/pages/DesarrolloClase.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import QRCode from "react-qr-code";

import { auth, db } from "../firebase";
import CronometroGlobal from "../components/CronometroGlobal";
import DesarrolloHeader from "../components/desarrollo/DesarrolloHeader";
import ConceptoClave from "../components/desarrollo/ConceptoClave";
import PracticaGuiada from "../components/desarrollo/PracticaGuiada";
import RecursosInteligentes from "../components/desarrollo/RecursosInteligentes";
import Visualizador3D from "../components/desarrollo/Visualizador3D";
import HerramientasProfesor from "../components/desarrollo/HerramientasProfesor";
import PanelParticipacion from "../components/desarrollo/PanelParticipacion";
import {
  claseEsValida,
  leerSesionClase,
  normalizeClase as normalizeClaseSesion,
} from "../services/ClaseActivaService";

const COLORS = {
  bg1: "#0891b2",
  bg2: "#67e8f9",
  ink: "#0f172a",
  muted: "#475569",
  card: "#ffffff",
  border: "#dbeafe",
  soft: "#f0f9ff",
};

const page = {
  minHeight: "100vh",
  background: `linear-gradient(135deg, ${COLORS.bg1}, ${COLORS.bg2})`,
  color: COLORS.ink,
  padding: "2rem",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const shell = { maxWidth: 1280, margin: "0 auto" };

const CLASE_KEY = "__pragmaClaseActual";
const BRIDGE_DESARROLLO_KEY = "bridge:desarrolloClase";
const BRIDGE_CIERRE_KEY = "bridge:cierreClase";

function clean(v, fallback = "") {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  if (/^\(sin /i.test(s)) return fallback;
  if (/^sin /i.test(s)) return fallback;
  if (/undefined|null/i.test(s)) return fallback;
  return s;
}

function isMissing(v) {
  const s = String(v ?? "").trim();
  return !s || /^\(sin /i.test(s) || /^sin /i.test(s) || /undefined|null/i.test(s);
}

function readJsonLS(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || null;
  } catch {
    return null;
  }
}

function writeJsonLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No bloquear la clase si el navegador limita storage.
  }
}

function makeSalaCode(seed) {
  try {
    const fromSeed = clean(seed, "");
    if (fromSeed) {
      localStorage.setItem("salaCode", fromSeed);
      return fromSeed;
    }

    const old =
      localStorage.getItem("salaCode") ||
      readJsonLS(CLASE_KEY)?.salaCode ||
      readJsonLS(BRIDGE_DESARROLLO_KEY)?.salaCode;

    if (old) return old;

    const code = String(Math.floor(10000 + Math.random() * 90000));
    localStorage.setItem("salaCode", code);
    return code;
  } catch {
    return "00000";
  }
}

function normalizeHabilidades(value, fallback = "Representar, Analizar, Argumentar") {
  if (Array.isArray(value)) {
    const arr = value.map((x) => clean(x, "")).filter(Boolean);
    return arr.length ? arr.join(", ") : fallback;
  }
  return clean(value, fallback);
}

function getClaseSources(location) {
  const state = location?.state || {};
  const sesion = leerSesionClase();

  // Fuente única del flujo:
  // 1) clase recibida desde InicioClase
  // 2) sesión activa persistida por ClaseActivaService
  // Nunca recuperar puentes antiguos ni clases de otros bloques.
  return [state.clase, sesion].filter(Boolean);
}

function firstValue(sources, keys, fallback = "") {
  for (const src of sources) {
    for (const key of keys) {
      const val = src?.[key];
      if (!isMissing(val)) return val;
    }
  }
  return fallback;
}

function buildClaseBase(location, user = null) {
  const sources = getClaseSources(location);

  const profesorFromSession =
    user?.displayName ||
    user?.providerData?.[0]?.displayName ||
    readJsonLS("profesorActual")?.nombre ||
    localStorage.getItem("nombre") ||
    "";

  const emailFromSession = user?.email || localStorage.getItem("email") || "";

  const profesor = clean(
    firstValue(sources, ["nombreProfesor", "profesor", "teacherName", "nombre"], profesorFromSession),
    "Profesor"
  );

  const institucion = clean(
    firstValue(sources, ["institucion", "colegio", "establecimiento"], ""),
    "Institución educativa"
  );

  const curso = clean(firstValue(sources, ["curso", "course"], ""), "Curso no definido");
  const asignatura = clean(firstValue(sources, ["asignatura", "subject"], ""), "Asignatura no definida");
  const unidad = clean(firstValue(sources, ["unidad", "unit", "unidadInicial"], ""), "Unidad no definida");
  const oa = clean(firstValue(sources, ["oa", "objetivoCurricular", "codigoOA"], ""), "OA no definido");

  const objetivo = clean(
    firstValue(sources, ["objetivoClase", "objetivo", "descripcionOA"], ""),
    "Objetivo de clase no definido."
  );

  const habilidades = normalizeHabilidades(
    firstValue(sources, ["habilidades", "skills"], ""),
    "Habilidades no definidas"
  );

  const slotId = clean(
    firstValue(sources, ["slotId", "slot"], location?.state?.slotId || localStorage.getItem("__lastSlotId")),
    "0-0"
  );

  const salaCode = makeSalaCode(firstValue(sources, ["salaCode", "code", "codigoSala"], ""));

  return {
    ...raw,
    profesor,
    nombreProfesor: profesor,
    emailProfesor: emailFromSession,
    institucion,
    asignatura,
    curso,
    unidad,
    oa,
    objetivo,
    objetivoClase: objetivo,
    habilidades,
    salaCode,
    slotId,
  };
}

function mergeProfesorReal(clase, data = {}) {
  const nombre =
    data.nombre ||
    data.nombreCompleto ||
    data.displayName ||
    data.nombreProfesor ||
    data.profesor ||
    "";

  const institucion =
    data.institucion ||
    data.colegio ||
    data.establecimiento ||
    data.school ||
    "";

  const asignatura = data.asignatura || data.especialidad || "";

  return {
    ...clase,
    profesor: !isMissing(nombre) ? clean(nombre, clase.profesor) : clase.profesor,
    nombreProfesor: !isMissing(nombre) ? clean(nombre, clase.nombreProfesor) : clase.nombreProfesor,
    institucion: !isMissing(institucion) ? clean(institucion, clase.institucion) : clase.institucion,
    asignatura: !isMissing(asignatura) && isMissing(clase.asignatura)
      ? clean(asignatura, clase.asignatura)
      : clase.asignatura,
  };
}

function normalizeClase(raw = {}) {
  const profesor = clean(raw.nombreProfesor || raw.profesor || raw.teacherName || raw.nombre, "Profesor");
  const objetivo = clean(raw.objetivoClase || raw.objetivo || raw.descripcionOA, "Objetivo de clase no definido.");

  return {
    profesor,
    nombreProfesor: profesor,
    emailProfesor: clean(raw.emailProfesor || raw.email, ""),
    institucion: clean(raw.institucion || raw.colegio || raw.establecimiento, "Institución educativa"),
    asignatura: clean(raw.asignatura || raw.subject, "Asignatura no definida"),
    curso: clean(raw.curso || raw.course, "Curso no definido"),
    unidad: clean(raw.unidad || raw.unit || raw.unidadInicial, "Unidad no definida"),
    oa: clean(raw.oa || raw.objetivoCurricular || raw.codigoOA, "OA no definido"),
    objetivo,
    objetivoClase: objetivo,
    habilidades: normalizeHabilidades(raw.habilidades || raw.skills, "Habilidades no definidas"),
    salaCode: clean(raw.salaCode || raw.code || raw.codigoSala, makeSalaCode()),
    slotId: clean(raw.slotId || raw.slot, "0-0"),
  };
}

function useAuthSafe() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(auth.currentUser || null);

  useEffect(() => {
    let alive = true;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;

      try {
        if (!u) {
          const cred = await signInAnonymously(auth);
          if (!alive) return;
          setUser(cred.user || null);
          if (cred.user?.uid) localStorage.setItem("uid", cred.user.uid);
        } else {
          setUser(u);
          if (u?.uid) localStorage.setItem("uid", u.uid);
          if (u?.email) localStorage.setItem("email", u.email);
          if (u?.displayName) localStorage.setItem("nombre", u.displayName);
        }
      } catch (err) {
        console.warn("[DesarrolloClase] Auth no disponible:", err?.message || err);
        setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    });

    const t = setTimeout(() => alive && setReady(true), 1800);

    return () => {
      alive = false;
      clearTimeout(t);
      unsub && unsub();
    };
  }, []);

  return { ready, user };
}

function InvalidClass({ onInicio }) {
  return (
    <main style={{ ...page, display: "grid", placeItems: "center" }}>
      <div style={{ ...cardBox(), maxWidth: 720, textAlign: "center" }}>
        <div style={{ fontSize: 54 }}>⛔</div>
        <h1>No hay una clase real activa</h1>
        <p style={{ color: COLORS.muted, fontSize: 18 }}>
          Desarrollo no cargará una clase antigua ni datos de otro bloque.
          Vuelve a InicioClase para usar la sesión vigente o entrar a SOLO DEMO.
        </p>
        <button
          type="button"
          onClick={onInicio}
          style={{
            border: 0,
            borderRadius: 16,
            padding: "14px 18px",
            background: "#0284c7",
            color: "white",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Volver a InicioClase
        </button>
      </div>
    </main>
  );
}

export default function DesarrolloClase({ duracion = 30, onIrACierre }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { ready, user } = useAuthSafe();

  const fuenteInicial = useMemo(
    () => location.state?.clase || leerSesionClase() || null,
    [location.key, location.state]
  );

  const [claseValida, setClaseValida] = useState(() =>
    claseEsValida(normalizeClaseSesion(fuenteInicial || {}))
  );

  const [clase, setClase] = useState(() =>
    normalizeClase(fuenteInicial || buildClaseBase(location, auth.currentUser))
  );
  const [conectados, setConectados] = useState(0);
  const [ultimoEnvio, setUltimoEnvio] = useState("");
  const [notaDocente, setNotaDocente] = useState("");
  const [saving, setSaving] = useState(false);

  const participaUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/#/sala/${clase.salaCode}`;
  }, [claseValida, clase.salaCode]);

  useEffect(() => {
    const fuente = location.state?.clase || leerSesionClase() || null;
    const valida = claseEsValida(normalizeClaseSesion(fuente || {}));

    setClaseValida(valida);

    if (!valida) return;

    setClase((prev) =>
      normalizeClase({
        ...prev,
        ...fuente,
      })
    );
  }, [location.key, location.state, user?.uid]);

  useEffect(() => {
    if (!claseValida || !ready || !user?.uid) return;

    let alive = true;

    (async () => {
      try {
        const refs = [
          doc(db, "profesores", user.uid),
          doc(db, "usuarios", user.uid),
          doc(db, "users", user.uid),
        ];

        for (const ref of refs) {
          const snap = await getDoc(ref);
          if (!alive || !snap.exists()) continue;

          const data = snap.data() || {};
          setClase((prev) => normalizeClase(mergeProfesorReal(prev, data)));
        }
      } catch (err) {
        console.warn("[DesarrolloClase] perfil profesor:", err?.code || err?.message || err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [claseValida, ready, user?.uid]);

  useEffect(() => {
    if (!claseValida) return;

    const payload = {
      ...clase,
      fase: "desarrollo",
      ts: Date.now(),
      from: "desarrollo",
    };

    writeJsonLS(CLASE_KEY, clase);
    writeJsonLS(BRIDGE_DESARROLLO_KEY, payload);

    try {
      localStorage.setItem("salaCode", clase.salaCode);
      localStorage.setItem("__lastSlotId", clase.slotId);
    } catch {
      // noop
    }
  }, [claseValida, clase]);

  useEffect(() => {
    if (!claseValida || !ready || clase.soloDemo) return;

    const uid = user?.uid || localStorage.getItem("uid");
    if (!uid) return;

    const ref = doc(db, "clases_detalle", uid, "meta", "desarrollo");
    setDoc(
      ref,
      {
        ...clase,
        fase: "desarrollo",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => console.warn("[DesarrolloClase] guardar desarrollo:", err?.message || err));
  }, [claseValida, ready, user?.uid, clase]);

  useEffect(() => {
    if (!claseValida || !clase.salaCode) return undefined;

    const salaRef = doc(db, "salas", clase.salaCode);
    const unsub = onSnapshot(
      salaRef,
      (snap) => {
        const d = snap.exists() ? snap.data() || {} : {};
        const n = d.conectados || d.connected || d.participantes || 0;
        setConectados(typeof n === "number" ? n : 0);

        const ult = d.ultimoEnvio || d.lastWord || d.ultimaPalabra || "";
        if (ult) setUltimoEnvio(String(ult));
      },
      () => {}
    );

    return () => unsub && unsub();
  }, [clase.salaCode]);

  const guardarEvidencia = async () => {
    if (!claseValida || clase.soloDemo) return;

    setSaving(true);

    try {
      const uid = user?.uid || localStorage.getItem("uid") || "anon";
      const id = `${Date.now()}`;

      await setDoc(doc(db, "evidencias", uid, "items", id), {
        tipo: "desarrollo_clase",
        clase,
        notaDocente,
        conectados,
        ultimoEnvio,
        createdAt: serverTimestamp(),
      });

      alert("Evidencia guardada ✅");
    } catch (err) {
      console.warn(err);
      alert("No pude guardar la evidencia, pero la clase sigue funcionando.");
    } finally {
      setSaving(false);
    }
  };

  const irACierre = () => {
    if (!claseValida) return;

    const payload = {
      ...clase,
      fase: "cierre",
      ts: Date.now(),
      from: "desarrollo",
    };

    writeJsonLS(CLASE_KEY, clase);
    writeJsonLS(BRIDGE_CIERRE_KEY, payload);

    if (typeof onIrACierre === "function") {
      onIrACierre();
      return;
    }

    navigate("/cierre", { state: { from: "desarrollo", clase } });
  };

  const abrirGincana = () => {
    try {
      const url = new URL("https://juego.pragmaprofe.com/#/home");
      url.searchParams.set("code", clase.salaCode);
      url.searchParams.set("curso", clase.curso);
      url.searchParams.set("asignatura", clase.asignatura);
      url.searchParams.set("unidad", clase.unidad);
      url.searchParams.set("oa", clase.oa);
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      window.open("https://juego.pragmaprofe.com/#/home", "_blank", "noopener,noreferrer");
    }
  };

  if (!claseValida) {
    return <InvalidClass onInicio={() => navigate("/InicioClase")} />;
  }

  return (
    <div style={page}>
      <div style={shell}>
        {clase.soloDemo ? (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 16,
              padding: 14,
              background: "#7c3aed",
              color: "white",
              fontWeight: 950,
              textAlign: "center",
            }}
          >
            🧪 SOLO DEMO · Esta sesión no modifica planificación ni evidencias reales
          </div>
        ) : null}
        <DesarrolloHeader
          clase={clase}
          fase="desarrollo"
          rightSlot={
            <div style={{ display: "grid", gap: 14 }}>
              <div style={cardBox()}>
                <div style={{ fontWeight: 900, color: COLORS.muted, textAlign: "center" }}>
                  ⏱️ Cronómetro de trabajo
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                  <CronometroGlobal
                    duracion={duracion}
                    storageKey={`pragma-desarrollo:${clase.slotId}`}
                    instanceId={`desarrollo:${clase.slotId}`}
                  />
                </div>
              </div>

              <div style={cardBox()}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>📲 QR de participación</div>
                <div
                  style={{
                    background: "#fff",
                    padding: 12,
                    borderRadius: 16,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <QRCode value={participaUrl} size={170} />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.muted,
                    wordBreak: "break-all",
                    marginTop: 8,
                  }}
                >
                  {participaUrl}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <MiniStat label="Conectados" value={conectados} />
                  <MiniStat label="Sala" value={clase.salaCode} />
                </div>
              </div>
            </div>
          }
        />

        <main
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, .9fr)",
            gap: 18,
            marginTop: 18,
          }}
        >
          <section style={{ display: "grid", gap: 18 }}>
            <ConceptoClave clase={clase} />
            <PracticaGuiada clase={clase} />
            <Visualizador3D clase={clase} />
            <RecursosInteligentes clase={clase} />
          </section>

          <aside style={{ display: "grid", gap: 18, alignContent: "start" }}>
            <PanelParticipacion
              clase={clase}
              conectados={conectados}
              ultimoEnvio={ultimoEnvio}
              notaDocente={notaDocente}
              setNotaDocente={setNotaDocente}
            />

            <HerramientasProfesor
              clase={clase}
              onGuardarEvidencia={guardarEvidencia}
              saving={saving}
              onGincana={abrirGincana}
              onCierre={irACierre}
            />
          </aside>
        </main>
      </div>
    </div>
  );
}

function cardBox(extra = {}) {
  return {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 24,
    boxShadow: "0 18px 38px rgba(15, 23, 42, .10)",
    padding: 18,
    ...extra,
  };
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 10,
        textAlign: "center",
        background: COLORS.soft,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 950 }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 800 }}>{label}</div>
    </div>
  );
}
