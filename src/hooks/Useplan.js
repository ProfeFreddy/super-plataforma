// src/hooks/usePlan.js
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export function usePlan() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("FREE");
  const [trialActivo, setTrialActivo] = useState(false);
  const [diasRestantes, setDiasRestantes] = useState(0);
  const [trialExpirado, setTrialExpirado] = useState(false);
  const [tieneAcceso, setTieneAcceso] = useState(false);

  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (alive) { setLoading(false); setTieneAcceso(false); }
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) {
          // Usuario sin doc en "users" → no bloqueamos (usuario antiguo)
          if (alive) { setTieneAcceso(true); setLoading(false); }
          return;
        }
        const data = snap.data() || {};
        const planVal = data.plan || "FREE";
        const trialEnd = data.trialEnd?.toDate?.() || (data.trialEnd ? new Date(data.trialEnd) : null);
        const ahora = new Date();

        let dias = 0;
        let activo = false;
        let expirado = false;

        if (trialEnd) {
          dias = Math.ceil((trialEnd - ahora) / (1000 * 60 * 60 * 24));
          activo = dias > 0;
          expirado = dias <= 0;
        }

        const acceso = planVal === "PRO" || planVal === "ELITE" || activo;

        if (alive) {
          setPlan(planVal);
          setTrialActivo(activo);
          setDiasRestantes(Math.max(0, dias));
          setTrialExpirado(expirado);
          setTieneAcceso(acceso);
          setLoading(false);
        }
      } catch (e) {
        console.warn("[usePlan]", e?.message);
        if (alive) { setTieneAcceso(true); setLoading(false); }
      }
    });
    return () => { alive = false; unsub(); };
  }, []);

  return { plan, trialActivo, diasRestantes, trialExpirado, tieneAcceso, loading };
}