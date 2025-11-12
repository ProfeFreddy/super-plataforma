// /src/services/currentSlot.js
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Guarda en localStorage (rápido) y Firestore (consistente entre pantallas/dispositivos)
export async function saveCurrentSlot(slot) {
  try {
    const clean = slot ? JSON.parse(JSON.stringify(slot)) : null;
    if (clean) localStorage.setItem("currentSlot", JSON.stringify(clean));
    else localStorage.removeItem("currentSlot");

    const uid = auth?.currentUser?.uid;
    if (uid && clean) {
      await setDoc(doc(db, "users", uid, "runtime", "currentSlot"), clean, { merge: true });
    }
  } catch (e) {
    console.warn("[currentSlot] save error:", e?.message || e);
  }
}

export async function loadCurrentSlot() {
  // 1) local primero (rápido)
  try {
    const raw = localStorage.getItem("currentSlot");
    if (raw) return JSON.parse(raw);
  } catch {}

  // 2) Firestore (por si cambias de pestaña)
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid) return null;
    const snap = await getDoc(doc(db, "users", uid, "runtime", "currentSlot"));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("[currentSlot] load error:", e?.message || e);
    return null;
  }
}

// Helper para construir un ID legible si lo necesitas
export function currentSlotId(slot) {
  if (!slot) return "sin-slot";
  const d = slot?.dia ?? slot?.day ?? "d";
  const b = slot?.bloque ?? slot?.block ?? "b";
  const c = slot?.curso ?? "curso";
  const s = slot?.seccion ?? slot?.sección ?? "sec";
  return `${d}-${b}-${c}-${s}`;
}
