// src/pages/TestNube.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import WordCloud from "react-d3-cloud";

export default function TestNube() {
  const [palabras, setPalabras] = useState([]);
  const [texto, setTexto] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    console.log("[TestNube] mounted. user:", auth?.currentUser?.uid || "(sin user)");
    setErr("");
    let unsub = null;

    try {
      const q = query(collection(db, "nubePalabras"), orderBy("timestamp", "desc"));
      unsub = onSnapshot(
        q,
        (snap) => {
          const arr = [];
          snap.forEach((doc) => {
            const d = doc.data() || {};
            if (d?.palabra) arr.push({ palabra: d.palabra, size: d.size || 30 });
          });
          setPalabras(arr);
        },
        (e) => {
          console.warn("[TestNube] onSnapshot error:", e?.message || e);
          setErr(
            "No pude leer la nube (permiso o conexión). Puedes seguir probando el envío."
          );
        }
      );
    } catch (e) {
      console.warn("[TestNube] snapshot try/catch:", e?.message || e);
      setErr("No pude suscribirme a la nube (permiso o conexión).");
    }

    return () => {
      if (unsub) try { unsub(); } catch {}
    };
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    const t = String(texto || "").trim();
    if (!t) return;
    setErr("");
    try {
      await addDoc(collection(db, "nubePalabras"), {
        palabra: t,
        size: 20 + Math.random() * 40,
        timestamp: serverTimestamp(),
        by: auth?.currentUser?.uid || "anon",
      });
      setTexto("");
    } catch (e) {
      console.warn("[TestNube] addDoc error:", e?.message || e);
      setErr(
        "No pude guardar la palabra (regla de seguridad o conexión). Intenta con una sesión con permisos."
      );
    }
  };

  const data = palabras.map((p) => ({ text: p.palabra, value: p.size || 30 }));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #2193b0, #6dd5ed)",
        color: "white",
        fontFamily: "Segoe UI, sans-serif",
        padding: 20,
        textAlign: "center",
      }}
    >
      <h1>🌤 Nube de Palabras (demo)</h1>
      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>
        Ruta: <code>/#/test-nube</code> | UID:{" "}
        <code>{auth?.currentUser?.uid || "sin-uid"}</code>
      </div>

      <form onSubmit={enviar} style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe una palabra y Enter"
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            outline: "none",
            fontSize: 18,
            width: "70%",
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: 10,
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#fff",
            color: "#2193b0",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Enviar
        </button>
      </form>

      {err && (
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto 12px",
            background: "#00000022",
            border: "1px solid #ffffff55",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ width: "100%", height: "60vh" }}>
        <WordCloud
          data={data}
          font="sans-serif"
          fontWeight="bold"
          spiral="rectangular"
          rotate={() => ~~(Math.random() * 2) * 90}
          padding={2}
        />
      </div>
    </div>
  );
}


