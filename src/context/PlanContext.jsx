// src/context/PlanContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { PLAN_CAPS } from "../lib/planCaps";

const PlanContext = createContext({
  plan: "FREE",
  caps: PLAN_CAPS.FREE,
  loading: true,
  trialActive: false,
  planExpired: false,
});

export function PlanProvider({ children }) {
  const [plan, setPlan] = useState("FREE");
  const [trialActive, setTrialActive] = useState(false);
  const [planExpired, setPlanExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!alive) return;

      if (!user) {
        setPlan("FREE");
        setTrialActive(false);
        setPlanExpired(false);
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!alive) return;

        if (!snap.exists()) {
          // Usuario nuevo sin doc — crear trial de 7 días automáticamente
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 7);
          try {
            await setDoc(ref, {
              plan: "FREE",
              trialEnd,
              trialUsed: false,
              limits: {
                maxStudentsPerClass: 9999,
                exports: { pdf: true, xlsx: true },
                tools: { aiBasic: true },
              },
              createdAt: serverTimestamp(),
            }, { merge: true });
          } catch (e) {
            console.warn("[PlanContext] setDoc trial:", e);
          }
          if (alive) {
            setPlan("FREE");
            setTrialActive(true);
            setPlanExpired(false);
            setLoading(false);
          }
          return;
        }

        const data = snap.data() || {};
        const planVal = data.plan || "FREE";

        // Calcular si el trial está activo
        let trial = false;
        if (data.trialEnd) {
          const trialEnd = data.trialEnd instanceof Date
            ? data.trialEnd
            : data.trialEnd?.toDate?.()
            ? data.trialEnd.toDate()
            : new Date(data.trialEnd);
          trial = trialEnd > new Date();
        }

        // Calcular si el plan de pago expiró
        let expired = false;
        if (planVal !== "FREE" && data.period?.end) {
          const periodEnd = data.period.end instanceof Date
            ? data.period.end
            : data.period.end?.toDate?.()
            ? data.period.end.toDate()
            : new Date(data.period.end);
          expired = periodEnd < new Date();
        }

        if (alive) {
          setPlan(planVal);
          setTrialActive(trial);
          setPlanExpired(expired);
          setLoading(false);
        }
      } catch (e) {
        console.warn("[PlanContext] getDoc error:", e);
        // En caso de error de red no bloquear al usuario
        if (alive) {
          setPlan("FREE");
          setTrialActive(true);
          setPlanExpired(false);
          setLoading(false);
        }
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const value = useMemo(() => ({
    plan,
    caps: PLAN_CAPS[plan] || PLAN_CAPS.FREE,
    loading,
    trialActive,
    planExpired,
  }), [plan, loading, trialActive, planExpired]);

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

export { PlanContext };
export default PlanContext;