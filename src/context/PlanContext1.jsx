// src/context/PlanContext.js
import React, {createContext, useContext, useEffect, useState} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase"; // ajusta tus imports
import { PLAN_CAPS } from "../lib/planCaps";

/* Ãƒâ€Ã‚Â£ÃƒÂ  NUEVO: fallback seguro para que nunca sea null */
export const PLAN_FALLBACK = {
  user: null,
  plan: "FREE",
  caps: PLAN_CAPS.FREE,
  loading: false,
};

/* Ãƒâ€Ã‚Â¼ÃƒÂ Ã‚Â´Ã‚Â©Ãƒâ€¦ Antes: const PlanContext = createContext(null);
      Ahora: export + fallback (para que no rompa si se usa fuera del Provider) */
export const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState("FREE");
  const [caps, setCaps] = useState(PLAN_CAPS.FREE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) {
        setPlan("FREE");
        setCaps(PLAN_CAPS.FREE);
        setLoading(false);
        return;
      }
      // Lee (o crea) el doc del usuario
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          plan: "FREE",
          planUntil: null,
          limits: PLAN_CAPS.FREE,
          createdAt: serverTimestamp()
        });
        setPlan("FREE");
        setCaps(PLAN_CAPS.FREE);
      } else {
        const data = snap.data();
        const currentPlan = data.plan || "FREE";
        setPlan(currentPlan);
        setCaps(data.limits || PLAN_CAPS[currentPlan] || PLAN_CAPS.FREE);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <PlanContext.Provider value={{ user, plan, caps, loading }}>
      {children}
    </PlanContext.Provider>
  );
}

/* Ãƒâ€ÃƒÂ¸ÃƒÂ¦Ã‚Â´Ã‚Â©Ãƒâ€¦ Esta lÃ¢â€Å“Ã‚Â¡nea antes redeclaraba el contexto y rompÃ¢â€Å“Ã‚Â¡a el build.
   La convierto en re-export para cumplir Ãƒâ€Ãƒâ€¡Ã‚Â£no eliminar algoÃƒâ€Ãƒâ€¡ÃƒËœ. */
export { PlanContext as default, PlanContext as ReExport_PlanContext };

/* Ãƒâ€Ã‚Â£ÃƒÂ  usePlan nunca devolverÃ¢â€Å“ÃƒÂ­ null: cae al PLAN_FALLBACK si el contexto aÃ¢â€Å“Ã¢â€¢â€˜n no estÃ¢â€Å“ÃƒÂ­ listo */
export function usePlan() {
  return useContext(PlanContext) || PLAN_FALLBACK;
}

