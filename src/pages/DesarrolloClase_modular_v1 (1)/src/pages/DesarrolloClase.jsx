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

const COLORS = {
  bg1: "#0891b2",
  bg2: "#67e8f9",
  ink: "#0f172a",
  muted: "#475569",
  card: "#ffffff",
  border: "#dbeafe",
  soft: "#f0f9ff",
  accent: "#0284c7",
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
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

function makeSalaCode() {
  try {
    const old = localStorage.getItem("salaCode");
    if (old) return old;
    const code = String(Math.floor(10000 + Math.random() * 90000));
    localStorage.setItem("salaCode", code);
    return code;
  } catch {
    return "00000";
  }
}

function readJsonLS(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || null;
  } catch {
    return null;
  }
}

function getInitialClase(location) {
  const fromState = location?.state?.clase || location?.state?.specialData || null;
  const pragma = readJsonLS("__pragmaClaseActual");
  const bridge = readJsonLS("bridge:desarrolloClase");
  return fromState || pragma || bridge || {};
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
          try { if (cred.user?.uid) localStorage.setItem("uid", cred.user.uid); } catch {}
        } else {
          setUser(u);
          try { if (u?.uid) localStorage.setItem("uid", u.uid); } catch {}
        }
      } catch (err) {
        console.warn("[DesarrolloClase] Auth anónima no disponible:", err?.message || err);
        setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    });
    const t = setTimeout(() => alive && setReady(true), 1800);
    return () => { alive = false; clearTimeout(t); unsub && unsub(); };
  }, []);

  return { ready, user };
}

