// src/context/PlanContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { PLAN_CAPS } from "../lib/planCaps";

export const PLAN_FALLBACK = {
  user: null,
  plan: "FREE",
  caps: PLAN_CAPS.FREE,
  loading: false,
  trialActive: false,
  trialDaysLeft: 0,
  planExpired: false,
};

export const PlanContext = createContext(PLAN_FALLBACK);

// Normaliza el plan a los keys de PLAN_CAPS
function normalizePlan(raw = "") {
  const map = {
    free: "FREE",
    pro: "PRO",
    profe_pro: "PRO",
    premium: "PREMIUM",
    profe_elite: "PREMIUM",
    elite: "PREMIUM",
    basico: "BASICO",
    colegio_basico: "BASICO",
    trial: "PREMIUM", // trial = acceso Elite completo
  };
  return map[(raw || "").toLowerCase()] || "FREE";
}

// Verifica si el plan está vigente según period.end
function isPlanVigente(data = {}) {
  try {
    const end = data?.period?.end;
    if (!end) return false;
    const endDate = end.toDate ? end.toDate() : new Date(end);
    return endDate > new Date();
  } catch {
    return false;
  }
}

// Verifica si el trial está activo y cuántos días quedan
function getTrialInfo(data = {}) {
  try {
    const trialEnd = data?.trialEnd;
    if (!trialEnd) return { trialActive: false, trialDaysLeft: 0 };
    const endDate = trialEnd.toDate ? trialEnd.toDate() : new Date(trialEnd);
    const now = new Date();
    if (endDate <= now) return { trialActive: false, trialDaysLeft: 0 };
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    return { trialActive: true, trialDaysLeft: daysLeft };
  } catch {
    return { trialActive: false, trialDaysLeft: 0 };
  }
}

export function PlanProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [plan, setPlan]               = useState("FREE");
  const [caps, setCaps]               = useState(PLAN_CAPS.FREE);
  const [loading, setLoading]         = useState(true);
  const [trialActive, setTrialActive] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [planExpired, setPlanExpired] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);

      if (!u || u.isAnonymous) {
        setPlan("FREE");
        setCaps(PLAN_CAPS.FREE);
        setTrialActive(false);
        setTrialDaysLeft(0);
        setPlanExpired(false);
        setLoading(false);
        return;
      }

      try {
        const ref  = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // Usuario nuevo → crear doc con trial de 7 días
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 7);

          await setDoc(ref, {
            plan: "FREE",
            trialEnd,
            trialUsed: false,
            limits: PLAN_CAPS.FREE,
            createdAt: serverTimestamp(),
          });

          setPlan("FREE");
          setCaps(PLAN_CAPS.FREE);
          setTrialActive(true);
          setTrialDaysLeft(7);
          setPlanExpired(false);
        } else {
          const data       = snap.data();
          const rawPlan    = data?.plan || "FREE";
          const normalized = normalizePlan(rawPlan);
          const vigente    = isPlanVigente(data);
          const { trialActive: ta, trialDaysLeft: td } = getTrialInfo(data);

          // Si el plan de pago venció
          if (rawPlan !== "FREE" && !vigente && !ta) {
            setPlan("FREE");
            setCaps(PLAN_CAPS.FREE);
            setPlanExpired(true);
          } else {
            // trial activo → acceso PREMIUM
            const effectivePlan = ta ? "PREMIUM" : normalized;
            setPlan(effectivePlan);
            setCaps(data.limits || PLAN_CAPS[effectivePlan] || PLAN_CAPS.FREE);
            setPlanExpired(false);
          }

          setTrialActive(ta);
          setTrialDaysLeft(td);
        }
      } catch (e) {
        console.warn("[PlanContext] error leyendo users:", e?.code || e?.message);
        setPlan("FREE");
        setCaps(PLAN_CAPS.FREE);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return (
    <PlanContext.Provider value={{
      user,
      plan,
      caps,
      loading,
      trialActive,
      trialDaysLeft,
      planExpired,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext) || PLAN_FALLBACK;
}

export default PlanContext;