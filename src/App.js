// Super Plataforma Educativa

import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AnimatePresence, motion } from "framer-motion";

function App() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [logueado, setLogueado] = useState(false);
  const [registroActivo, setRegistroActivo] = useState(false);
  const [uid, setUid] = useState(null);
  const [contenidoDelDia, setContenidoDelDia] = useState(null);
  const [respuestaMentimeter, setRespuestaMentimeter] = useState("");
  const [respuestasMentimeter, setRespuestasMentimeter] = useState([]);
  const [mostrarInicio, setMostrarInicio] = useState(true);
  const [mostrarDesarrollo, setMostrarDesarrollo] = useState(false);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [mensajeToast, setMensajeToast] = useState("");
  const [mostrarMensajeFinal, setMostrarMensajeFinal] = useState(false);

  const contenidoInicial = {
    "2025-03-10": "Unidad 1: Números racionales y sus representaciones - 1.1 Comparación, orden y estimación.",
    "2025-03-11": "Unidad 1: Operaciones con fracciones - 1.2 Suma, resta, multiplicación y división.",
    "2025-03-12": "Unidad 1: Aplicaciones de fracciones - 1.3 Problemas en contextos reales.",
    "2025-03-13": "Unidad 1: Números decimales - 1.4 Lectura, escritura y operaciones.",
    "2025-03-14": "Unidad 2: Proporcionalidad - 2.1 Razones y proporciones en contextos reales."
  };

  const guardarPlanificacionEnFirebase = async () => {
    try {
      const ref = doc(db, "profesores", uid);
      await setDoc(ref, { ...registro, planificacion }, { merge: true });
      setMensajeToast("✅ Planificación guardada exitosamente");
      setTimeout(() => setMensajeToast(""), 3000);
    } catch (error) {
      console.error("Error al guardar planificación:", error);
      alert("Error al guardar planificación: " + error.message);
    }
  };

  const [registro, setRegistro] = useState({
    nombre: "",
    rut: "",
    colegio: "",
    correo: "",
    asignaturas: "",
    niveles: "",
    pais: "",
    telefono: "",
    fechasImportantes: "",
    horario: Array(6).fill(null).map(() => Array(10).fill("")),
    planificacion: contenidoInicial
  });

  const [planificacion, setPlanificacion] = useState(contenidoInicial);
  const [contador, setContador] = useState(600);

  useEffect(() => {
    const checkSession = async () => {
      const storedUid = localStorage.getItem("uid");
      if (storedUid) {
        try {
          const docSnap = await getDoc(doc(db, "profesores", storedUid));
          setUid(storedUid);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setRegistro(data);
            setPlanificacion(data.planificacion || contenidoInicial);
          } else {
            setRegistro(prev => ({ ...prev, planificacion: contenidoInicial }));
            setPlanificacion(contenidoInicial);
          }
          setLogueado(true);
        } catch (error) {
          setLogueado(false);
        }
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!logueado || !uid || !planificacion || Object.keys(planificacion).length === 0) return;
    const ahora = new Date();
    const fechaISO = ahora.toISOString().split("T")[0];
    const contenido = planificacion[fechaISO];
    setContenidoDelDia(contenido || "Unidad por definir - Objetivo por definir");
    cargarRespuestasMentimeter();
  }, [logueado, planificacion, uid]);

  useEffect(() => {
    if (!logueado) return;
    const intervalo = setInterval(() => {
      setContador(prev => {
        if (prev === 180) setMostrarMensajeFinal(true);
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(intervalo);
  }, [logueado]);

  const login = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, usuario, clave);
      const id = userCredential.user.uid;
      localStorage.setItem("uid", id);
      const docSnap = await getDoc(doc(db, "profesores", id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRegistro(data);
        setUid(id);
        setPlanificacion(data.planificacion || contenidoInicial);
        setLogueado(true);
      }
    } catch (error) {
      alert("Error al iniciar sesión: " + error.message);
    }
  };

  const guardarRespuestaMentimeter = async () => {
    if (!respuestaMentimeter.trim()) return;
    try {
      await addDoc(collection(db, "mentimeter", uid, "respuestas"), {
        fecha: new Date().toISOString(),
        respuesta: respuestaMentimeter
      });
      setRespuestaMentimeter("");
      cargarRespuestasMentimeter();
    } catch (error) {
      console.error("Error al guardar respuesta:", error);
    }
  };

  const cargarRespuestasMentimeter = async () => {
    try {
      const snap = await getDocs(collection(db, "mentimeter", uid, "respuestas"));
      const datos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRespuestasMentimeter(datos);
    } catch (error) {
      console.error("Error al obtener respuestas:", error);
    }
  };

  const formatoTiempo = (s) => {
    const min = String(Math.floor(s / 60)).padStart(2, '0');
    const seg = String(s % 60).padStart(2, '0');
    return `${min}:${seg}`;
  };

  const contenidoAnimado = (contenido) => (
    <AnimatePresence mode="wait">
      <motion.div
        key={contenido}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -30 }}
        transition={{ duration: 0.5 }}>
        {contenido}
      </motion.div>
    </AnimatePresence>
  );

  if (!logueado) {
    return (
      <div style={{ padding: "2rem", fontFamily: "'Segoe UI', sans-serif" }}>
        <h2>🔐 Iniciar Sesión</h2>
        <input type="email" placeholder="Correo" value={usuario} onChange={(e) => setUsuario(e.target.value)} style={{ display: "block", marginBottom: "1rem", padding: "0.5rem", width: "100%" }} />
        <input type="password" placeholder="Contraseña" value={clave} onChange={(e) => setClave(e.target.value)} style={{ display: "block", marginBottom: "1rem", padding: "0.5rem", width: "100%" }} />
        <button onClick={login} style={{ background: "#00796b", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "5px" }}>Acceder</button>
      </div>
    );
  }

  if (mostrarInicio) return contenidoAnimado(
    <div style={{ padding: "2rem", fontFamily: "'Segoe UI', sans-serif", background: "#e3f2fd", minHeight: "100vh" }}>
      <h2 style={{ color: "#00796b" }}>📌 Inicio de la Clase</h2>
      <div style={{ marginBottom: "1rem" }}>
        ⏳ Tiempo restante: <strong>{formatoTiempo(contador)}</strong>
      </div>
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <h3>{contenidoDelDia?.split(" - ")[0]}</h3>
        <p style={{ fontWeight: "bold" }}>{contenidoDelDia?.split(" - ")[1]}</p>
      </div>
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1, padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h4>📚 Conocimientos Previos</h4>
          <p>Indica lo que deben saber antes de esta clase.</p>
        </div>
        <div style={{ flex: 2, padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h4>🎤 Mentimeter Personalizado</h4>
          <p>¿Qué palabra recuerdas de la clase pasada?</p>
          <input type="text" placeholder="Escribe tu palabra aquí..." value={respuestaMentimeter} onChange={(e) => setRespuestaMentimeter(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }} />
          <button onClick={guardarRespuestaMentimeter} style={{ background: "#0288d1", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "5px" }}>Enviar</button>
          <div style={{ marginTop: "1rem" }}>
            <h5>Respuestas anteriores:</h5>
            <ul>
              {respuestasMentimeter.map((r, i) => (
                <li key={i}>{new Date(r.fecha).toLocaleTimeString()} - {r.respuesta}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <button onClick={() => { setMostrarInicio(false); setMostrarDesarrollo(true); }} style={{ marginTop: "2rem", background: "#00796b", color: "white", padding: "0.5rem 1.5rem", border: "none", borderRadius: "5px" }}>
        ➡️ Ir al Desarrollo
      </button>
    </div>
  );

  if (mostrarDesarrollo) return contenidoAnimado(
    <div style={{ padding: "2rem", background: "#fff8e1", fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh" }}>
      <h2 style={{ color: "#ef6c00" }}>🧩 Desarrollo de la Clase</h2>
      <div style={{ marginBottom: "1rem" }}>
        ⏳ Tiempo restante: <strong>{formatoTiempo(contador)}</strong>
      </div>
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1, padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h4>📝 Actividad 1</h4>
          <p>Interactúa con un compañero y resuelve el siguiente problema en voz alta.</p>
        </div>
        <div style={{ flex: 1, padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h4>💡 Actividad 2</h4>
          <p>Escribe un ejemplo propio relacionado con el tema de hoy y compártelo con tu grupo.</p>
        </div>
      </div>
      <button onClick={() => { setMostrarDesarrollo(false); setMostrarCierre(true); }} style={{ marginTop: "2rem", background: "#00796b", color: "white", padding: "0.5rem 1.5rem", border: "none", borderRadius: "5px" }}>
        ➡️ Ir al Cierre
      </button>
    </div>
  );

  if (mostrarCierre) return contenidoAnimado(
    <div style={{ padding: "2rem", fontFamily: "'Segoe UI', sans-serif", background: "#e8f5e9", minHeight: "100vh" }}>
      <h2 style={{ color: "#2e7d32" }}>🎯 Cierre de la Clase</h2>
      {mostrarMensajeFinal && (
        <div style={{ padding: "1rem", background: "#ffeb3b", color: "#000", fontWeight: "bold", fontSize: "1.5rem", textAlign: "center", borderRadius: "10px", marginBottom: "1rem" }}>
          ¡Excelente trabajo hoy! Recuerden dejar la sala limpia, ordenada y la pizarra borrada 🧼🪣🧽
        </div>
      )}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ flex: 1, padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h4>📌 Síntesis</h4>
          <p>Resumen colaborativo de los conceptos clave aprendidos hoy.</p>
        </div>
        <div style={{ flex: 1, padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h4>📊 Retroalimentación</h4>
          <p>Autoevaluación, encuestas de cierre, reflexión sobre el aprendizaje.</p>
          <button onClick={() => alert("Encuesta enviada. ¡Gracias por tu opinión!")} style={{ marginTop: "1rem", background: "#0288d1", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "5px" }}>
            📝 Enviar Encuesta de Satisfacción
          </button>
          <button onClick={() => alert("Resumen descargado.")} style={{ marginTop: "0.5rem", background: "#4caf50", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "5px" }}>
            📥 Descargar Resumen PDF
          </button>
          <button onClick={() => window.location.reload()} style={{ marginTop: "0.5rem", background: "#6a1b9a", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "5px" }}>
            🔁 Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;







































































