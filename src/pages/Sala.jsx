// src/pages/Sala.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { rtdb } from "../firebase";
import { ref, push, serverTimestamp } from "firebase/database";

export default function Sala() {
  const { code } = useParams();
  const [palabra, setPalabra] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const enviar = async (e) => {
    e.preventDefault();
    setErr("");
    const w = (palabra || "").trim();
    if (!w) return;
    try {
      // usa el mismo “bucket” que lee tu NubeDePalabras
      // si tu componente usa otro path, cámbialo acá:
      const pRef = ref(rtdb, `salas/${code}/palabras`);
      await push(pRef, { text: w, ts: serverTimestamp() });
      setOk(true);
      setPalabra("");
      setTimeout(() => setOk(false), 1500);
    } catch (e2) {
      setErr("No se pudo enviar. Reintenta.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0ea5e9",
      fontFamily: "system-ui, Segoe UI, sans-serif"
    }}>
      <div style={{
        width: "min(92vw,520px)",
        background: "#fff",
        padding: 18,
        borderRadius: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,.12)"
      }}>
        <h2 style={{margin: 0}}>Nube de palabras</h2>
        <div style={{color:"#475569", marginBottom: 12}}>
          Código: <b>{code}</b>
        </div>
        <form onSubmit={enviar} style={{display:"flex", gap: 8}}>
          <input
            autoFocus
            value={palabra}
            onChange={(e) => setPalabra(e.target.value)}
            placeholder="Escribe una palabra…"
            style={{
              flex: 1, padding: "12px 14px",
              border: "1px solid #e2e8f0",
              borderRadius: 10, outline: "none"
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px 16px",
              border: "none",
              borderRadius: 10,
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Enviar
          </button>
        </form>
        {ok && <div style={{color:"#16a34a", marginTop: 8}}>¡Enviado!</div>}
        {err && <div style={{color:"#b91c1c", marginTop: 8}}>{err}</div>}
        <div style={{marginTop:12, fontSize:12, color:"#64748b"}}>
          Al enviar, tu palabra aparece en la pantalla del profesor.
        </div>
      </div>
    </div>
  );
}