export default function DesarrolloClase({ duracion = 30, onIrACierre }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { ready, user } = useAuthSafe();
  const initial = useMemo(() => getInitialClase(location), [location]);

  const [profesor, setProfesor] = useState(
    clean(initial.nombreProfesor || initial.profesor || initial.nombre, "Profesor")
  );
  const [institucion, setInstitucion] = useState(
    clean(initial.institucion || initial.colegio || initial.establecimiento, "Liceo Presidente Balmaceda")
  );
  const [asignatura, setAsignatura] = useState(clean(initial.asignatura, "Matemática"));
  const [curso, setCurso] = useState(clean(initial.curso, "2° Medio B"));
  const [unidad, setUnidad] = useState(clean(initial.unidad, "Unidad"));
  const [oa, setOA] = useState(clean(initial.oa || initial.objetivoCurricular, "OA"));
  const [objetivo, setObjetivo] = useState(
    clean(initial.objetivoClase || initial.objetivo, "Comprender y aplicar el objetivo de la clase mediante actividades guiadas.")
  );
  const [habilidades, setHabilidades] = useState(
    Array.isArray(initial.habilidades)
      ? initial.habilidades.join(", ")
      : clean(initial.habilidades, "Representar, Analizar, Argumentar")
  );
  const [salaCode, setSalaCode] = useState(() => makeSalaCode());
  const [conectados, setConectados] = useState(0);
  const [ultimoEnvio, setUltimoEnvio] = useState("");
  const [notaDocente, setNotaDocente] = useState("");
  const [saving, setSaving] = useState(false);

  const slotId = useMemo(() => {
    return clean(location?.state?.slotId || localStorage.getItem("__lastSlotId"), "0-0");
  }, [location]);

  const participaUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/#/sala/${salaCode}`;
  }, [salaCode]);

  const clase = useMemo(() => ({
    profesor,
    nombreProfesor: profesor,
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
  }), [profesor, institucion, asignatura, curso, unidad, oa, objetivo, habilidades, salaCode, slotId]);

  useEffect(() => {
    const stored = getInitialClase(location);
    if (!stored) return;
    if (!isMissing(stored.nombreProfesor || stored.profesor || stored.nombre)) setProfesor(clean(stored.nombreProfesor || stored.profesor || stored.nombre, profesor));
    if (!isMissing(stored.institucion || stored.colegio || stored.establecimiento)) setInstitucion(clean(stored.institucion || stored.colegio || stored.establecimiento, institucion));
    if (!isMissing(stored.asignatura)) setAsignatura(clean(stored.asignatura, asignatura));
    if (!isMissing(stored.curso)) setCurso(clean(stored.curso, curso));
    if (!isMissing(stored.unidad)) setUnidad(clean(stored.unidad, unidad));
    if (!isMissing(stored.oa || stored.objetivoCurricular)) setOA(clean(stored.oa || stored.objetivoCurricular, oa));
    if (!isMissing(stored.objetivoClase || stored.objetivo)) setObjetivo(clean(stored.objetivoClase || stored.objetivo, objetivo));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (!ready) return;
    const uid = user?.uid || localStorage.getItem("uid");
    if (!uid) return;

    let alive = true;
    (async () => {
      try {
        const refs = [
          doc(db, "profesores", uid),
          doc(db, "usuarios", uid),
          doc(db, "clases_detalle", uid, "meta", "actual"),
          doc(db, "clases_detalle", uid, "actual", "info"),
        ];
        for (const ref of refs) {
          const snap = await getDoc(ref);
          if (!alive || !snap.exists()) continue;
          const d = snap.data() || {};
          if (!isMissing(d.nombre || d.nombreProfesor || d.profesor)) setProfesor(clean(d.nombre || d.nombreProfesor || d.profesor, profesor));
          if (!isMissing(d.institucion || d.colegio || d.establecimiento)) setInstitucion(clean(d.institucion || d.colegio || d.establecimiento, institucion));
          if (!isMissing(d.asignatura)) setAsignatura(clean(d.asignatura, asignatura));
          if (!isMissing(d.curso)) setCurso(clean(d.curso, curso));
          if (!isMissing(d.unidad || d.unidadInicial)) setUnidad(clean(d.unidad || d.unidadInicial, unidad));
          if (!isMissing(d.oa || d.objetivoCurricular)) setOA(clean(d.oa || d.objetivoCurricular, oa));
          if (!isMissing(d.objetivoClase || d.objetivo)) setObjetivo(clean(d.objetivoClase || d.objetivo, objetivo));
          if (!isMissing(d.habilidades)) setHabilidades(Array.isArray(d.habilidades) ? d.habilidades.join(", ") : d.habilidades);
        }
      } catch (err) {
        console.warn("[DesarrolloClase] fallback Firestore:", err?.code || err?.message || err);
      }
    })();

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.uid]);

  useEffect(() => {
    try {
      localStorage.setItem("__pragmaClaseActual", JSON.stringify(clase));
      localStorage.setItem("bridge:desarrolloClase", JSON.stringify({ ...clase, ts: Date.now(), from: "desarrollo" }));
      localStorage.setItem("salaCode", salaCode);
    } catch {}
  }, [clase, salaCode]);

  useEffect(() => {
    if (!ready) return;
    const uid = user?.uid || localStorage.getItem("uid");
    if (!uid) return;
    const ref = doc(db, "clases_detalle", uid, "meta", "desarrollo");
    setDoc(ref, { ...clase, fase: "desarrollo", updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [ready, user?.uid, clase]);

  useEffect(() => {
    if (!salaCode) return undefined;
    const salaRef = doc(db, "salas", salaCode);
    const unsub = onSnapshot(salaRef, (snap) => {
      const d = snap.exists() ? snap.data() || {} : {};
      const n = d.conectados || d.connected || d.participantes || 0;
      setConectados(typeof n === "number" ? n : 0);
      const ult = d.ultimoEnvio || d.lastWord || d.ultimaPalabra || "";
      if (ult) setUltimoEnvio(String(ult));
    }, () => {});
    return () => unsub && unsub();
  }, [salaCode]);

  const guardarEvidencia = async () => {
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
    try {
      localStorage.setItem("bridge:cierreClase", JSON.stringify({ ...clase, ts: Date.now(), from: "desarrollo" }));
    } catch {}
    if (typeof onIrACierre === "function") onIrACierre();
    else navigate("/cierre", { state: { from: "desarrollo", clase } });
  };

  const abrirGincana = () => {
    try {
      const base = `${window.location.origin}/#/gincana`;
      const url = `${base}?code=${encodeURIComponent(salaCode)}&asignatura=${encodeURIComponent(asignatura)}&curso=${encodeURIComponent(curso)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      navigate("/gincana");
    }
  };

  return (
    <div style={page}>
      <div style={shell}>
        <DesarrolloHeader
          clase={clase}
          fase="desarrollo"
          rightSlot={
            <div style={{ display: "grid", gap: 14 }}>
              <div style={cardBox()}>
                <div style={{ fontWeight: 900, color: COLORS.muted, textAlign: "center" }}>⏱️ Cronómetro de trabajo</div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                  <CronometroGlobal duracion={duracion} storageKey={`pragma-desarrollo:${slotId}`} instanceId={`desarrollo:${slotId}`} />
                </div>
              </div>
              <div style={cardBox()}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>📲 QR de participación</div>
                <div style={{ background: "#fff", padding: 12, borderRadius: 16, display: "flex", justifyContent: "center" }}>
                  <QRCode value={participaUrl} size={170} />
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, wordBreak: "break-all", marginTop: 8 }}>{participaUrl}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <MiniStat label="Conectados" value={conectados} />
                  <MiniStat label="Sala" value={salaCode} />
                </div>
              </div>
            </div>
          }
        />

        <main style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, .9fr)", gap: 18, marginTop: 18 }}>
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
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 10, textAlign: "center", background: COLORS.soft }}>
      <div style={{ fontSize: 22, fontWeight: 950 }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 800 }}>{label}</div>
    </div>
  );
}
