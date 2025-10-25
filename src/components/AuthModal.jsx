// src/components/AuthModal.jsx
import React, { useState } from "react";
import { useAuthX } from "../hooks/useAuthX";

export default function AuthModal({ open, onClose, onSuccess }) {
  const { busy, error, loginGoogle, loginEmail } = useAuthX();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  // === agregado ===
  const [nombre, setNombre] = useState("");
  const [pass2, setPass2] = useState("");
  const same = pass && pass2 && pass === pass2;
  // === fin agregado ===

  if (!open) return null;
  return (
    <div style={wrap}>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Iniciar sesión</h3>
        <button style={btn} disabled={busy} onClick={async () => {
          try { const u = await loginGoogle(); onSuccess?.(u); onClose?.(); } catch {}
        }}>
          {busy ? "Conectando…" : "Continuar con Google"}
        </button>

        <div style={{ margin: "8px 0", color: "#64748b", fontSize: 12 }}>o con correo</div>

        {/* === agregado: nombre, requerido solo al crear === */}
        <input style={input} placeholder="Nombre (solo al crear)" value={nombre} onChange={e=>setNombre(e.target.value)} />
        {/* === fin agregado === */}

        <input style={input} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input style={input} type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />

        {/* === agregado: repetir contraseña, validación visual === */}
        <input style={input} type="password" placeholder="Repetir contraseña (solo al crear)" value={pass2} onChange={e=>setPass2(e.target.value)} />
        {/* === fin agregado === */}

        <div style={{ display:"flex", gap:8 }}>
          <button style={btn} disabled={busy || !email || !pass} onClick={async () => {
            try { const u = await loginEmail(email, pass, false); onSuccess?.(u); onClose?.(); } catch {}
          }}>Entrar</button>
          <button style={btnGhost}
            disabled={busy || !email || !pass || !nombre || !same}
            onClick={async () => {
              try {
                // pasa el nombre como 4º argumento para setear displayName y perfil Firestore
                const u = await loginEmail(email, pass, true, nombre);
                onSuccess?.(u); onClose?.();
              } catch {}
            }}>Crear cuenta</button>
        </div>

        {/* === agregado: error de contraseñas no coinciden === */}
        {!same && pass2 && (
          <div style={{ color: "#b91c1c", marginTop: 6, fontSize: 12 }}>
            Las contraseñas no coinciden
          </div>
        )}
        {/* === fin agregado === */}

        {error ? <div style={{ color: "#b45309", marginTop: 6 }}>⚠️ {error}</div> : null}
        <button style={btnLink} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

const wrap = { position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"grid", placeItems:"center", zIndex:9999 };
const card = { background:"#fff", padding:16, borderRadius:12, width:360, boxShadow:"0 10px 30px rgba(0,0,0,.2)" };
const btn  = { padding:"10px 12px", borderRadius:10, border:"1px solid #e5e7eb", cursor:"pointer", fontWeight:700, width:"100%", marginBottom:8 };
const btnGhost = { ...btn, background:"#f8fafc" };
const btnLink = { ...btn, background:"transparent", border:"none", color:"#2563eb", fontWeight:600, marginTop:6 };
const input = { padding:"10px 12px", border:"1px solid #e5e7eb", borderRadius:10, width:"100%", marginBottom:8, outline:"none" };
